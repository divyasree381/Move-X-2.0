import { PartnerApproval, type Prisma, type PrismaClient } from "@prisma/client";
import type { StoreType } from "@movex/shared";

type StoreSearchDocument = {
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
  approval: string;
  menuItemNames: string[];
  tags: string[];
  updatedAt: string;
  _geo: { lat: number; lng: number };
};

type IndexedStore = Prisma.StoreGetPayload<{ include: { menuItems: true } }>;

const DEFAULT_INDEX = "movex_stores";

export class SearchIndexer {
  private readonly host = (process.env.MEILISEARCH_HOST ?? "http://localhost:7700").replace(/\/$/, "");
  private readonly apiKey = process.env.MEILISEARCH_API_KEY;
  private readonly indexName = process.env.MEILISEARCH_STORE_INDEX ?? DEFAULT_INDEX;
  private readonly enabled = process.env.SEARCH_PROVIDER === "meilisearch";

  constructor(private readonly prisma: PrismaClient) {}

  async rebuildStores(): Promise<{ indexed: number; skipped: boolean }> {
    if (!this.enabled) {
      return { indexed: 0, skipped: true };
    }

    await this.deleteIndexIfExists();
    await this.configureIndex();

    let cursor: string | undefined;
    let indexed = 0;

    while (true) {
      const stores = await this.prisma.store.findMany({
        where: { approval: PartnerApproval.APPROVED },
        include: { menuItems: { where: { available: true } } },
        orderBy: { id: "asc" },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (stores.length === 0) {
        break;
      }

      await this.upsertStores(stores.map((store) => this.toDocument(store)));
      indexed += stores.length;
      cursor = stores.at(-1)?.id;
    }

    return { indexed, skipped: false };
  }

  async syncStore(storeId: string): Promise<{ indexed: number; deleted: number; skipped: boolean }> {
    if (!this.enabled) {
      return { indexed: 0, deleted: 0, skipped: true };
    }

    await this.configureIndex();
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, include: { menuItems: { where: { available: true } } } });

    if (!store || store.approval !== PartnerApproval.APPROVED) {
      await this.deleteStores([storeId]);
      return { indexed: 0, deleted: 1, skipped: false };
    }

    await this.upsertStores([this.toDocument(store)]);
    return { indexed: 1, deleted: 0, skipped: false };
  }

  private async configureIndex(): Promise<void> {
    await this.request(`/indexes/${encodeURIComponent(this.indexName)}`, {
      method: "PATCH",
      body: JSON.stringify({ primaryKey: "id" }),
    }).catch(async () => {
      await this.request("/indexes", { method: "POST", body: JSON.stringify({ uid: this.indexName, primaryKey: "id" }) });
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

  private async deleteIndexIfExists(): Promise<void> {
    await this.request(`/indexes/${encodeURIComponent(this.indexName)}`, { method: "DELETE" }).catch(() => undefined);
  }

  private upsertStores(documents: StoreSearchDocument[]): Promise<unknown> {
    if (documents.length === 0) {
      return Promise.resolve();
    }

    return this.request(`/indexes/${encodeURIComponent(this.indexName)}/documents`, { method: "POST", body: JSON.stringify(documents) });
  }

  private deleteStores(ids: string[]): Promise<unknown> {
    if (ids.length === 0) {
      return Promise.resolve();
    }

    return this.request(`/indexes/${encodeURIComponent(this.indexName)}/documents/delete-batch`, { method: "POST", body: JSON.stringify(ids) });
  }

  private toDocument(store: IndexedStore): StoreSearchDocument {
    const tags = [...new Set(store.menuItems.flatMap((item) => item.tags.map((tag) => tag.toLowerCase())))]
      .filter((tag) => tag.length > 0)
      .sort();

    return {
      id: store.id,
      type: store.type as StoreType,
      name: store.name,
      description: store.description,
      imageUrl: store.imageUrl,
      ratingAverage: store.ratingAverage.toString(),
      ratingCount: store.ratingCount,
      etaMinutes: store.etaMinutes,
      minOrder: store.minOrder.toString(),
      deliveryRadiusKm: store.deliveryRadiusKm.toString(),
      lat: store.lat.toString(),
      lng: store.lng.toString(),
      isOpen: store.isOpen,
      approval: store.approval,
      menuItemNames: store.menuItems.map((item) => item.name),
      tags,
      updatedAt: store.updatedAt.toISOString(),
      _geo: { lat: Number(store.lat), lng: Number(store.lng) },
    };
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    const response = await fetch(`${this.host}${path}`, { ...init, headers });

    if (!response.ok) {
      throw new Error(`Search index request failed: ${response.status}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }
}
