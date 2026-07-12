import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { SensitiveDataService } from "../../common/security/sensitive-data.service";
import { PaymentsModule } from "../payments/payments.module";
import { FinanceController } from "./finance.controller";
import { FinanceSurfaceService } from "./finance-surface.service";
import { MockPayoutProvider } from "./mock-payout.provider";
import { MockRazorpaySettlementProvider } from "./mock-razorpay-settlement.provider";
import { PAYOUT_PROVIDER } from "./payout-provider";
import { SETTLEMENT_PROVIDER } from "./settlement-provider";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [FinanceController],
  providers: [
    FinanceSurfaceService,
    MockPayoutProvider,
    MockRazorpaySettlementProvider,
    SensitiveDataService,
    {
      provide: PAYOUT_PROVIDER,
      useExisting: MockPayoutProvider,
    },
    {
      provide: SETTLEMENT_PROVIDER,
      useExisting: MockRazorpaySettlementProvider,
    },
  ],
})
export class FinanceModule {}
