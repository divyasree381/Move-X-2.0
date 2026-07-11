import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { OrdersService } from "./orders.service";

@Injectable()
export class OrderMaintenanceScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderMaintenanceScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.ORDER_MAINTENANCE_ENABLED === "false") return;
    const intervalMs = Math.max(Number(process.env.ORDER_MAINTENANCE_INTERVAL_MS ?? 60_000), 10_000);
    this.timer = setInterval(() => {
      void this.orders.autoCancelStaleOrders().catch((error: unknown) => {
        this.logger.error("Stale-order maintenance failed", error instanceof Error ? error.stack : undefined);
      });
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
