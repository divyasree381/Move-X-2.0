import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { SearchIndexAdapter, StoreListItem, StoreSearchDocument, StoreSearchInput, StoreSearchResult } from "./search-adapter";

type MeiliSearchResponse<T> = {
  hits: T[];
  estimatedTotalHits?: number;
  offset?: number;
  limit?: number;
};

@Injectable()
export class MeilisearchAdapter implements SearchIndexAdapter {
  private readonly host = (process.env.MEILISEARCH_HOST ?? "http://localhost:7700").replace(/\/$/, "");
  private readonly apiKey = process.env.MEILISEARCH_API_KEY;
  private readonly indexName = process.env.MEILISEARCH_STORE_INDEX ?? "movex_stores";

  listStores(input: StoreSearchInput): Promise<StoreSearchResult> {
    return this.search({ ...input, q: input.q ?? "" });
  }

  searchStores(input: StoreSearchInput & { q: string }): Promise<StoreSearchResult> {
    return this.search(input);
  }

  async configure(): Promise<void> {
    await this.request(`/indexes/${encodeURIComponent(this.indexName)}`, {
      method: "PATCH",
      body: JSON.stringify({ primaryKey: "id" }),
    }).catch(async () => {
      await this.request("/indexes", {
        method: "POST",
        body: JSON.stringify({ uid: this.indexName, primaryKey: "id" }),
      });
    });

    await this.request(`/indexes/${encodeURIComponent(this.indexName)}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["name", "description", "menuItemNames", "tags", "type"],
        filterableAttributes: ["type", "approval", "isOpen", "_geo"],
        sortableAttributes: ["ratingAverage", "ratingCount", "etaMinutes", "updatedAt", "_geo"],
      }),
    });
  }

  async upsertStores(documents: StoreSearchDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.request(`/indexes/${encodeURIComponent(this.indexName)}/documents`, {
      method: "POST",
      body: JSON.stringify(documents),
    });
  }

  async deleteStores(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.request(`/indexes/${encodeURIComponent(this.indexName)}/documents/delete-batch`, {
      method: "POST",
      body: JSON.stringify(ids),
    });
  }

  private async search(input: StoreSearchInput): Promise<StoreSearchResult> {
    const limit = Math.min(Math.max(input.limit, 1), 50);
    const offset = input.cursor ? Math.max(0, Number(Buffer.from(input.cursor, "base64url").toString("utf8")) || 0) : 0;
    const filter = ["approval = APPROVED"];

    if (input.type) {
      filter.push(`type = ${input.type}`);
    }

    if (input.lat !== undefined && input.lng !== undefined && input.radiusKm !== undefined) {
      filter.push(`_geoRadius(${input.lat}, ${input.lng}, ${Math.round(input.radiusKm * 1000)})`);
    }

    const response = await this.request<MeiliSearchResponse<StoreSearchDocument>>(`/indexes/${encodeURIComponent(this.indexName)}/search`, {
      method: "POST",
      body: JSON.stringify({
        q: input.q ?? "",
        offset,
        limit,
        filter,
        sort: input.lat !== undefined && input.lng !== undefined ? [`_geoPoint(${input.lat}, ${input.lng}):asc`] : ["ratingAverage:desc", "ratingCount:desc"],
      }),
    });

    const total = response.estimatedTotalHits ?? response.hits.length;
    const nextOffset = offset + response.hits.length;
    return {
      items: response.hits.map((hit) => this.toListItem(hit, input)),
      nextCursor: nextOffset < total ? Buffer.from(String(nextOffset)).toString("base64url") : undefined,
    };
  }

  private toListItem(hit: StoreSearchDocument, input: StoreSearchInput): StoreListItem {
    const distanceKm = input.lat !== undefined && input.lng !== undefined ? haversineKm(input.lat, input.lng, Number(hit.lat), Number(hit.lng)) : undefined;

    return {
      id: hit.id,
      type: hit.type,
      name: hit.name,
      description: hit.description,
      imageUrl: hit.imageUrl,
      ratingAverage: String(hit.ratingAverage),
      ratingCount: hit.ratingCount,
      etaMinutes: hit.etaMinutes,
      minOrder: String(hit.minOrder),
      deliveryRadiusKm: String(hit.deliveryRadiusKm),
      lat: String(hit.lat),
      lng: String(hit.lng),
      isOpen: hit.isOpen,
      distanceKm: distanceKm !== undefined ? Number(distanceKm.toFixed(2)) : undefined,
    };
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    const response = await fetch(`${this.host}${path}`, { ...init, headers });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Search engine request failed: ${response.status}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const radiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
