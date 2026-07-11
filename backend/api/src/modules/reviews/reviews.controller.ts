import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { Public } from "../../common/decorators/public.decorator";
import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { ReviewModerationDto, ReviewsQueryDto } from "./dto/reviews.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("Reviews")
@Controller({ version: "1" })
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Public()
  @Get("reviews")
  listPublic(@Query() query: ReviewsQueryDto) {
    return this.reviews.listPublic(query);
  }

  @Get("ops/reviews")
  @RequirePermission(PermissionAction.ReviewsModerate)
  listForModeration(@Query() query: ReviewsQueryDto) {
    return this.reviews.listForModeration(query);
  }

  @Patch("ops/reviews/:reviewId")
  @RequirePermission(PermissionAction.ReviewsModerate)
  moderate(@Param("reviewId") reviewId: string, @Body() body: ReviewModerationDto) {
    return this.reviews.moderate(reviewId, body);
  }
}
