import { Inject, Injectable } from "@nestjs/common";

import { SMS_PROVIDER, type SmsProvider } from "../sms/sms-provider";
import type { SmsNotificationInput, SmsNotificationProvider } from "./notification-provider";

@Injectable()
export class AdapterSmsNotificationProvider implements SmsNotificationProvider {
  constructor(@Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider) {}

  sendSms(input: SmsNotificationInput): Promise<void> {
    return this.smsProvider.sendSms(input);
  }
}