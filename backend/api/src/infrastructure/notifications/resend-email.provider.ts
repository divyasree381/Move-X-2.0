import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { EmailNotificationInput, EmailNotificationProvider } from "./notification-provider";

const RESEND_API_URL = "https://api.resend.com/emails";

@Injectable()
export class ResendEmailNotificationProvider implements EmailNotificationProvider {
  async sendEmail(input: EmailNotificationInput): Promise<void> {
    if (this.canUseMockProvider()) {
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_EMAIL_FROM;

    if (!apiKey || !from) {
      throw new ServiceUnavailableException("Email notification provider is not configured");
    }

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("Email notification request failed");
    }
  }

  private canUseMockProvider(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.EMAIL_PROVIDER === "mock";
  }
}