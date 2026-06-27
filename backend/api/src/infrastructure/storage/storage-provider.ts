export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

export type StoreObjectInput = {
  keyPrefix: string;
  fileName: string;
  contentType: string;
  contentBase64: string;
  metadata?: Record<string, string>;
};

export type StoredObject = {
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
};

export interface StorageProvider {
  putObject(input: StoreObjectInput): Promise<StoredObject>;
}