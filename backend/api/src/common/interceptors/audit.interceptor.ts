import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { tap } from "rxjs";
import type { Observable } from "rxjs";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { RequestWithUser } from "../types/authenticated-request";

const STAFF_ROLES = new Set<string>([UserRole.SUPPORT, UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(password|token|secret|otp|code|hash|signature|authorization|cookie|csrf|apiKey|key)$/i;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const method = request.method.toUpperCase();
    const user = request.user;

    if (!MUTATING_METHODS.has(method) || !user || !STAFF_ROLES.has(user.role)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const actorId = user.session?.userId ?? user.userId;
    const actorRole = user.role as UserRole;
    const path = request.originalUrl ?? request.url;
    const params = request.params as Record<string, unknown> | undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          void this.prisma.auditLog.create({
            data: {
              actorId,
              actorRole,
              action: `${method} ${this.normalizePath(path)}`,
              entityType: this.entityTypeFromPath(path),
              entityId: this.entityIdFromParams(params),
              ipAddress: request.ip,
              userAgent: request.get?.("user-agent"),
              metadata: {
                durationMs: Date.now() - startedAt,
                params: this.redact(params ?? {}),
                query: this.redact(request.query ?? {}),
                body: this.redact(request.body ?? {}),
              },
            },
          }).catch(() => undefined);
        },
      }),
    );
  }

  private normalizePath(path: string): string {
    return path.split("?")[0] ?? path;
  }

  private entityTypeFromPath(path: string): string {
    const parts = this.normalizePath(path).split("/").filter(Boolean);
    const apiIndex = parts.indexOf("api");
    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const start = versionIndex >= 0 ? versionIndex + 1 : apiIndex >= 0 ? apiIndex + 1 : 0;
    return parts[start] ?? "unknown";
  }

  private entityIdFromParams(params?: Record<string, unknown>): string | undefined {
    if (!params) {
      return undefined;
    }

    const key = Object.keys(params).find((name) => name.toLowerCase().endsWith("id"));
    const value = key ? params[key] : undefined;
    return typeof value === "string" ? value : undefined;
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : this.redact(nested);
    }

    return output;
  }
}