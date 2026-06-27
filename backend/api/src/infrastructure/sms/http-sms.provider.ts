import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { SendOtpInput, SendSmsInput, SmsProvider } from "./sms-provider";

@Injectable()
export class HttpSmsProvider implements SmsProvider {
  async sendOtp(input: SendOtpInput): Promise<void> {
    await this.sendSms({ phoneE164: input.phoneE164, message: `Your MoveX ${input.purpose.toLowerCase()} OTP is ${input.code}. It expires in 5 minutes.` });
  }

  async sendSms(input: SendSmsInput): Promise<void> {
    const baseUrl = process.env.SMS_GATEWAY_URL;
    const apiKey = process.env.SMS_GATEWAY_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException("SMS gateway is not configured");
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: input.phoneE164, message: input.message, idempotencyKey: input.idempotencyKey }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("SMS gateway request failed");
    }
  }
}
