import type { PayoutStatus } from "@prisma/client";

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
  status: Extract<PayoutStatus, "PROCESSING" | "PAID" | "FAILED">;
  message?: string;
};

export interface PayoutProvider {
  createTransfer(input: PayoutTransferInput): Promise<PayoutTransferResult>;
  inspectTransfer(reference: string): Promise<PayoutTransferResult>;
}