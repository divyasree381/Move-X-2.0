import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser, RequestWithUser } from "../../common/types/authenticated-request";
import {
  ApplyCouponDto,
  CancelOrderDto,
  CartItemDto,
  CheckoutDto,
  OrdersQueryDto,
  OtpStatusDto,
  PrepTimeDto,
  PrescriptionUploadDto,
  PrescriptionVerificationDto,
  RatingDto,
  SubstitutionDecisionDto,
  SubstitutionProposalDto,
  UpdateCartQtyDto,
} from "./dto/orders.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Orders")
@ApiExtraModels(CartItemDto, UpdateCartQtyDto, ApplyCouponDto, PrescriptionUploadDto, CheckoutDto, OrdersQueryDto, PrepTimeDto, PrescriptionVerificationDto, SubstitutionProposalDto, SubstitutionDecisionDto, OtpStatusDto, CancelOrderDto, RatingDto)
@Controller({ version: "1" })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("cart")
  getCart(@Req() request: RequestWithUser) {
    return this.ordersService.getCart(this.getUser(request));
  }

  @Post("cart/items")
  addCartItem(@Req() request: RequestWithUser, @Body() body: CartItemDto) {
    return this.ordersService.addCartItem(this.getUser(request), body);
  }

  @Patch("cart/items/:menuItemId")
  updateCartQty(@Req() request: RequestWithUser, @Param("menuItemId") menuItemId: string, @Body() body: UpdateCartQtyDto) {
    return this.ordersService.updateCartQty(this.getUser(request), menuItemId, body);
  }

  @Delete("cart/items/:menuItemId")
  removeCartItem(@Req() request: RequestWithUser, @Param("menuItemId") menuItemId: string) {
    return this.ordersService.removeCartItem(this.getUser(request), menuItemId);
  }

  @Delete("cart")
  clearCart(@Req() request: RequestWithUser) {
    return this.ordersService.clearCart(this.getUser(request));
  }

  @Post("cart/coupon")
  applyCoupon(@Req() request: RequestWithUser, @Body() body: ApplyCouponDto) {
    return this.ordersService.applyCoupon(this.getUser(request), body);
  }

  @Delete("cart/coupon")
  removeCoupon(@Req() request: RequestWithUser) {
    return this.ordersService.removeCoupon(this.getUser(request));
  }


  @Post("cart/prescription")
  uploadPrescription(@Req() request: RequestWithUser, @Body() body: PrescriptionUploadDto) {
    return this.ordersService.uploadCartPrescription(this.getUser(request), body);
  }
  @Post("orders/checkout")
  checkout(@Req() request: RequestWithUser, @Body() body: CheckoutDto) {
    return this.ordersService.checkout(this.getUser(request), body);
  }



  @Post("orders/maintenance/auto-cancel")
  @RequirePermission(PermissionAction.UsersRead)
  autoCancelStaleOrders() {
    return this.ordersService.autoCancelStaleOrders();
  }
  @Get("orders/store/queue")
  listStoreQueue(@Req() request: RequestWithUser) {
    return this.ordersService.listStoreQueue(this.getUser(request));
  }


  @Post("orders/store/:orderId/prescription/verify")
  verifyPrescription(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: PrescriptionVerificationDto) {
    return this.ordersService.verifyPrescription(this.getUser(request), orderId, body);
  }

  @Post("orders/store/:orderId/substitutions")
  proposeSubstitutions(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: SubstitutionProposalDto) {
    return this.ordersService.proposeSubstitutions(this.getUser(request), orderId, body);
  }
  @Post("orders/store/:orderId/accept")
  acceptStoreOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: PrepTimeDto) {
    return this.ordersService.acceptStoreOrder(this.getUser(request), orderId, body);
  }

  @Post("orders/store/:orderId/prepare")
  prepareStoreOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: PrepTimeDto) {
    return this.ordersService.prepareStoreOrder(this.getUser(request), orderId, body);
  }

  @Post("orders/store/:orderId/ready")
  readyStoreOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: PrepTimeDto) {
    return this.ordersService.readyStoreOrder(this.getUser(request), orderId, body);
  }

  @Get("orders/delivery/queue")
  listDeliveryQueue(@Req() request: RequestWithUser) {
    return this.ordersService.listDeliveryQueue(this.getUser(request));
  }

  @Post("orders/delivery/:orderId/accept")
  acceptDeliveryOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string) {
    return this.ordersService.acceptDeliveryOrder(this.getUser(request), orderId);
  }

  @Post("orders/delivery/:orderId/pickup")
  pickupOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: OtpStatusDto) {
    return this.ordersService.pickupOrder(this.getUser(request), orderId, body);
  }

  @Post("orders/delivery/:orderId/deliver")
  deliverOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: OtpStatusDto) {
    return this.ordersService.deliverOrder(this.getUser(request), orderId, body);
  }


  @Post("orders/:orderId/substitutions")
  decideSubstitutions(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: SubstitutionDecisionDto) {
    return this.ordersService.decideSubstitutions(this.getUser(request), orderId, body);
  }
  @Post("orders/:orderId/cancel")
  cancelOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: CancelOrderDto) {
    return this.ordersService.cancelOrder(this.getUser(request), orderId, body);
  }

  @Post("orders/:orderId/rating")
  rateOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string, @Body() body: RatingDto) {
    return this.ordersService.rateOrder(this.getUser(request), orderId, body);
  }

  @Get("orders")
  listOrders(@Req() request: RequestWithUser, @Query() query: OrdersQueryDto) {
    return this.ordersService.listOrders(this.getUser(request), query);
  }

  @Get("orders/:orderId")
  getOrder(@Req() request: RequestWithUser, @Param("orderId") orderId: string) {
    return this.ordersService.getOrder(this.getUser(request), orderId);
  }

  private getUser(request: RequestWithUser): AuthenticatedUser {
    if (!request.user) {
      throw new Error("Authenticated request is missing user context.");
    }

    return request.user;
  }
}