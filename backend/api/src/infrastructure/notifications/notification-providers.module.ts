import { Module } from "@nestjs/common";

import { SmsModule } from "../sms/sms.module";
import { EMAIL_NOTIFICATION_PROVIDER, SMS_NOTIFICATION_PROVIDER } from "./notification-provider";
import { ResendEmailNotificationProvider } from "./resend-email.provider";
import { AdapterSmsNotificationProvider } from "./sms-notification.provider";

@Module({
  imports: [SmsModule],
  providers: [
    ResendEmailNotificationProvider,
    AdapterSmsNotificationProvider,
    {
      provide: EMAIL_NOTIFICATION_PROVIDER,
      useExisting: ResendEmailNotificationProvider,
    },
    {
      provide: SMS_NOTIFICATION_PROVIDER,
      useExisting: AdapterSmsNotificationProvider,
    },
  ],
  exports: [EMAIL_NOTIFICATION_PROVIDER, SMS_NOTIFICATION_PROVIDER],
})
export class NotificationProvidersModule {}