import { Inject, Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser, RequestWithUser } from "../../common/types/authenticated-request";
import { AnalyticsQueryDto, FeatureFlagQueryDto, RefreshAnalyticsDto, SearchRebuildDto, UpsertFeatureFlagDto } from "./dto/platform.dto";
import { PlatformService } from "./platform.service";

@ApiTags("Platform")
@ApiExtraModels(AnalyticsQueryDto, RefreshAnalyticsDto, FeatureFlagQueryDto, UpsertFeatureFlagDto, SearchRebuildDto)
@Controller({ path: "platform", version: "1" })
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platformService: PlatformService) {}

  @Get("analytics")
  @RequirePermission(PermissionAction.PlatformAnalyticsRead)
  analytics(@Query() query: AnalyticsQueryDto) {
    return this.platformService.analytics(query);
  }

  @Post("analytics/refresh")
  @RequirePermission(PermissionAction.PlatformAnalyticsRead)
  refreshAnalytics(@Body() body: RefreshAnalyticsDto) {
    return this.platformService.refreshAnalytics(body);
  }

  @Get("feature-flags")
  @RequirePermission(PermissionAction.PlatformFeatureFlagsManage)
  listFeatureFlags(@Query() query: FeatureFlagQueryDto) {
    return this.platformService.listFeatureFlags(query);
  }

  @Put("feature-flags/:key")
  @RequirePermission(PermissionAction.PlatformFeatureFlagsManage)
  upsertFeatureFlag(@Req() request: RequestWithUser, @Param("key") key: string, @Body() body: UpsertFeatureFlagDto) {
    return this.platformService.upsertFeatureFlag(key, this.getUser(request), body);
  }

  @Post("search/rebuild")
  @RequirePermission(PermissionAction.PlatformSearchRebuildManage)
  requestSearchRebuild(@Req() request: RequestWithUser, @Body() body: SearchRebuildDto) {
    return this.platformService.requestSearchRebuild(this.getUser(request), body);
  }

  private getUser(request: RequestWithUser): AuthenticatedUser {
    if (!request.user) {
      throw new Error("Authenticated request is missing user context.");
    }
    return request.user;
  }
}
