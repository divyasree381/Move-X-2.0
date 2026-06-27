import { BadRequestException } from "@nestjs/common";

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const DEFAULT_COUNTRY_CODE = "91";

export function normalizePhoneToE164(input: string): string {
  const value = input.trim();

  if (!value) {
    throw new BadRequestException("Invalid phone number");
  }

  if (value.startsWith("+")) {
    const normalized = `+${value.slice(1).replace(/\D/g, "")}`;
    return assertE164(normalized);
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return assertE164(`+${DEFAULT_COUNTRY_CODE}${digits}`);
  }

  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return assertE164(`+${digits}`);
  }

  return assertE164(`+${digits}`);
}

function assertE164(value: string): string {
  if (!E164_PATTERN.test(value)) {
    throw new BadRequestException("Invalid phone number");
  }

  return value;
}