export type SettlementProviderRow = {
  providerPaymentId: string;
  amount: string;
  settledAt: string;
  referenceType?: string;
  referenceId?: string;
  raw?: Record<string, unknown>;
};

export type SettlementQuery = {
  from: Date;
  to: Date;
};

export const SETTLEMENT_PROVIDER = Symbol("SETTLEMENT_PROVIDER");

export interface SettlementProvider {
  listSettlements(query: SettlementQuery): Promise<SettlementProviderRow[]>;
}