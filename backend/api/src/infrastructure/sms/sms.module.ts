import { Module } from "@nestjs/common";

import { HttpSmsProvider } from "./http-sms.provider";
import { MockSmsProvider } from "./mock-sms.provider";
import { SMS_PROVIDER } from "./sms-provider";

@Module({
  providers: [
    MockSmsProvider,
    HttpSmsProvider,
    {
      provide: SMS_PROVIDER,
      useFactory: (mock: MockSmsProvider, http: HttpSmsProvider) => (process.env.SMS_PROVIDER === "mock" ? mock : http),
      inject: [MockSmsProvider, HttpSmsProvider],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
