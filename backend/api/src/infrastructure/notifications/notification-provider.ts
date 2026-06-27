export type EmailNotificationInput = {
  to: string;
  subject: string;
  html?: string;
  text: string;
  idempotencyKey?: string;
};

export type SmsNotificationInput = {
  phoneE164: string;
  message: string;
  idempotencyKey?: string;
};

export interface EmailNotificationProvider {
  sendEmail(input: EmailNotificationInput): Promise<void>;
}

export interface SmsNotificationProvider {
  sendSms(input: SmsNotificationInput): Promise<void>;
}

export const EMAIL_NOTIFICATION_PROVIDER = Symbol("EMAIL_NOTIFICATION_PROVIDER");
export const SMS_NOTIFICATION_PROVIDER = Symbol("SMS_NOTIFICATION_PROVIDER");