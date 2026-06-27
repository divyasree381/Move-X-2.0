import { Injectable, type PipeTransform } from "@nestjs/common";

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.sanitize(value, new WeakSet<object>());
  }

  private sanitize(value: unknown, seen: WeakSet<object>): unknown {
    if (typeof value === "string") {
      return this.sanitizeString(value);
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    if (seen.has(value)) {
      return undefined;
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, seen));
    }

    const output: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) {
        continue;
      }

      output[key] = this.sanitize(childValue, seen);
    }

    return output;
  }

  private sanitizeString(value: string): string {
    return value
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/<[^>]*>/g, "")
      .split(String.fromCharCode(0)).join("")
      .trim();
  }
}
