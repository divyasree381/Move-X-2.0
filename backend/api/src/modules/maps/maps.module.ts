import { Module } from "@nestjs/common";

import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { GoogleMapsProvider } from "./google-maps.provider";
import { OpenSourceMapsProvider } from "./open-source-maps.provider";
import { MapsController } from "./maps.controller";
import { MAPS_PROVIDER } from "./maps-provider";
import { MapsService } from "./maps.service";

@Module({
  imports: [RedisStoreModule],
  controllers: [MapsController],
  providers: [
    MapsService,
    GoogleMapsProvider,
    OpenSourceMapsProvider,
    {
      provide: MAPS_PROVIDER,
      useFactory: (openSource: OpenSourceMapsProvider, google: GoogleMapsProvider) => {
        const provider = (process.env.MAPS_PROVIDER ?? "open-source").trim().toLowerCase();

        if (provider === "open-source") return openSource;
        if (provider === "google") return google;

        throw new Error(`Unsupported MAPS_PROVIDER: ${provider}`);
      },
      inject: [OpenSourceMapsProvider, GoogleMapsProvider],
    },
  ],
  exports: [MapsService, MAPS_PROVIDER],
})
export class MapsModule {}