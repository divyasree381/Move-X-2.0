import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";
import type { Response } from "express";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import { FinanceSurfaceService } from "./finance-surface.service";
import { GenerateInvoiceDto, GenerateReconciliationDto, InvoiceQueryDto, LedgerQueryDto, MarkPayoutDto, PayoutQueryDto, PayoutSweepDto, ReconciliationQueryDto, WalletAdjustmentDto } from "./dto/finance.dto";

@ApiTags("Finance")
@ApiExtraModels(LedgerQueryDto, WalletAdjustmentDto, PayoutSweepDto, PayoutQueryDto, MarkPayoutDto, InvoiceQueryDto, GenerateInvoiceDto, ReconciliationQueryDto, GenerateReconciliationDto)
@Controller({ path: "finance", version: "1" })
export class FinanceController {
  constructor(private readonly financeService: FinanceSurfaceService) {}

  @Get("ledger")
  @RequirePermission(PermissionAction.FinanceLedgerRead)
  listLedger(@Query() query: LedgerQueryDto) {
    return this.financeService.listLedger(query);
  }

  @Get("ledger/:entryId")
  @RequirePermission(PermissionAction.FinanceLedgerRead)
  inspectLedgerEntry(@Param("entryId") entryId: string) {
    return this.financeService.inspectLedgerEntry(entryId);
  }

  @Post("wallet-adjustments")
  @RequirePermission(PermissionAction.FinanceWalletAdjust)
  adjustWallet(@Body() body: WalletAdjustmentDto) {
    return this.financeService.adjustWallet(body);
  }

  @Post("payout-sweeps")
  @RequirePermission(PermissionAction.FinancePayoutManage)
  sweepPayouts(@Body() body: PayoutSweepDto) {
    return this.financeService.sweepPayouts(body);
  }

  @Get("payouts")
  @RequirePermission(PermissionAction.FinancePayoutManage)
  listPayouts(@Query() query: PayoutQueryDto) {
    return this.financeService.listPayouts(query);
  }

  @Patch("payouts/:payoutId")
  @RequirePermission(PermissionAction.FinancePayoutManage)
  markPayout(@Param("payoutId") payoutId: string, @Body() body: MarkPayoutDto) {
    return this.financeService.markPayout(payoutId, body);
  }

  @Get("reconciliation")
  @RequirePermission(PermissionAction.FinanceReconciliationRead)
  listReconciliationReports(@Query() query: ReconciliationQueryDto) {
    return this.financeService.listReconciliationReports(query);
  }

  @Post("reconciliation")
  @RequirePermission(PermissionAction.FinanceReconciliationRead)
  generateReconciliationReport(@Body() body: GenerateReconciliationDto) {
    return this.financeService.generateReconciliationReport(body);
  }
  @Get("invoices")
  @RequirePermission(PermissionAction.FinanceInvoiceManage)
  listInvoices(@Query() query: InvoiceQueryDto) {
    return this.financeService.listInvoices(query);
  }

  @Post("invoices")
  @RequirePermission(PermissionAction.FinanceInvoiceManage)
  generateInvoice(@Body() body: GenerateInvoiceDto) {
    return this.financeService.generateInvoice(body);
  }

  @Get("invoices/:invoiceId")
  @RequirePermission(PermissionAction.FinanceInvoiceManage)
  getInvoice(@Param("invoiceId") invoiceId: string) {
    return this.financeService.getInvoice(invoiceId);
  }

  @Get("invoices/:invoiceId/html")
  @Header("Content-Type", "text/html; charset=utf-8")
  @RequirePermission(PermissionAction.FinanceInvoiceManage)
  async invoiceHtml(@Param("invoiceId") invoiceId: string, @Res() response: Response) {
    response.send(await this.financeService.invoiceHtml(invoiceId));
  }
}