import { Controller, Get } from "@nestjs/common";
import type { ApiEnvelope } from "@movex/shared";

import { Public } from "../../common/decorators/public.decorator";

type HealthResponse = NonNullable<ApiEnvelope<{ status: "ok" }>["data"]>;

@Public()
@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok" };
  }
}