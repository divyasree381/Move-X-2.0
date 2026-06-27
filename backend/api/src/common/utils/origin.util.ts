const DEFAULT_ALLOWED_ORIGIN = "http://localhost:3000";

export function getAllowedOrigins(): Set<string> {
  const configured = [process.env.CORS_ORIGIN, process.env.WEB_ORIGIN]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const values = process.env.NODE_ENV === "production" ? configured : [...configured, DEFAULT_ALLOWED_ORIGIN];
  return new Set(values);
}

export function parseOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function isExactAllowedOrigin(origin: string | undefined): boolean {
  const parsed = parseOrigin(origin);
  return Boolean(parsed && getAllowedOrigins().has(parsed));
}
