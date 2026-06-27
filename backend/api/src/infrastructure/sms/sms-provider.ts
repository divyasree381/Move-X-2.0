export type SendOtpInput = {
  phoneE164: string;
  code: string;
  purpose: "LOGIN";
};

export type SendSmsInput = {
  phoneE164: string;
  message: string;
  idempotencyKey?: string;
};

export interface SmsProvider {
  sendOtp(input: SendOtpInput): Promise<void>;
  sendSms(input: SendSmsInput): Promise<void>;
}

export const SMS_PROVIDER = Symbol("SMS_PROVIDER");