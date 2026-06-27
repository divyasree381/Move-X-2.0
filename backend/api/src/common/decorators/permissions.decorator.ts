import { SetMetadata } from "@nestjs/common";
import type { PermissionAction } from "@movex/shared";

export const PERMISSIONS_KEY = "movex:permissions";

export const RequirePermission = (...permissions: PermissionAction[]) => SetMetadata(PERMISSIONS_KEY, permissions);