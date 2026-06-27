import { Injectable } from "@nestjs/common";
import { PartnerApproval, Prisma } from "@prisma/client";
import type { StoreType } from "@movex/shared";
import type { StoreType as PrismaStoreType } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { SearchAdapter, StoreListItem, StoreSearchInput, StoreSearchResult } from "./search-adapter";

type SearchStoreRow = {
  id: string;
  type: PrismaStoreType;
  name: string;
  description: string;
  imageUrl: string | null;
  ratingAverage: Prisma.Decimal;
  ratingCount: number;
  etaMinutes: number;
  minOrder: Prisma.Decimal;
  deliveryRadiusKm: Prisma.Decimal;
  lat: Prisma.Decimal;
  lng: Prisma.Decimal;
  isOpen: boolean;
};

@Injectable()
export class PostgresSearchAdapter implements SearchAdapter {
  constructor(private readonly prisma: PrismaService) {}

  listStores(input: StoreSearchInput): Promise<StoreSearchResult> {
    return this.findStores(input);
  }

  searchStores(input: StoreSearchInput & { q: string }): Promise<StoreSearchResult> {
    return this.findStores(input);
  }

  private async findStores(input: StoreSearchInput): Promise<StoreSearchResult> {
    const limit = Math.min(Math.max(input.limit, 1), 50);
    const stores = await this.prisma.store.findMany({
      where: {
        approval: PartnerApproval.APPROVED,
        ...(input.type ? { type: input.type as PrismaStoreType } : {}),
        ...(input.q
          ? {
              OR: [
                { name: { contains: input.q, mode: "insensitive" } },
                { description: { contains: input.q, mode: "insensitive" } },
                { menuItems: { some: { name: { contains: input.q, mode: "insensitive" } } } },
                { menuItems: { some: { tags: { has: input.q.toLowerCase() } } } },
              ],
            }
          : {}),
      },
      include: { menuItems: { where: { available: true }, take: 1 } },
      orderBy:
        input.lat !== undefined && input.lng !== undefined
          ? [{ isOpen: "desc" }, { ratingAverage: "desc" }]
          : [{ ratingAverage: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const withDistance = stores
      .map((store) => ({
        store,
        distanceKm:
          input.lat !== undefined && input.lng !== undefined
            ? haversineKm(input.lat, input.lng, Number(store.lat), Number(store.lng))
            : undefined,
      }))
      .filter(({ store, distanceKm }) => {
        if (distanceKm === undefined) {
          return true;
        }
        const radius = input.radiusKm ?? Number(store.deliveryRadiusKm);
        return distanceKm <= radius;
      })
      .sort((a, b) => {
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm || Number(b.store.ratingAverage) - Number(a.store.ratingAverage);
        }
        return 0;
      });

    const start = input.cursor ? Math.max(0, Number(Buffer.from(input.cursor, "base64url").toString("utf8")) || 0) : 0;
    const page = withDistance.slice(start, start + limit);
    const nextIndex = start + page.length;

    return {
      items: page.map(({ store, distanceKm }) => this.toListItem(store, distanceKm)),
      nextCursor: nextIndex < withDistance.length ? Buffer.from(String(nextIndex)).toString("base64url") : undefined,
    };
  }

  private toListItem(store: SearchStoreRow, distanceKm?: number): StoreListItem {
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
      distanceKm: distanceKm !== undefined ? Number(distanceKm.toFixed(2)) : undefined,
    };
  }
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const radiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}