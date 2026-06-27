import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission, type PermissionAction } from "@movex/shared";

import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { RequestWithUser } from "../types/authenticated-request";
import { isPublicRoute } from "../utils/metadata.util";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<PermissionAction[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userRole = request.user?.role;

    if (!userRole || !requiredPermissions.every((permission) => hasPermission(userRole, permission))) {
      throw new ForbiddenException("Insufficient permission");
    }

    return true;
  }
}