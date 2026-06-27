import type { StoreType } from "@movex/shared";

export const SEARCH_ADAPTER = Symbol("SEARCH_ADAPTER");

export type StoreSearchInput = {
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  type?: StoreType;
  cursor?: string;
  limit: number;
};

export type StoreListItem = {
  id: string;
  type: StoreType;
  name: string;
  description: string;
  imageUrl?: string | null;
  ratingAverage: string;
  ratingCount: number;
  etaMinutes: number;
  minOrder: string;
  deliveryRadiusKm: string;
  lat: string;
  lng: string;
  isOpen: boolean;
  distanceKm?: number;
};

export type StoreSearchDocument = StoreListItem & {
  approval: string;
  menuItemNames: string[];
  tags: string[];
  updatedAt: string;
  _geo?: { lat: number; lng: number };
};

export type StoreSearchResult = {
  items: StoreListItem[];
  nextCursor?: string;
};

export interface SearchAdapter {
  listStores(input: StoreSearchInput): Promise<StoreSearchResult>;
  searchStores(input: StoreSearchInput & { q: string }): Promise<StoreSearchResult>;
}

export interface SearchIndexAdapter extends SearchAdapter {
  configure?(): Promise<void>;
  upsertStores(documents: StoreSearchDocument[]): Promise<void>;
  deleteStores(ids: string[]): Promise<void>;
}
