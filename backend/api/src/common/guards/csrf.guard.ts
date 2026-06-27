import { timingSafeEqual } from "node:crypto";
import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { isPublicRoute } from "../utils/metadata.util";
import { getAllowedOrigins, parseOrigin } from "../utils/origin.util";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_CSRF_COOKIE_NAME = "movex_csrf";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    if (this.hasAllowedOriginOrReferer(request)) {
      return true;
    }

    if (this.hasValidDoubleSubmitToken(request)) {
      return true;
    }

    throw new ForbiddenException("CSRF verification failed");
  }

  private hasAllowedOriginOrReferer(request: Request): boolean {
    const allowedOrigins = getAllowedOrigins();
    const origin = parseOrigin(request.header("origin"));
    const refererOrigin = parseOrigin(request.header("referer"));

    return Boolean((origin && allowedOrigins.has(origin)) || (refererOrigin && allowedOrigins.has(refererOrigin)));
  }

  private hasValidDoubleSubmitToken(request: Request): boolean {
    const cookieName = process.env.CSRF_COOKIE_NAME ?? DEFAULT_CSRF_COOKIE_NAME;
    const cookieToken = request.cookies?.[cookieName];
    const headerToken = request.header("x-csrf-token") ?? request.header("x-xsrf-token");

    if (typeof cookieToken !== "string" || typeof headerToken !== "string") {
      return false;
    }

    if (!cookieToken || cookieToken.length !== headerToken.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  }
}
