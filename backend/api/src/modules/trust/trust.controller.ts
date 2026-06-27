import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser, RequestWithUser } from "../../common/types/authenticated-request";
import { CancellationPolicyQueryDto, OpenDisputeDto } from "./dto/trust.dto";
import { TrustService } from "./trust.service";

@ApiTags("Trust")
@ApiExtraModels(CancellationPolicyQueryDto, OpenDisputeDto)
@Controller({ path: "trust", version: "1" })
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Get("cancellation-policy")
  @RequirePermission(PermissionAction.OwnProfileRead)
  cancellationPolicy(@Query() query: CancellationPolicyQueryDto) {
    return this.trustService.cancellationPolicy(query);
  }

  @Post("disputes")
  @RequirePermission(PermissionAction.OwnProfileRead)
  openDispute(@Req() request: RequestWithUser, @Body() body: OpenDisputeDto) {
    return this.trustService.openDispute(this.getUser(request), body);
  }

  private getUser(request: RequestWithUser): AuthenticatedUser {
    if (!request.user) {
      throw new Error("Authenticated request is missing user context.");
    }
    return request.user;
  }
}