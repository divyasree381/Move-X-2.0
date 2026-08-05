import { Injectable, Logger } from "@nestjs/common";

import type { SendOtpInput, SendSmsInput, SmsProvider } from "./sms-provider";

@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendOtp(input: SendOtpInput): Promise<void> {
    this.logger.log(`[MOCK SMS] OTP for ${input.phoneE164} is: ${input.code}`);
  }

  async sendSms(input: SendSmsInput): Promise<void> {
    this.logger.log(`[MOCK SMS] SMS to ${input.phoneE164}: ${input.message}`);
  }
}