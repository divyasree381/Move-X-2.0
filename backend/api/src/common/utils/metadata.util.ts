import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]) === true;
}
