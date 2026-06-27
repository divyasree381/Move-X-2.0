import { Injectable } from "@nestjs/common";

import type { SendSmsInput, SmsProvider } from "./sms-provider";

@Injectable()
export class MockSmsProvider implements SmsProvider {
  async sendOtp(): Promise<void> {
    // Intentionally no-op. OTP delivery will be wired to a real provider behind this adapter.
  }

  async sendSms(_input: SendSmsInput): Promise<void> {
    // Intentionally no-op. Transactional SMS delivery will be wired behind this adapter.
  }
}