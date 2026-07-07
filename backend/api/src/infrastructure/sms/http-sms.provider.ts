import * as https from "https";
import type { IncomingMessage } from "http";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import type { SendOtpInput, SendSmsInput, SmsProvider } from "./sms-provider";

@Injectable()
export class HttpSmsProvider implements SmsProvider {
  private readonly logger = new Logger(HttpSmsProvider.name);

  async sendOtp(input: SendOtpInput): Promise<void> {
    // Exact template string matching DLT requirements
    const message = `Welcome to NighaTech Global Your OTP for authentication is ${input.code} don't share with anybody Thank you`;
    await this.sendSms({ phoneE164: input.phoneE164, message });
  }

  async sendSms(input: SendSmsInput): Promise<void> {
    const baseUrl = process.env.SMS_GATEWAY_URL || "https://43.252.88.250/index.php/smsapi/httpapi/";
    const secret = process.env.SMS_GATEWAY_SECRET;
    const sender = process.env.SMS_GATEWAY_SENDER || "NIGHAI";
    const tempid = process.env.SMS_GATEWAY_TEMPID || "1207174264191607433";

    if (!secret) {
      this.logger.error("SMS_GATEWAY_SECRET is not configured in .env");
      throw new ServiceUnavailableException("SMS gateway is not configured");
    }

    // Format receiver number. If it starts with +91, remove it for local Indian numbers 
    // as shown in the example `receiver=8297808410`.
    let receiver = input.phoneE164.replace('+', '');
    if (receiver.startsWith('91') && receiver.length === 12) {
      receiver = receiver.substring(2);
    }

    const url = new URL(baseUrl);
    url.searchParams.append("secret", secret);
    url.searchParams.append("sender", sender);
    url.searchParams.append("tempid", tempid);
    url.searchParams.append("receiver", receiver);
    url.searchParams.append("route", "TA");
    url.searchParams.append("msgtype", "1");
    url.searchParams.append("sms", input.message);

    try {
      const responseText = await new Promise<string>((resolve, reject) => {
        const req = https.get(url.toString(), (res: IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer) => data += chunk.toString());
          res.on('end', () => {
            const statusCode = res.statusCode ?? 500;

            if (statusCode >= 200 && statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Status: ${statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.end();
      });

      this.logger.debug(`Successfully sent SMS to ${receiver}. Provider response: ${responseText}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${receiver}`, error);
      throw new ServiceUnavailableException("SMS gateway request failed");
    }
  }
}
