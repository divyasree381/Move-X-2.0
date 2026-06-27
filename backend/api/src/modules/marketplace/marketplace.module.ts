import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";
import { MeilisearchAdapter } from "./meilisearch.adapter";
import { PostgresSearchAdapter } from "./postgres-search.adapter";
import { SEARCH_ADAPTER, type SearchAdapter } from "./search-adapter";

@Module({
  imports: [PrismaModule],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    PostgresSearchAdapter,
    MeilisearchAdapter,
    {
      provide: SEARCH_ADAPTER,
      useFactory: (postgres: PostgresSearchAdapter, meilisearch: MeilisearchAdapter): SearchAdapter =>
        process.env.SEARCH_PROVIDER === "meilisearch" ? meilisearch : postgres,
      inject: [PostgresSearchAdapter, MeilisearchAdapter],
    },
  ],
  exports: [MarketplaceService, SEARCH_ADAPTER],
})
export class MarketplaceModule {}
