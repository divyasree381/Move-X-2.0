import { Module } from "@nestjs/common";

import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PrismaModule, RedisStoreModule, StorageModule, MarketplaceModule, OutboxModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}