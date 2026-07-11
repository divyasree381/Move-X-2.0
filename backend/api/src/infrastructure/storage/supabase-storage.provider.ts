import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { StorageProvider, StoreObjectInput, StoredObject } from "./storage-provider";

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !secretKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase storage");
    }

    this.bucket =
      process.env.SUPABASE_PRIVATE_BUCKET ??
      process.env.SUPABASE_PARTNER_DOCUMENTS_BUCKET ??
      "movex-private";
    this.client = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    const buffer = Buffer.from(input.contentBase64, "base64");
    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${input.keyPrefix}/${Date.now()}_${checksumSha256.slice(0, 16)}_${safeName}`;
    const { error } = await this.client.storage.from(this.bucket).upload(key, buffer, {
      contentType: input.contentType,
      metadata: input.metadata,
      upsert: false,
    });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return {
      bucket: this.bucket,
      key,
      contentType: input.contentType,
      sizeBytes: buffer.byteLength,
      checksumSha256,
    };
  }

  async createSignedUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds, { download: false });

    if (error || !data?.signedUrl) {
      throw new Error(`Could not create signed document URL: ${error?.message ?? "unknown error"}`);
    }

    return data.signedUrl;
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error) {
      throw new Error(`Could not delete stored object: ${error.message}`);
    }
  }
}