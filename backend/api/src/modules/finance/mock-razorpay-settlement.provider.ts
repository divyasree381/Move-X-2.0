import { Injectable } from "@nestjs/common";

import type { SettlementProvider, SettlementProviderRow, SettlementQuery } from "./settlement-provider";

@Injectable()
export class MockRazorpaySettlementProvider implements SettlementProvider {
  async listSettlements(query: SettlementQuery): Promise<SettlementProviderRow[]> {
    void query;
    const raw = process.env.MOCK_RAZORPAY_SETTLEMENT_ROWS;
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((row) => this.normalize(row));
  }

  private normalize(row: unknown): SettlementProviderRow[] {
    if (!row || typeof row !== "object") {
      return [];
    }
    const record = row as Record<string, unknown>;
    const providerPaymentId = this.stringValue(record.providerPaymentId ?? record.paymentId ?? record.id);
    const amount = this.stringValue(record.amount ?? record.amountRupees ?? record.amountPaise);
    if (!providerPaymentId || !amount) {
      return [];
    }
    return [{ providerPaymentId, amount, settledAt: this.stringValue(record.settledAt) || new Date().toISOString(), referenceType: this.stringValue(record.referenceType), referenceId: this.stringValue(record.referenceId), raw: record }];
  }

  private stringValue(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return undefined;
  }
}