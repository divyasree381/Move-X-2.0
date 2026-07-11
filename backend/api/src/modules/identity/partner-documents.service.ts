import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PartnerApproval,
  PartnerDocumentStatus,
  PartnerDocumentType,
  type PartnerDocument,
  type Prisma,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { STORAGE_PROVIDER, type StorageProvider } from "../../infrastructure/storage/storage-provider";
import type { RequestMetadata, SessionRecord } from "./identity.types";
import type { PartnerDocumentUploadDto } from "./dto/partner-document-upload.dto";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 300;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const IMAGE_ONLY_TYPES = new Set<PartnerDocumentType>([
  PartnerDocumentType.PROFILE_IMAGE,
  PartnerDocumentType.LIVE_PHOTO,
]);
const ROLE_DOCUMENT_TYPES: Record<string, ReadonlySet<PartnerDocumentType>> = {
  [UserRole.RESTAURANT]: new Set([
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.STORE_LICENSE,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.BANK_PROOF,
  ]),
  [UserRole.DELIVERY]: new Set([
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.VEHICLE_RC,
    PartnerDocumentType.VEHICLE_INSURANCE,
    PartnerDocumentType.SKILL_CERTIFICATE,
    PartnerDocumentType.POLICE_VERIFICATION,
    PartnerDocumentType.BANK_PROOF,
  ]),
  [UserRole.DRIVER]: new Set([
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.DRIVING_LICENSE,
    PartnerDocumentType.VEHICLE_RC,
    PartnerDocumentType.VEHICLE_INSURANCE,
    PartnerDocumentType.BANK_PROOF,
  ]),
};
const REQUIRED_DOCUMENT_TYPES: Record<string, readonly PartnerDocumentType[]> = {
  store: [
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.STORE_LICENSE,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.BANK_PROOF,
  ],
  delivery: [
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.VEHICLE_RC,
    PartnerDocumentType.VEHICLE_INSURANCE,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.BANK_PROOF,
  ],
  driver: [
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.DRIVING_LICENSE,
    PartnerDocumentType.VEHICLE_RC,
    PartnerDocumentType.VEHICLE_INSURANCE,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.BANK_PROOF,
  ],
  "home-services": [
    PartnerDocumentType.PROFILE_IMAGE,
    PartnerDocumentType.LIVE_PHOTO,
    PartnerDocumentType.SKILL_CERTIFICATE,
    PartnerDocumentType.AADHAAR,
    PartnerDocumentType.PAN,
    PartnerDocumentType.BANK_PROOF,
  ],
};

@Injectable()
export class PartnerDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(session: SessionRecord, input: PartnerDocumentUploadDto) {
    this.assertPartner(session);
    this.assertDocumentsEditable(session);
    this.assertDocumentAllowed(session.user.role, input.documentType);
    const buffer = this.validateFile(input);
    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
    const latest = await this.prisma.partnerDocument.findFirst({
      where: { userId: session.userId, documentType: input.documentType },
      orderBy: { version: "desc" },
    });
    if (latest && latest.status !== PartnerDocumentStatus.SUPERSEDED && latest.checksumSha256 === checksumSha256) {
      return this.serialize(latest);
    }
    const version = (latest?.version ?? 0) + 1;
    const extension = this.extensionFor(input.contentType);
    const stored = await this.storage.putObject({
      keyPrefix: `partners/${session.userId}/${input.documentType.toLowerCase()}`,
      fileName: `${randomUUID()}.${extension}`,
      contentType: input.contentType,
      contentBase64: buffer.toString("base64"),
      metadata: {
        userId: session.userId,
        documentType: input.documentType,
        originalFileName: input.fileName,
        version: String(version),
      },
    });

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        await tx.partnerDocument.updateMany({
          where: {
            userId: session.userId,
            documentType: input.documentType,
            status: { not: PartnerDocumentStatus.SUPERSEDED },
          },
          data: { status: PartnerDocumentStatus.SUPERSEDED },
        });
        return tx.partnerDocument.create({
          data: {
            userId: session.userId,
            documentType: input.documentType,
            bucket: stored.bucket,
            objectKey: stored.key,
            originalFileName: input.fileName,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            checksumSha256: stored.checksumSha256,
            version,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });
      });
      return this.serialize(document);
    } catch (error) {
      await this.storage.deleteObject(stored.bucket, stored.key).catch(() => undefined);
      throw error;
    }
  }

  async listOwn(session: SessionRecord) {
    this.assertPartner(session);
    return this.listForUser(session.userId);
  }

  async listForAdmin(userId: string) {
    return this.listForUser(userId);
  }

  async accessOwn(session: SessionRecord, documentId: string, metadata: RequestMetadata) {
    this.assertPartner(session);
    const document = await this.requireDocument(documentId);
    if (document.userId !== session.userId) {
      throw new ForbiddenException("This document belongs to another partner");
    }
    return this.createAccess(document, session, metadata, "PARTNER_DOCUMENT_SELF_ACCESS");
  }

  async accessForAdmin(
    actor: SessionRecord,
    userId: string,
    documentId: string,
    metadata: RequestMetadata,
  ) {
    const document = await this.requireDocument(documentId);
    if (document.userId !== userId) {
      throw new NotFoundException("Partner document not found");
    }
    return this.createAccess(document, actor, metadata, "PARTNER_DOCUMENT_ADMIN_ACCESS");
  }

  async removeOwn(session: SessionRecord, documentId: string) {
    this.assertPartner(session);
    this.assertDocumentsEditable(session);
    const document = await this.requireDocument(documentId);
    if (document.userId !== session.userId) {
      throw new ForbiddenException("This document belongs to another partner");
    }
    await this.storage.deleteObject(document.bucket, document.objectKey);
    await this.prisma.partnerDocument.delete({ where: { id: document.id } });
    return { deleted: true };
  }

  async assertSubmissionReady(userId: string, partnerKind: string): Promise<void> {
    const required = REQUIRED_DOCUMENT_TYPES[partnerKind];
    if (!required) {
      throw new BadRequestException("Unsupported partner verification type");
    }
    const documents = await this.prisma.partnerDocument.findMany({
      where: { userId, status: { not: PartnerDocumentStatus.SUPERSEDED } },
      select: { documentType: true },
    });
    const uploaded = new Set(documents.map((document) => document.documentType));
    const missing = required.filter((type) => !uploaded.has(type));
    if (missing.length > 0) {
      throw new BadRequestException(`Upload required documents: ${missing.join(", ")}`);
    }
  }

  async attachActiveDocuments(userId: string, verificationId: string): Promise<void> {
    await this.prisma.partnerDocument.updateMany({
      where: { userId, status: { not: PartnerDocumentStatus.SUPERSEDED } },
      data: { verificationId },
    });
  }

  private async listForUser(userId: string) {
    const documents = await this.prisma.partnerDocument.findMany({
      where: { userId, status: { not: PartnerDocumentStatus.SUPERSEDED } },
      orderBy: [{ documentType: "asc" }, { version: "desc" }],
    });
    return documents.map((document) => this.serialize(document));
  }

  private async createAccess(
    document: PartnerDocument,
    actor: SessionRecord,
    metadata: RequestMetadata,
    action: string,
  ) {
    const url = await this.storage.createSignedUrl(
      document.bucket,
      document.objectKey,
      SIGNED_URL_TTL_SECONDS,
    );
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.user.role as UserRole,
        action,
        entityType: "PartnerDocument",
        entityId: document.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          partnerId: document.userId,
          documentType: document.documentType,
          version: document.version,
          expiresInSeconds: SIGNED_URL_TTL_SECONDS,
        } as Prisma.InputJsonValue,
      },
    });
    return { url, expiresInSeconds: SIGNED_URL_TTL_SECONDS };
  }

  private async requireDocument(documentId: string) {
    const document = await this.prisma.partnerDocument.findUnique({ where: { id: documentId } });
    if (!document || document.status === PartnerDocumentStatus.SUPERSEDED) {
      throw new NotFoundException("Partner document not found");
    }
    return document;
  }

  private validateFile(input: PartnerDocumentUploadDto): Buffer {
    if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
      throw new BadRequestException("Only PDF, JPEG, PNG, and WebP documents are supported");
    }
    if (IMAGE_ONLY_TYPES.has(input.documentType) && !input.contentType.startsWith("image/")) {
      throw new BadRequestException("Profile and live photos must be image files");
    }
    const buffer = Buffer.from(input.contentBase64, "base64");
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_FILE_BYTES) {
      throw new BadRequestException("Document must be between 1 byte and 10 MB");
    }
    if (!this.matchesMagicBytes(buffer, input.contentType)) {
      throw new BadRequestException("Document contents do not match the declared file type");
    }
    return buffer;
  }

  private matchesMagicBytes(buffer: Buffer, contentType: string): boolean {
    if (contentType === "application/pdf") return buffer.subarray(0, 4).toString() === "%PDF";
    if (contentType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
    if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (contentType === "image/webp") return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
    return false;
  }

  private extensionFor(contentType: string): string {
    return ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[contentType] ?? "bin";
  }

  private assertDocumentsEditable(session: SessionRecord): void {
    if (session.user.partnerApproval === PartnerApproval.PENDING) {
      throw new ForbiddenException("Documents are locked while verification is under review");
    }
    if (session.user.partnerApproval === PartnerApproval.APPROVED) {
      throw new ForbiddenException("Approved documents can only be changed through a new review request");
    }
  }

  private assertDocumentAllowed(role: string, documentType: PartnerDocumentType): void {
    if (!ROLE_DOCUMENT_TYPES[role]?.has(documentType)) {
      throw new ForbiddenException("This document type is not allowed for the authenticated partner role");
    }
  }

  private assertPartner(session: SessionRecord): void {
    if (!ROLE_DOCUMENT_TYPES[session.user.role]) {
      throw new ForbiddenException("Partner documents are only available to partner accounts");
    }
  }

  private serialize(document: PartnerDocument) {
    return {
      id: document.id,
      documentType: document.documentType,
      originalFileName: document.originalFileName,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      checksumSha256: document.checksumSha256,
      version: document.version,
      status: document.status,
      rejectionReason: document.rejectionReason,
      expiresAt: document.expiresAt?.toISOString() ?? null,
      uploadedAt: document.uploadedAt.toISOString(),
      reviewedAt: document.reviewedAt?.toISOString() ?? null,
    };
  }
}