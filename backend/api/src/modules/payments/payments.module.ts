import { Module } from "@nestjs/common";

import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { FinanceService } from "./finance.service";
import { PAYMENT_PROVIDER } from "./payment-provider";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RazorpayProvider } from "./razorpay.provider";

@Module({
  imports: [PrismaModule, RedisStoreModule],
  controllers: [PaymentsController],
  providers: [
    FinanceService,
    PaymentsService,
    RazorpayProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: RazorpayProvider,
    },
  ],
  exports: [FinanceService, PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}