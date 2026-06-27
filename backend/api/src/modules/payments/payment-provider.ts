export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export type PaymentOrderInput = {
  amountPaise: number;
  currency: "INR";
  receipt: string;
  notes: Record<string, string>;
};

export type PaymentProviderOrder = {
  id: string;
  amountPaise: number;
  currency: string;
  receipt: string;
  status: string;
};

export type RefundInput = {
  paymentId: string;
  amountPaise: number;
  notes: Record<string, string>;
};

export type PaymentProviderRefund = {
  id: string;
  paymentId: string;
  amountPaise: number;
  status: string;
};

export interface PaymentProvider {
  createOrder(input: PaymentOrderInput): Promise<PaymentProviderOrder>;
  createRefund(input: RefundInput): Promise<PaymentProviderRefund>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}