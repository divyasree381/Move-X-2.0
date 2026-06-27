import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { FinanceModule } from "./modules/finance/finance.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { RedisThrottlerStorage } from "./common/throttling/redis-throttler.storage";
import { ThrottlingStorageModule } from "./common/throttling/throttling-storage.module";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { MapsModule } from "./modules/maps/maps.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { OpsModule } from "./modules/ops/ops.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { RidesModule } from "./modules/rides/rides.module";
import { SampleModule } from "./modules/sample/sample.module";
import { TrustModule } from "./modules/trust/trust.module";

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ThrottlingStorageModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          {
            name: "default",
            ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
            limit: Number(process.env.THROTTLE_LIMIT ?? 100),
            blockDuration: Number(process.env.THROTTLE_BLOCK_MS ?? 60_000),
          },
        ],
        errorMessage: "Too many requests",
      }),
    }),
    IdentityModule,
    FinanceModule,
    MapsModule,
    MarketplaceModule,
    OpsModule,
    OrdersModule,
    PaymentsModule,
    PlatformModule,
    RealtimeModule,
    RidesModule,
    HealthModule,
    SampleModule,
    TrustModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}


