import { Inject, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser, RequestWithUser } from "../../common/types/authenticated-request";
import {
  AuditQueryDto,
  ConfigQueryDto,
  CouponQueryDto,
  CreateTicketDto,
  DisputeActionDto,
  DisputeQueryDto,
  TicketMessageDto,
  TicketQueryDto,
  UpdateTicketDto,
  UpsertConfigDto,
  UpsertCouponDto,
} from "./dto/ops.dto";
import { OpsService } from "./ops.service";

@ApiTags("Ops")
@ApiExtraModels(CouponQueryDto, UpsertCouponDto, ConfigQueryDto, UpsertConfigDto, TicketQueryDto, CreateTicketDto, UpdateTicketDto, TicketMessageDto, DisputeQueryDto, DisputeActionDto, AuditQueryDto)
@Controller({ path: "ops", version: "1" })
export class OpsController {
  constructor(@Inject(OpsService) private readonly opsService: OpsService) {}

  @Get("coupons")
  @RequirePermission(PermissionAction.CouponsManage)
  listCoupons(@Query() query: CouponQueryDto) {
    return this.opsService.listCoupons(query);
  }

  @Post("coupons")
  @RequirePermission(PermissionAction.CouponsManage)
  createCoupon(@Body() body: UpsertCouponDto) {
    return this.opsService.createCoupon(body);
  }

  @Patch("coupons/:couponId")
  @RequirePermission(PermissionAction.CouponsManage)
  updateCoupon(@Param("couponId") couponId: string, @Body() body: UpsertCouponDto) {
    return this.opsService.updateCoupon(couponId, body);
  }

  @Delete("coupons/:couponId")
  @RequirePermission(PermissionAction.CouponsManage)
  deactivateCoupon(@Param("couponId") couponId: string) {
    return this.opsService.deactivateCoupon(couponId);
  }

  @Get("config")
  @RequirePermission(PermissionAction.SystemConfigManage)
  listConfig(@Query() query: ConfigQueryDto) {
    return this.opsService.listConfig(query);
  }

  @Put("config/:key")
  @RequirePermission(PermissionAction.SystemConfigManage)
  upsertConfig(@Param("key") key: string, @Body() body: UpsertConfigDto) {
    return this.opsService.upsertConfig(key, body);
  }

  @Get("support/tickets")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  listTickets(@Query() query: TicketQueryDto) {
    return this.opsService.listTickets(query);
  }

  @Post("support/tickets")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  createTicket(@Req() request: RequestWithUser, @Body() body: CreateTicketDto) {
    return this.opsService.createTicket(this.getUser(request), body);
  }

  @Get("support/tickets/:ticketId")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  getTicket(@Param("ticketId") ticketId: string) {
    return this.opsService.getTicket(ticketId);
  }

  @Patch("support/tickets/:ticketId")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  updateTicket(@Param("ticketId") ticketId: string, @Body() body: UpdateTicketDto) {
    return this.opsService.updateTicket(ticketId, body);
  }

  @Post("support/tickets/:ticketId/messages")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  addTicketMessage(@Req() request: RequestWithUser, @Param("ticketId") ticketId: string, @Body() body: TicketMessageDto) {
    return this.opsService.addTicketMessage(this.getUser(request), ticketId, body);
  }


  @Get("disputes")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  listDisputes(@Query() query: DisputeQueryDto) {
    return this.opsService.listDisputes(query);
  }

  @Get("disputes/:disputeId")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  getDispute(@Param("disputeId") disputeId: string) {
    return this.opsService.getDispute(disputeId);
  }

  @Post("disputes/:disputeId/actions")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  actionDispute(@Req() request: RequestWithUser, @Param("disputeId") disputeId: string, @Body() body: DisputeActionDto) {
    return this.opsService.actionDispute(this.getUser(request), disputeId, body);
  }

  @Post("disputes/:disputeId/resolve")
  @RequirePermission(PermissionAction.SupportTicketsManage)
  resolveDispute(@Req() request: RequestWithUser, @Param("disputeId") disputeId: string, @Body() body: DisputeActionDto) {
    return this.opsService.resolveDispute(this.getUser(request), disputeId, body);
  }
  @Get("audit")
  @RequirePermission(PermissionAction.AuditRead)
  listAuditLogs(@Query() query: AuditQueryDto) {
    return this.opsService.listAuditLogs(query);
  }

  private getUser(request: RequestWithUser): AuthenticatedUser {
    if (!request.user) {
      throw new Error("Authenticated request is missing user context.");
    }
    return request.user;
  }
}