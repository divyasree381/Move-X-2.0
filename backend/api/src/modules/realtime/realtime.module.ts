import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { REALTIME_PROVIDER } from "./realtime-provider";
import { RealtimeController } from "./realtime.controller";
import { RedisRealtimeProvider } from "./redis-realtime.provider";
import { RealtimeSubscriptionService } from "./realtime-subscription.service";

@Module({
  imports: [PrismaModule],
  controllers: [RealtimeController],
  providers: [
    RealtimeSubscriptionService,
    RedisRealtimeProvider,
    {
      provide: REALTIME_PROVIDER,
      useExisting: RedisRealtimeProvider,
    },
  ],
  exports: [REALTIME_PROVIDER],
})
export class RealtimeModule {}