import { Module } from "@nestjs/common";

import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { MapsModule } from "../maps/maps.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { RidesController } from "./rides.controller";
import { RidesService } from "./rides.service";

@Module({
  imports: [PrismaModule, RedisStoreModule, MapsModule, OutboxModule, RealtimeModule],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}