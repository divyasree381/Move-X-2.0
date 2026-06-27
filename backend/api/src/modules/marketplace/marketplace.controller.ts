import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser, RequestWithUser } from "../../common/types/authenticated-request";
import {
  MenuItemDto,
  StoreListQueryDto,
  StoreOpenDto,
  StoreReviewDto,
  StoreSearchQueryDto,
  UpdateMenuItemDto,
  UpsertStoreDto,
} from "./dto/marketplace.dto";
import { MarketplaceService } from "./marketplace.service";

@ApiTags("Marketplace")
@ApiExtraModels(StoreListQueryDto, StoreSearchQueryDto, UpsertStoreDto, StoreOpenDto, StoreReviewDto, MenuItemDto, UpdateMenuItemDto)
@Controller({ path: "stores", version: "1" })
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Public()
  @Get()
  listStores(@Query() query: StoreListQueryDto) {
    return this.marketplaceService.listStores(query);
  }

  @Public()
  @Get("search")
  searchStores(@Query() query: StoreSearchQueryDto) {
    return this.marketplaceService.searchStores(query);
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Post("partner")
  createStore(@Req() request: RequestWithUser, @Body() body: UpsertStoreDto) {
    return this.marketplaceService.createStore(this.getUser(request), body);
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Patch("partner")
  updateStore(@Req() request: RequestWithUser, @Body() body: UpsertStoreDto) {
    return this.marketplaceService.updateMyStore(this.getUser(request), body);
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Post("partner/open")
  setStoreOpen(@Req() request: RequestWithUser, @Body() body: StoreOpenDto) {
    return this.marketplaceService.setMyStoreOpen(this.getUser(request), body);
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Post("partner/request-approval")
  requestApproval(@Req() request: RequestWithUser) {
    return this.marketplaceService.requestApproval(this.getUser(request));
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Post("partner/menu-items")
  createMenuItem(@Req() request: RequestWithUser, @Body() body: MenuItemDto) {
    return this.marketplaceService.createMenuItem(this.getUser(request), body);
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Patch("partner/menu-items/:itemId")
  updateMenuItem(@Req() request: RequestWithUser, @Param("itemId") itemId: string, @Body() body: UpdateMenuItemDto) {
    return this.marketplaceService.updateMenuItem(this.getUser(request), itemId, body);
  }

  @RequirePermission(PermissionAction.StoreManage)
  @Delete("partner/menu-items/:itemId")
  deleteMenuItem(@Req() request: RequestWithUser, @Param("itemId") itemId: string) {
    return this.marketplaceService.deleteMenuItem(this.getUser(request), itemId);
  }

  @RequirePermission(PermissionAction.StoreReview)
  @Get("admin/pending")
  listPendingStores(@Query() query: StoreListQueryDto) {
    return this.marketplaceService.listPendingStores(query);
  }

  @RequirePermission(PermissionAction.StoreReview)
  @Post("admin/:storeId/review")
  reviewStore(@Param("storeId") storeId: string, @Body() body: StoreReviewDto) {
    return this.marketplaceService.reviewStore(storeId, body);
  }

  @RequirePermission(PermissionAction.StoreReview)
  @Post("admin/:storeId/suspend")
  suspendStore(@Param("storeId") storeId: string) {
    return this.marketplaceService.suspendStore(storeId);
  }

  @Public()
  @Get(":storeId/menu")
  getMenu(@Param("storeId") storeId: string) {
    return this.marketplaceService.getMenu(storeId);
  }

  @Public()
  @Get(":storeId")
  getStore(@Param("storeId") storeId: string) {
    return this.marketplaceService.getStore(storeId);
  }

  private getUser(request: RequestWithUser): AuthenticatedUser {
    if (!request.user) {
      throw new Error("Authenticated request is missing user context.");
    }

    return request.user;
  }
}