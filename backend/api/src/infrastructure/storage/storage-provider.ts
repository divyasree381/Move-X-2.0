export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

export type StoreObjectInput = {
  keyPrefix: string;
  fileName: string;
  contentType: string;
  contentBase64: string;
  metadata?: Record<string, string>;
};

export type StoredObject = {
  bucket: string;
  key: string;
  url?: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export interface StorageProvider {
  putObject(input: StoreObjectInput): Promise<StoredObject>;
  createSignedUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(bucket: string, key: string): Promise<void>;
}