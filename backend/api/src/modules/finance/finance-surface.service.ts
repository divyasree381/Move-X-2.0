import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, InvoiceType, LedgerEntryType, PaymentMethod, PayoutStatus, Prisma, ReconciliationReportStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FinanceService as PaymentFinanceService } from "../payments/finance.service";
import type { PaymentReferenceType } from "../payments/dto/payments.dto";
import type { GenerateInvoiceDto, GenerateReconciliationDto, InvoiceQueryDto, LedgerQueryDto, MarkPayoutDto, PayoutQueryDto, PayoutSweepDto, ReconciliationQueryDto, WalletAdjustmentDto } from "./dto/finance.dto";
import { PAYOUT_PROVIDER, type PayoutProvider } from "./payout-provider";
import { SETTLEMENT_PROVIDER, type SettlementProvider, type SettlementProviderRow } from "./settlement-provider";

type PrismaTx = Prisma.TransactionClient | PrismaService;

type BankDetails = {
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
};

const PARTNER_ROLES = [UserRole.RESTAURANT, UserRole.DELIVERY, UserRole.DRIVER] as const;
const PAYOUTABLE_TYPES = [LedgerEntryType.CREDIT, LedgerEntryType.ADJUSTMENT] as const;
const ZERO_DECIMAL = new Prisma.Decimal(0);

@Injectable()
export class FinanceSurfaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentFinance: PaymentFinanceService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
    @Inject(SETTLEMENT_PROVIDER) private readonly settlementProvider: SettlementProvider,
  ) {}

  async listLedger(query: LedgerQueryDto) {
    const limit = query.limit ?? 25;
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.userRole ? { userRole: query.userRole } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
        ...(query.isSettled !== undefined ? { isSettled: query.isSettled } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.rideId ? { rideId: query.rideId } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { user: { select: { id: true, role: true, name: true, email: true, phoneE164: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = entries.slice(0, limit);
    return { items: page.map((entry) => this.serializeLedgerEntry(entry)), nextCursor: entries.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async inspectLedgerEntry(entryId: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      include: { user: { select: { id: true, role: true, name: true, email: true, phoneE164: true } }, order: { select: { id: true, status: true, paymentStatus: true, total: true } }, ride: { select: { id: true, status: true, paymentStatus: true, estimatedFare: true, finalFare: true } } },
    });

    if (!entry) {
      throw new NotFoundException("Ledger entry not found");
    }

    return this.serializeLedgerEntry(entry);
  }

  async adjustWallet(body: WalletAdjustmentDto) {
    const paymentId = body.idempotencyKey ? `wallet_adjustment:${body.idempotencyKey}` : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (paymentId) {
        const existing = await tx.ledgerEntry.findFirst({ where: { paymentId } });
        if (existing) {
          const balance = await this.computeWalletBalanceInTx(tx, existing.userId);
          return { entry: this.serializeLedgerEntry(existing), balance: balance.toString(), duplicate: true };
        }
      }

      const user = await tx.user.findUnique({ where: { id: body.userId }, select: { id: true, role: true } });
      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (body.amount === 0) {
        throw new BadRequestException("Wallet adjustment amount cannot be zero");
      }

      const amount = new Prisma.Decimal(Math.abs(body.amount)).toDecimalPlaces(2);
      const entry = await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          userRole: user.role,
          type: body.amount > 0 ? LedgerEntryType.ADJUSTMENT : LedgerEntryType.DEBIT,
          amount,
          description: body.description,
          paymentMethod: PaymentMethod.WALLET,
          paymentId,
        },
      });
      const balance = await this.reconcileWalletBalanceInTx(tx, user.id);
      return { entry: this.serializeLedgerEntry(entry), balance: balance.toString(), duplicate: false };
    });
  }

  async sweepPayouts(body: PayoutSweepDto) {
    if (body.userRole && !this.isPartnerRole(body.userRole)) {
      throw new BadRequestException("Payout sweeps are only available for partner roles");
    }

    const idempotencyKey = body.idempotencyKey ? `finance:payout-sweep:${body.idempotencyKey}` : undefined;
    const created = await this.withSerializableRetry(() =>
      this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
          const previous = await tx.systemConfig.findUnique({ where: { key: idempotencyKey } });
          if (previous && previous.value && typeof previous.value === "object" && !Array.isArray(previous.value)) {
            return previous.value as { payoutIds: string[]; duplicate: true };
          }
        }

        const entries = await tx.ledgerEntry.findMany({
          where: {
            isSettled: false,
            type: { in: [...PAYOUTABLE_TYPES] },
            userRole: { in: body.userRole ? [body.userRole] : [...PARTNER_ROLES] },
            ...(body.userId ? { userId: body.userId } : {}),
          },
          orderBy: { createdAt: "asc" },
        });

        const groups = new Map<string, { userId: string; userRole: UserRole; amount: Prisma.Decimal; entryIds: string[] }>();
        for (const entry of entries) {
          const group = groups.get(entry.userId) ?? { userId: entry.userId, userRole: entry.userRole, amount: ZERO_DECIMAL, entryIds: [] };
          group.amount = group.amount.plus(entry.amount);
          group.entryIds.push(entry.id);
          groups.set(entry.userId, group);
        }

        const payoutIds: string[] = [];
        for (const group of groups.values()) {
          if (group.amount.lessThanOrEqualTo(ZERO_DECIMAL)) {
            continue;
          }

          const bank = await this.resolveBankDetails(tx, group.userId);
          const payout = await tx.payout.create({
            data: {
              userId: group.userId,
              userRole: group.userRole,
              amount: group.amount,
              status: PayoutStatus.PENDING,
              ...bank,
            },
          });
          const updated = await tx.ledgerEntry.updateMany({ where: { id: { in: group.entryIds }, isSettled: false }, data: { isSettled: true } });

          if (updated.count !== group.entryIds.length) {
            throw new ConflictException("Ledger entries changed during payout sweep");
          }

          await tx.outboxEvent.create({ data: { type: "payout.created", payload: { payoutId: payout.id, userId: group.userId, amount: group.amount.toString() } } });
          payoutIds.push(payout.id);
        }

        if (idempotencyKey) {
          await tx.systemConfig.create({ data: { key: idempotencyKey, value: { payoutIds }, description: "Finance payout sweep idempotency record" } });
        }

        return { payoutIds, duplicate: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );

    const payouts = await Promise.all(created.payoutIds.map((payoutId) => this.queuePayout(payoutId)));
    return { duplicate: created.duplicate, items: payouts };
  }

  async listPayouts(query: PayoutQueryDto) {
    const limit = query.limit ?? 25;
    const payouts = await this.prisma.payout.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.userRole ? { userRole: query.userRole } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { user: { select: { id: true, role: true, name: true, email: true, phoneE164: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = payouts.slice(0, limit);
    return { items: page.map((payout) => this.serializePayout(payout)), nextCursor: payouts.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async markPayout(payoutId: string, body: MarkPayoutDto) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      throw new NotFoundException("Payout not found");
    }

    if (body.status) {
      const updated = await this.prisma.payout.update({ where: { id: payoutId }, data: { status: body.status, reference: body.reference ?? payout.reference } });
      return this.serializePayout(updated);
    }

    if (payout.status === PayoutStatus.PENDING) {
      return this.queuePayout(payout.id);
    }

    if (!payout.reference) {
      throw new BadRequestException("Payout has no provider reference to inspect");
    }

    const result = await this.payoutProvider.inspectTransfer(payout.reference);
    const updated = await this.prisma.payout.update({ where: { id: payoutId }, data: { status: result.status, reference: result.reference } });
    return this.serializePayout(updated);
  }

  async listInvoices(query: InvoiceQueryDto) {
    const limit = query.limit ?? 25;
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.referenceId ? { referenceId: query.referenceId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { customer: { select: { id: true, role: true, name: true, email: true, phoneE164: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = invoices.slice(0, limit);
    return { items: page.map((invoice) => this.serializeInvoice(invoice)), nextCursor: invoices.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async generateInvoice(body: GenerateInvoiceDto) {
    const reference = await this.paymentFinance.derivePaymentReference(body.referenceType as PaymentReferenceType, body.referenceId);
    const customer = await this.prisma.user.findUnique({ where: { id: reference.customerId }, select: { id: true, name: true, email: true, phoneE164: true } });

    if (!customer) {
      throw new NotFoundException("Invoice customer not found");
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        customerId: customer.id,
        recipient: body.recipient ?? this.defaultRecipient(customer),
        type: body.referenceType as InvoiceType,
        referenceId: body.referenceId,
        amount: reference.payableAmount,
        taxBreakdown: body.taxBreakdown ?? {},
        status: InvoiceStatus.ISSUED,
      },
      include: { customer: { select: { id: true, role: true, name: true, email: true, phoneE164: true } } },
    });

    return this.serializeInvoice(invoice);
  }

  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: { select: { id: true, role: true, name: true, email: true, phoneE164: true } } } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return this.serializeInvoice(invoice);
  }

  async invoiceHtml(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: { select: { id: true, name: true, email: true, phoneE164: true } } } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const recipient = this.recordFromJson(invoice.recipient);
    const taxes = this.recordFromJson(invoice.taxBreakdown);
    const rows = Object.entries(taxes).map(([key, value]) => `<tr><td>${this.escapeHtml(key)}</td><td>${this.escapeHtml(String(value))}</td></tr>`).join("");

    return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${this.escapeHtml(invoice.invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:32px}.panel{border:1px solid #d1d5db;border-radius:8px;padding:24px;max-width:760px}h1{margin:0 0 8px;font-size:24px}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #d1d5db;padding:10px;text-align:left}.total{font-weight:700}</style></head><body><main class="panel"><h1>Invoice ${this.escapeHtml(invoice.invoiceNumber)}</h1><p class="muted">${this.escapeHtml(invoice.type)} reference ${this.escapeHtml(invoice.referenceId)}</p><section class="grid"><div><h2>Bill To</h2><p>${this.escapeHtml(String(recipient.name ?? invoice.customer.name ?? "Customer"))}</p><p>${this.escapeHtml(String(recipient.email ?? invoice.customer.email ?? ""))}</p><p>${this.escapeHtml(String(recipient.phone ?? invoice.customer.phoneE164 ?? ""))}</p></div><div><h2>Details</h2><p>Status: ${this.escapeHtml(invoice.status)}</p><p>Date: ${this.escapeHtml(invoice.createdAt.toISOString())}</p></div></section><table><tbody><tr><th>Description</th><td>${this.escapeHtml(invoice.type)} service charge</td></tr><tr><th>Amount</th><td>${this.escapeHtml(invoice.amount.toString())}</td></tr>${rows}<tr class="total"><th>Total</th><td>${this.escapeHtml(invoice.amount.toString())}</td></tr></tbody></table></main></body></html>`;
  }
  async listReconciliationReports(query: ReconciliationQueryDto) {
    const limit = query.limit ?? 25;
    const reports = await this.prisma.paymentReconciliationReport.findMany({
      where: {
        ...(query.status ? { status: query.status as ReconciliationReportStatus } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = reports.slice(0, limit);
    return { items: page.map((report) => this.serializeReconciliationReport(report)), nextCursor: reports.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async generateReconciliationReport(body: GenerateReconciliationDto) {
    const from = new Date(body.from);
    const to = new Date(body.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new BadRequestException("Invalid reconciliation window");
    }

    const providerRows = body.providerRows ? this.normalizeSettlementRows(body.providerRows) : await this.settlementProvider.listSettlements({ from, to });
    const paymentIds = [...new Set(providerRows.map((row) => row.providerPaymentId))];
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        paymentMethod: PaymentMethod.ONLINE,
        paymentId: { not: null },
        createdAt: { gte: from, lt: to },
      },
      orderBy: { createdAt: "asc" },
    });

    const ledgerByPayment = new Map<string, { amount: Prisma.Decimal; entryIds: string[] }>();
    for (const entry of ledgerEntries) {
      if (!entry.paymentId) continue;
      const current = ledgerByPayment.get(entry.paymentId) ?? { amount: ZERO_DECIMAL, entryIds: [] };
      current.amount = current.amount.plus(entry.amount);
      current.entryIds.push(entry.id);
      ledgerByPayment.set(entry.paymentId, current);
    }

    const rows = providerRows.map((row) => {
      const providerAmount = new Prisma.Decimal(row.amount).toDecimalPlaces(2);
      const ledger = ledgerByPayment.get(row.providerPaymentId);
      const ledgerAmount = ledger?.amount ?? ZERO_DECIMAL;
      const matched = Boolean(ledger) && providerAmount.equals(ledgerAmount);
      return { providerPaymentId: row.providerPaymentId, providerAmount: providerAmount.toString(), ledgerAmount: ledgerAmount.toString(), ledgerEntryIds: ledger?.entryIds ?? [], matched, referenceType: row.referenceType ?? null, referenceId: row.referenceId ?? null, settledAt: row.settledAt };
    });

    const providerIdSet = new Set(paymentIds);
    const missingProviderRows = [...ledgerByPayment.entries()]
      .filter(([paymentId]) => !providerIdSet.has(paymentId))
      .map(([paymentId, ledger]) => ({ providerPaymentId: paymentId, providerAmount: "0", ledgerAmount: ledger.amount.toString(), ledgerEntryIds: ledger.entryIds, matched: false, mismatchType: "LEDGER_MISSING_PROVIDER" }));
    const mismatches = [
      ...rows.filter((row) => !row.matched).map((row) => ({ ...row, mismatchType: row.ledgerEntryIds.length ? "AMOUNT_MISMATCH" : "PROVIDER_MISSING_LEDGER" })),
      ...missingProviderRows,
    ];
    const providerTotal = rows.reduce((sum, row) => sum.plus(row.providerAmount), ZERO_DECIMAL);
    const ledgerTotal = [...ledgerByPayment.values()].reduce((sum, row) => sum.plus(row.amount), ZERO_DECIMAL);

    const report = await this.prisma.paymentReconciliationReport.create({
      data: {
        provider: "RAZORPAY",
        status: mismatches.length > 0 ? ReconciliationReportStatus.HAS_MISMATCHES : ReconciliationReportStatus.CLEAR,
        from,
        to,
        providerTotal,
        ledgerTotal,
        mismatchCount: mismatches.length,
        matchedCount: rows.length - rows.filter((row) => !row.matched).length,
        rows: rows as Prisma.InputJsonValue,
        mismatches: mismatches as Prisma.InputJsonValue,
      },
    });

    return this.serializeReconciliationReport(report);
  }

  private async queuePayout(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      throw new NotFoundException("Payout not found");
    }

    if (payout.status !== PayoutStatus.PENDING) {
      return this.serializePayout(payout);
    }

    const result = await this.payoutProvider.createTransfer({
      payoutId: payout.id,
      userId: payout.userId,
      amount: payout.amount.toString(),
      bankAccountName: payout.bankAccountName,
      bankAccountNumber: payout.bankAccountNumber,
      bankIfsc: payout.bankIfsc,
    });
    const updated = await this.prisma.payout.update({ where: { id: payout.id }, data: { status: result.status, reference: result.reference } });
    return this.serializePayout(updated);
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!this.isPrismaRetryableWriteConflict(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }


  private isPrismaRetryableWriteConflict(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String((error as { code?: unknown }).code)));
  }
  private async resolveBankDetails(tx: PrismaTx, userId: string): Promise<BankDetails> {
    const store = await tx.store.findFirst({ where: { ownerId: userId }, select: { bankAccount: true } });
    const bank = this.recordFromJson(store?.bankAccount ?? null);
    return {
      bankAccountName: this.stringOrFallback(bank.accountName ?? bank.bankAccountName, "MoveX Sandbox Partner"),
      bankAccountNumber: this.stringOrFallback(bank.accountNumber ?? bank.bankAccountNumber, "0000000000"),
      bankIfsc: this.stringOrFallback(bank.ifsc ?? bank.bankIfsc, "MOCK0000001"),
    };
  }

  private async reconcileWalletBalanceInTx(tx: PrismaTx, userId: string): Promise<Prisma.Decimal> {
    const balance = await this.computeWalletBalanceInTx(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { walletBalanceCached: balance } });
    return balance;
  }

  private async computeWalletBalanceInTx(tx: PrismaTx, userId: string): Promise<Prisma.Decimal> {
    const entries = await tx.ledgerEntry.findMany({ where: { userId }, select: { type: true, amount: true } });
    return entries.reduce((balance, entry) => {
      if ([LedgerEntryType.CREDIT, LedgerEntryType.REFUND, LedgerEntryType.ADJUSTMENT, LedgerEntryType.PROMOTION].includes(entry.type)) {
        return balance.plus(entry.amount);
      }
      if (entry.type === LedgerEntryType.LOYALTY) {
        return balance;
      }
      return balance.minus(entry.amount);
    }, ZERO_DECIMAL);
  }

  private isPartnerRole(role: UserRole): boolean {
    return (PARTNER_ROLES as readonly UserRole[]).includes(role);
  }

  private defaultRecipient(customer: { name: string | null; email: string | null; phoneE164: string | null }) {
    return { name: customer.name ?? "Customer", email: customer.email ?? null, phone: customer.phoneE164 ?? null };
  }

  private serializeLedgerEntry(entry: { id: string; userId: string; userRole: UserRole; type: LedgerEntryType; amount: Prisma.Decimal; description: string; paymentMethod: PaymentMethod | null; orderId: string | null; rideId: string | null; isSettled: boolean; paymentId: string | null; createdAt: Date; user?: unknown; order?: unknown; ride?: unknown }) {
    return { ...entry, amount: entry.amount.toString(), createdAt: entry.createdAt.toISOString() };
  }

  private serializePayout(payout: { id: string; userId: string; userRole: UserRole; amount: Prisma.Decimal; status: PayoutStatus; bankAccountName: string; bankAccountNumber: string; bankIfsc: string; reference: string | null; createdAt: Date; updatedAt: Date; user?: unknown }) {
    return { ...payout, amount: payout.amount.toString(), createdAt: payout.createdAt.toISOString(), updatedAt: payout.updatedAt.toISOString() };
  }

  private serializeInvoice(invoice: { id: string; invoiceNumber: string; customerId: string; recipient: Prisma.JsonValue; type: InvoiceType; referenceId: string; amount: Prisma.Decimal; taxBreakdown: Prisma.JsonValue; status: InvoiceStatus; createdAt: Date; updatedAt: Date; customer?: unknown }) {
    return { ...invoice, amount: invoice.amount.toString(), createdAt: invoice.createdAt.toISOString(), updatedAt: invoice.updatedAt.toISOString() };
  }

  private recordFromJson(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private stringOrFallback(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value : fallback;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
}