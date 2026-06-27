import { BadRequestException, Controller, Get } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../../common/decorators/public.decorator";

@Controller("sample")
export class SampleController {
  @Public()
  @Get("public")
  getPublicSample() {
    return { message: "public ok" };
  }

  @Public()
  @Get("error")
  getPublicError(): never {
    throw new BadRequestException("sample error");
  }

  @Public()
  @Throttle({ default: { limit: 2, ttl: 60_000, blockDuration: 60_000 } })
  @Get("throttle")
  getThrottledSample() {
    return { message: "throttle ok" };
  }

  @Get("protected")
  getProtectedSample() {
    return { message: "protected ok" };
  }
}