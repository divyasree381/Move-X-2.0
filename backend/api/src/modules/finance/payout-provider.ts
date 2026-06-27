import { PayoutStatus } from "@prisma/client";

export const PAYOUT_PROVIDER = Symbol("PAYOUT_PROVIDER");

export type PayoutTransferInput = {
  payoutId: string;
  userId: string;
  amount: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
};

export type PayoutTransferResult = {
  reference: string;
  status: PayoutStatus.PROCESSING | PayoutStatus.PAID | PayoutStatus.FAILED;
  message?: string;
};

export interface PayoutProvider {
  createTransfer(input: PayoutTransferInput): Promise<PayoutTransferResult>;
  inspectTransfer(reference: string): Promise<PayoutTransferResult>;
}