import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { PaymentOrderInput, PaymentProvider, PaymentProviderOrder, PaymentProviderRefund, RefundInput } from "./payment-provider";

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

type RazorpayRefundResponse = {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
};

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  async createOrder(input: PaymentOrderInput): Promise<PaymentProviderOrder> {
    if (this.canUseMockProvider()) {
      return {
        id: `order_mock_${randomUUID()}`,
        amountPaise: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        status: "created",
      };
    }

    const response = await this.razorpayJson<RazorpayOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      }),
    });

    return {
      id: response.id,
      amountPaise: response.amount,
      currency: response.currency,
      receipt: response.receipt,
      status: response.status,
    };
  }

  async createRefund(input: RefundInput): Promise<PaymentProviderRefund> {
    if (this.canUseMockProvider()) {
      return {
        id: `rfnd_mock_${randomUUID()}`,
        paymentId: input.paymentId,
        amountPaise: input.amountPaise,
        status: "processed",
      };
    }

    const response = await this.razorpayJson<RazorpayRefundResponse>(`/payments/${input.paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountPaise,
        notes: input.notes,
      }),
    });

    return {
      id: response.id,
      paymentId: response.payment_id,
      amountPaise: response.amount,
      status: response.status,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return false;
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");

    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private async razorpayJson<T>(path: string, init: RequestInit): Promise<T> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException("Razorpay is not configured");
    }

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${RAZORPAY_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("Razorpay request failed");
    }

    return (await response.json()) as T;
  }

  private canUseMockProvider(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.PAYMENT_PROVIDER === "mock";
  }
}