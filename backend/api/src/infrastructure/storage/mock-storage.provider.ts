import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type { StorageProvider, StoreObjectInput, StoredObject } from "./storage-provider";

@Injectable()
export class MockStorageProvider implements StorageProvider {
  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    const buffer = Buffer.from(input.contentBase64, "base64");
    const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${input.keyPrefix}/${Date.now()}_${digest}_${safeName}`;

    return {
      key,
      url: `mock://storage/${key}`,
      contentType: input.contentType,
      sizeBytes: buffer.byteLength,
    };
  }
}