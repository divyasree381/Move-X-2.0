import { Inject, Body, Controller, Headers, Post, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";
import type { Request } from "express";

import { Public } from "../../common/decorators/public.decorator";
import { RequirePermission } from "../../common/decorators/permissions.decorator";
import type { RequestWithUser } from "../../common/types/authenticated-request";
import { CreatePaymentOrderDto, CreateRefundDto, MockCaptureDto } from "./dto/payments.dto";
import { PaymentsService } from "./payments.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags("Payments")
@ApiExtraModels(CreatePaymentOrderDto, CreateRefundDto, MockCaptureDto)
@Controller({ path: "payments", version: "1" })
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Post("orders")
  createPaymentOrder(@Req() request: RequestWithUser, @Body() body: CreatePaymentOrderDto) {
    if (!request.user?.session) {
      throw new Error("Authenticated request is missing session context.");
    }

    return this.paymentsService.createPaymentOrder(request.user.session, body);
  }

  @Post("refunds")
  @RequirePermission(PermissionAction.PaymentRefundCreate)
  createRefund(@Body() body: CreateRefundDto) {
    return this.paymentsService.createRefund(body);
  }

  @Public()
  @Post("webhooks/razorpay")
  razorpayWebhook(
    @Req() request: RawBodyRequest,
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Body() body: unknown,
  ) {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(body));
    return this.paymentsService.processRazorpayWebhook(rawBody, signature, body);
  }

  @Public()
  @Post("mock-capture")
  mockCapture(@Body() body: MockCaptureDto) {
    return this.paymentsService.mockCapture(body);
  }
}