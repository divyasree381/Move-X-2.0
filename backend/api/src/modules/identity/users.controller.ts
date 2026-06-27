import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiExtraModels } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { RequestWithUser } from "../../common/types/authenticated-request";
import { AddressDto, UpdateAddressDto } from "./dto/address.dto";
import { ApplyReferralDto, FavoriteDto, FavoritesQueryDto } from "./dto/retention.dto";
import { AdminUsersQueryDto } from "./dto/admin-users-query.dto";
import { BanUserDto } from "./dto/ban-user.dto";
import { PartnerLocationDto } from "./dto/location.dto";
import { PartnerOpsQueryDto, PartnerRoutePlanDto, PartnerShiftDto } from "./dto/partner-ops.dto";
import { PartnerOnlineDto } from "./dto/partner-online.dto";
import { PartnerProfileDto } from "./dto/partner-profile.dto";
import { PartnerReviewDto } from "./dto/partner-review.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import type { SessionRecord } from "./identity.types";
import { UsersService } from "./users.service";

@ApiExtraModels(
  AddressDto,
  AdminUsersQueryDto,
  BanUserDto,
  PartnerLocationDto,
  PartnerOnlineDto,
  PartnerOpsQueryDto,
  PartnerRoutePlanDto,
  PartnerShiftDto,
  PartnerProfileDto,
  PartnerReviewDto,
  UpdateAddressDto,
  UpdateProfileDto,
  ApplyReferralDto,
  FavoriteDto,
  FavoritesQueryDto,
)
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("me")
  @RequirePermission(PermissionAction.OwnProfileRead)
  me(@Req() request: RequestWithUser) {
    return this.usersService.getMe(this.getSession(request));
  }

  @Patch("me")
  @RequirePermission(PermissionAction.OwnProfileUpdate)
  updateMe(@Req() request: RequestWithUser, @Body() body: UpdateProfileDto) {
    return this.usersService.updateMe(this.getSession(request), body);
  }
  @Get("me/retention")
  @RequirePermission(PermissionAction.OwnProfileRead)
  retention(@Req() request: RequestWithUser) {
    return this.usersService.getRetentionSummary(this.getSession(request));
  }

  @Post("me/referral")
  @RequirePermission(PermissionAction.OwnProfileUpdate)
  applyReferral(@Req() request: RequestWithUser, @Body() body: ApplyReferralDto) {
    return this.usersService.applyReferral(this.getSession(request), body);
  }

  @Get("me/favorites")
  @RequirePermission(PermissionAction.OwnProfileRead)
  listFavorites(@Req() request: RequestWithUser, @Query() query: FavoritesQueryDto) {
    return this.usersService.listFavorites(this.getSession(request), query);
  }

  @Post("me/favorites")
  @RequirePermission(PermissionAction.OwnProfileUpdate)
  saveFavorite(@Req() request: RequestWithUser, @Body() body: FavoriteDto) {
    return this.usersService.saveFavorite(this.getSession(request), body);
  }

  @Delete("me/favorites")
  @RequirePermission(PermissionAction.OwnProfileUpdate)
  removeFavorite(@Req() request: RequestWithUser, @Body() body: FavoriteDto) {
    return this.usersService.removeFavorite(this.getSession(request), body);
  }

  @Get("me/addresses")
  @RequirePermission(PermissionAction.OwnAddressManage)
  listAddresses(@Req() request: RequestWithUser) {
    return this.usersService.listAddresses(this.getSession(request));
  }

  @Post("me/addresses")
  @RequirePermission(PermissionAction.OwnAddressManage)
  createAddress(@Req() request: RequestWithUser, @Body() body: AddressDto) {
    return this.usersService.createAddress(this.getSession(request), body);
  }

  @Patch("me/addresses/:addressId")
  @RequirePermission(PermissionAction.OwnAddressManage)
  updateAddress(@Req() request: RequestWithUser, @Param("addressId") addressId: string, @Body() body: UpdateAddressDto) {
    return this.usersService.updateAddress(this.getSession(request), addressId, body);
  }

  @Delete("me/addresses/:addressId")
  @RequirePermission(PermissionAction.OwnAddressManage)
  deleteAddress(@Req() request: RequestWithUser, @Param("addressId") addressId: string) {
    return this.usersService.deleteAddress(this.getSession(request), addressId);
  }

  @Patch("me/partner-profile")
  @RequirePermission(PermissionAction.PartnerProfileSubmit)
  submitPartnerProfile(@Req() request: RequestWithUser, @Body() body: PartnerProfileDto) {
    return this.usersService.submitPartnerProfile(this.getSession(request), body);
  }

  @Post("me/online")
  @RequirePermission(PermissionAction.PartnerOnlineUpdate)
  setOnline(@Req() request: RequestWithUser, @Body() body: PartnerOnlineDto) {
    return this.usersService.setOnline(this.getSession(request), body.isOnline);
  }

  @Post("me/location")
  @RequirePermission(PermissionAction.PartnerLocationUpdate)
  writeLocation(@Req() request: RequestWithUser, @Body() body: PartnerLocationDto) {
    return this.usersService.writeLocation(this.getSession(request), body);
  }
  @Get("me/partner-ops")
  @RequirePermission(PermissionAction.PartnerOnlineUpdate)
  partnerOps(@Req() request: RequestWithUser, @Query() query: PartnerOpsQueryDto) {
    return this.usersService.getPartnerOpsSummary(this.getSession(request), query);
  }

  @Get("me/partner-ops/shifts")
  @RequirePermission(PermissionAction.PartnerOnlineUpdate)
  listPartnerShifts(@Req() request: RequestWithUser, @Query() query: PartnerOpsQueryDto) {
    return this.usersService.listPartnerShifts(this.getSession(request), query);
  }

  @Post("me/partner-ops/shifts")
  @RequirePermission(PermissionAction.PartnerOnlineUpdate)
  createPartnerShift(@Req() request: RequestWithUser, @Body() body: PartnerShiftDto) {
    return this.usersService.createPartnerShift(this.getSession(request), body);
  }

  @Delete("me/partner-ops/shifts/:shiftId")
  @RequirePermission(PermissionAction.PartnerOnlineUpdate)
  cancelPartnerShift(@Req() request: RequestWithUser, @Param("shiftId") shiftId: string) {
    return this.usersService.cancelPartnerShift(this.getSession(request), shiftId);
  }

  @Post("me/partner-ops/route-plan")
  @RequirePermission(PermissionAction.PartnerOnlineUpdate)
  partnerRoutePlan(@Req() request: RequestWithUser, @Body() body: PartnerRoutePlanDto) {
    return this.usersService.getPartnerRoutePlan(this.getSession(request), body);
  }

  @Get("admin")
  @RequirePermission(PermissionAction.UsersRead)
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Post("admin/:userId/ban")
  @RequirePermission(PermissionAction.UsersBan)
  banUser(@Param("userId") userId: string, @Body() body: BanUserDto) {
    return this.usersService.banUser(userId, body.reason);
  }

  @Post("admin/:userId/unban")
  @RequirePermission(PermissionAction.UsersBan)
  unbanUser(@Param("userId") userId: string) {
    return this.usersService.unbanUser(userId);
  }

  @Get("admin/partners/pending")
  @RequirePermission(PermissionAction.PartnersReadPending)
  pendingPartners(@Query() query: AdminUsersQueryDto) {
    return this.usersService.listPendingPartners(query);
  }

  @Post("admin/partners/:userId/review")
  @RequirePermission(PermissionAction.PartnersReview)
  reviewPartner(@Param("userId") userId: string, @Body() body: PartnerReviewDto) {
    return this.usersService.reviewPartner(userId, body);
  }

  private getSession(request: RequestWithUser): SessionRecord {
    if (!request.user?.session) {
      throw new Error("Authenticated request is missing session context.");
    }

    return request.user.session;
  }
}