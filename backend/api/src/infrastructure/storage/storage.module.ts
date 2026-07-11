import { Module } from "@nestjs/common";

import { MockStorageProvider } from "./mock-storage.provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage-provider";

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): StorageProvider => {
        const provider = (process.env.STORAGE_PROVIDER ?? "mock").trim().toLowerCase();
        if (provider === "mock") return new MockStorageProvider();
        if (provider === "supabase") return new SupabaseStorageProvider();
        throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}