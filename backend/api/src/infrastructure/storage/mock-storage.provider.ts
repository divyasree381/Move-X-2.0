import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type { StorageProvider, StoreObjectInput, StoredObject } from "./storage-provider";

@Injectable()
export class MockStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, Buffer>();

  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    const buffer = Buffer.from(input.contentBase64, "base64");
    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
    const digest = checksumSha256.slice(0, 16);
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${input.keyPrefix}/${Date.now()}_${digest}_${safeName}`;
    const bucket = "mock-private";
    this.objects.set(`${bucket}/${key}`, buffer);

    return {
      bucket,
      key,
      url: `mock://storage/${key}`,
      contentType: input.contentType,
      sizeBytes: buffer.byteLength,
      checksumSha256,
    };
  }

  async createSignedUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(`${bucket}/${key}`)) {
      throw new Error("Stored object not found");
    }

    return `mock://storage/${key}?expiresIn=${expiresInSeconds}`;
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    this.objects.delete(`${bucket}/${key}`);
  }
}