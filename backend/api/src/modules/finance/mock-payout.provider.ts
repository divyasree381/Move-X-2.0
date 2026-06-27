import { Injectable } from "@nestjs/common";
import { PayoutStatus } from "@prisma/client";

import type { PayoutProvider, PayoutTransferInput, PayoutTransferResult } from "./payout-provider";

@Injectable()
export class MockPayoutProvider implements PayoutProvider {
  async createTransfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    return {
      reference: `mock_payout_${input.payoutId}`,
      status: PayoutStatus.PROCESSING,
      message: "Sandbox payout queued",
    };
  }

  async inspectTransfer(reference: string): Promise<PayoutTransferResult> {
    return {
      reference,
      status: PayoutStatus.PAID,
      message: "Sandbox payout settled",
    };
  }
}