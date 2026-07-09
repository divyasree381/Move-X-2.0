import { Module } from "@nestjs/common";

import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { OpenSourceMapsProvider } from "./open-source-maps.provider";
import { MapsController } from "./maps.controller";
import { MAPS_PROVIDER } from "./maps-provider";
import { MapsService } from "./maps.service";

@Module({
  imports: [RedisStoreModule],
  controllers: [MapsController],
  providers: [
    MapsService,
    OpenSourceMapsProvider,
    {
      provide: MAPS_PROVIDER,
      useExisting: OpenSourceMapsProvider,
    },
  ],
  exports: [MapsService, MAPS_PROVIDER],
})
export class MapsModule {}