import { captureDevelopmentPayment, createPaymentOrder, type PaymentReferenceType } from "./api";

type RazorpayConstructor = new (options: Record<string, unknown>) => { open(): void };

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

export async function beginOnlinePayment(referenceType: PaymentReferenceType, referenceId: string): Promise<void> {
  const payment = await createPaymentOrder({ referenceType, referenceId, idempotencyKey: paymentKey(referenceType, referenceId) });

  if (payment.order.id.startsWith("order_mock_")) {
    await captureDevelopmentPayment({ referenceType, referenceId, razorpayOrderId: payment.order.id });
    return;
  }

  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!key) throw new Error("Online payment is temporarily unavailable");
  await loadRazorpay();
  if (!window.Razorpay) throw new Error("Payment checkout could not be loaded");

  await new Promise<void>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key,
      order_id: payment.order.id,
      amount: payment.amountPaise,
      currency: payment.currency,
      name: "MoveX",
      description: `${referenceType.replaceAll("_", " ")} payment`,
      handler: () => resolve(),
      modal: { ondismiss: () => reject(new Error("Payment was cancelled")) },
      theme: { color: "#059669" },
    });
    checkout.open();
  });
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Payment checkout could not be loaded"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function paymentKey(referenceType: PaymentReferenceType, referenceId: string): string {
  const storageKey = `movex:payment:${referenceType}:${referenceId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(storageKey, value);
  return value;
}
