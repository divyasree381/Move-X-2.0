import { Module } from "@nestjs/common";

import { RedisStoreService } from "./redis-store.service";

@Module({
  providers: [RedisStoreService],
  exports: [RedisStoreService],
})
export class RedisStoreModule {}