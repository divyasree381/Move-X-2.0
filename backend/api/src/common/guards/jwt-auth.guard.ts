import { ForbiddenException, Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { canPasswordLogin } from "@movex/shared";
import { Reflector } from "@nestjs/core";

import { SessionService } from "../../modules/identity/session/session.service";
import type { RequestWithUser } from "../types/authenticated-request";
import { isPublicRoute } from "../utils/metadata.util";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const session = await this.sessionService.resolveRequest(request);

    if (!session) {
      throw new UnauthorizedException("Authentication required");
    }

    if (canPasswordLogin(session.user.role) && !this.canUseStaffLifecycleRoute(request.path)) {
      if (!session.user.emailVerifiedAt) {
        throw new ForbiddenException("Staff email verification required");
      }

      if (session.user.mustChangePassword) {
        throw new ForbiddenException("Password change required");
      }
    }

    request.user = {
      sessionId: session.id,
      userId: session.userId,
      role: session.user.role,
      sessionTokenHash: session.tokenHash,
      session,
    };
    return true;
  }

  private canUseStaffLifecycleRoute(path: string): boolean {
    return ["/auth/me", "/auth/logout", "/auth/logout-all", "/auth/admin/password/change"].some((route) => path.endsWith(route));
  }
}