import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PartnerApproval, Prisma, UserRole } from "@prisma/client";
import type { StoreType as PrismaStoreType } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import type {
  MenuItemDto,
  StoreListQueryDto,
  StoreOpenDto,
  StoreReviewDto,
  StoreSearchQueryDto,
  UpdateMenuItemDto,
  UpsertStoreDto,
} from "./dto/marketplace.dto";
import { SEARCH_ADAPTER, type SearchAdapter } from "./search-adapter";

type PrismaTx = Prisma.TransactionClient;

type StockLine = {
  menuItemId: string;
  quantity: number;
};

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SEARCH_ADAPTER) private readonly searchAdapter: SearchAdapter,
  ) {}

  listStores(query: StoreListQueryDto) {
    return this.searchAdapter.listStores({
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      type: query.type,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }

  searchStores(query: StoreSearchQueryDto) {
    return this.searchAdapter.searchStores({
      q: query.q,
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      type: query.type,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }

  async getStore(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, approval: PartnerApproval.APPROVED },
      include: { owner: { select: { id: true, name: true } } },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    return this.toStoreDetail(store);
  }

  async getMenu(storeId: string) {
    await this.getStore(storeId);
    const items = await this.prisma.menuItem.findMany({
      where: { storeId, available: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
    });

    return items.map(this.toMenuItem);
  }

  async createStore(user: AuthenticatedUser, body: UpsertStoreDto) {
    this.assertRestaurantOwner(user);
    const existing = await this.prisma.store.findFirst({ where: { ownerId: user.userId } });

    if (existing) {
      throw new BadRequestException("A partner can own only one store");
    }

    const store = await this.prisma.store.create({
      data: {
        ownerId: user.userId,
        type: body.type as PrismaStoreType,
        name: body.name,
        description: body.description,
        imageUrl: body.imageUrl,
        licenseUrl: body.licenseUrl,
        etaMinutes: body.etaMinutes,
        minOrder: new Prisma.Decimal(body.minOrder),
        deliveryRadiusKm: new Prisma.Decimal(body.deliveryRadiusKm),
        lat: new Prisma.Decimal(body.lat),
        lng: new Prisma.Decimal(body.lng),
        approval: PartnerApproval.PENDING,
        isOpen: false,
        bankAccount: (body.bankAccount ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        openingHours: (body.openingHours ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.enqueueStoreSearchSync(store.id);
    return this.toStoreDetail(store);
  }

  async updateMyStore(user: AuthenticatedUser, body: UpsertStoreDto) {
    this.assertRestaurantOwner(user);
    const store = await this.findOwnedStore(user.userId);
    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        type: body.type as PrismaStoreType,
        name: body.name,
        description: body.description,
        imageUrl: body.imageUrl,
        licenseUrl: body.licenseUrl,
        etaMinutes: body.etaMinutes,
        minOrder: new Prisma.Decimal(body.minOrder),
        deliveryRadiusKm: new Prisma.Decimal(body.deliveryRadiusKm),
        lat: new Prisma.Decimal(body.lat),
        lng: new Prisma.Decimal(body.lng),
        bankAccount: (body.bankAccount ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        openingHours: (body.openingHours ?? {}) as Prisma.InputJsonValue,
        approval: store.approval === PartnerApproval.REJECTED ? PartnerApproval.PENDING : store.approval,
        rejectionReason: null,
      },
    });

    await this.enqueueStoreSearchSync(updated.id);
    return this.toStoreDetail(updated);
  }

  async setMyStoreOpen(user: AuthenticatedUser, body: StoreOpenDto) {
    this.assertRestaurantOwner(user);
    const store = await this.findOwnedStore(user.userId);

    if (body.isOpen && store.approval !== PartnerApproval.APPROVED) {
      throw new ForbiddenException("Store must be approved before opening");
    }

    const updated = await this.prisma.store.update({ where: { id: store.id }, data: { isOpen: body.isOpen } });
    await this.enqueueStoreSearchSync(updated.id);
    return this.toStoreDetail(updated);
  }

  async requestApproval(user: AuthenticatedUser) {
    this.assertRestaurantOwner(user);
    const store = await this.findOwnedStore(user.userId);
    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: { approval: PartnerApproval.PENDING, rejectionReason: null, isOpen: false },
    });
    await this.enqueueStoreSearchSync(updated.id);
    return this.toStoreDetail(updated);
  }

  async createMenuItem(user: AuthenticatedUser, body: MenuItemDto) {
    this.assertRestaurantOwner(user);
    const store = await this.findOwnedStore(user.userId);
    const item = await this.prisma.menuItem.create({ data: this.menuCreateData(store.id, body) });
    await this.enqueueStoreSearchSync(store.id);
    return this.toMenuItem(item);
  }

  async updateMenuItem(user: AuthenticatedUser, itemId: string, body: UpdateMenuItemDto) {
    this.assertRestaurantOwner(user);
    const store = await this.findOwnedStore(user.userId);
    const item = await this.prisma.menuItem.findFirst({ where: { id: itemId, storeId: store.id } });

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    const updated = await this.prisma.menuItem.update({ where: { id: itemId }, data: this.menuUpdateData(body) });
    await this.enqueueStoreSearchSync(store.id);
    return this.toMenuItem(updated);
  }

  async deleteMenuItem(user: AuthenticatedUser, itemId: string) {
    this.assertRestaurantOwner(user);
    const store = await this.findOwnedStore(user.userId);
    const item = await this.prisma.menuItem.findFirst({ where: { id: itemId, storeId: store.id } });

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    await this.prisma.menuItem.delete({ where: { id: itemId } });
    await this.enqueueStoreSearchSync(store.id);
    return { deleted: true };
  }

  async listPendingStores(query: StoreListQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const stores = await this.prisma.store.findMany({
      where: { approval: PartnerApproval.PENDING },
      orderBy: { createdAt: "asc" },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = stores.slice(0, limit);
    return {
      items: page.map(this.toStoreDetail),
      nextCursor: stores.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  async reviewStore(storeId: string, body: StoreReviewDto) {
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        approval: body.approval === "APPROVED" ? PartnerApproval.APPROVED : PartnerApproval.REJECTED,
        rejectionReason: body.approval === "REJECTED" ? body.rejectionReason ?? "Rejected by admin" : null,
        isOpen: body.approval === "APPROVED" ? undefined : false,
      },
    });
    await this.enqueueStoreSearchSync(updated.id);
    return this.toStoreDetail(updated);
  }

  async suspendStore(storeId: string) {
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { isOpen: false, approval: PartnerApproval.REJECTED, rejectionReason: "Suspended by admin" },
    });
    await this.enqueueStoreSearchSync(updated.id);
    return this.toStoreDetail(updated);
  }

  decrementStock(lines: StockLine[], tx?: PrismaTx): Promise<void> {
    if (tx) {
      return this.adjustStock(lines, "decrement", tx);
    }

    return this.prisma.$transaction((transaction) => this.adjustStock(lines, "decrement", transaction));
  }

  restoreStock(lines: StockLine[], tx?: PrismaTx): Promise<void> {
    if (tx) {
      return this.adjustStock(lines, "increment", tx);
    }

    return this.prisma.$transaction((transaction) => this.adjustStock(lines, "increment", transaction));
  }

  private async enqueueStoreSearchSync(storeId: string): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        type: "search.store.changed",
        payload: { storeId },
      },
    });
  }

  private async adjustStock(lines: StockLine[], mode: "decrement" | "increment", tx: PrismaTx): Promise<void> {
    for (const line of lines) {
      if (line.quantity <= 0) {
        throw new BadRequestException("Stock quantity must be positive");
      }

      const item = await tx.menuItem.findUnique({ where: { id: line.menuItemId }, select: { stock: true } });

      if (!item) {
        throw new NotFoundException("Menu item not found");
      }

      if (item.stock === -1) {
        continue;
      }

      if (mode === "decrement") {
        const result = await tx.menuItem.updateMany({
          where: { id: line.menuItemId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });

        if (result.count !== 1) {
          throw new BadRequestException("Insufficient stock");
        }
      } else {
        await tx.menuItem.update({ where: { id: line.menuItemId }, data: { stock: { increment: line.quantity } } });
      }
    }
  }

  private async findOwnedStore(ownerId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    return store;
  }

  private assertRestaurantOwner(user: AuthenticatedUser) {
    if (user.role !== UserRole.RESTAURANT) {
      throw new ForbiddenException("Only restaurant partners can manage stores");
    }
  }

  private menuCreateData(storeId: string, body: MenuItemDto): Prisma.MenuItemUncheckedCreateInput {
    return {
      storeId,
      section: body.section,
      name: body.name,
      description: body.description,
      price: new Prisma.Decimal(body.price),
      imageUrl: body.imageUrl,
      tags: body.tags ?? [],
      available: body.available ?? true,
      stock: body.stock,
      customizations: (body.customizations ?? {}) as Prisma.InputJsonValue,
    };
  }

  private menuUpdateData(body: UpdateMenuItemDto): Prisma.MenuItemUpdateInput {
    return {
      section: body.section,
      name: body.name,
      description: body.description,
      price: body.price === undefined ? undefined : new Prisma.Decimal(body.price),
      imageUrl: body.imageUrl,
      tags: body.tags,
      available: body.available,
      stock: body.stock,
      customizations: body.customizations as Prisma.InputJsonValue | undefined,
    };
  }

  private toStoreDetail(store: {
    id: string;
    ownerId: string;
    type: string;
    name: string;
    description: string;
    imageUrl: string | null;
    licenseUrl?: string | null;
    ratingAverage: Prisma.Decimal;
    ratingCount: number;
    etaMinutes: number;
    minOrder: Prisma.Decimal;
    deliveryRadiusKm: Prisma.Decimal;
    lat: Prisma.Decimal;
    lng: Prisma.Decimal;
    isOpen: boolean;
    approval: string;
    rejectionReason: string | null;
    openingHours: Prisma.JsonValue;
  }) {
    return {
      id: store.id,
      ownerId: store.ownerId,
      type: store.type,
      name: store.name,
      description: store.description,
      imageUrl: store.imageUrl,
      licenseUrl: store.licenseUrl,
      ratingAverage: store.ratingAverage.toString(),
      ratingCount: store.ratingCount,
      etaMinutes: store.etaMinutes,
      minOrder: store.minOrder.toString(),
      deliveryRadiusKm: store.deliveryRadiusKm.toString(),
      lat: store.lat.toString(),
      lng: store.lng.toString(),
      isOpen: store.isOpen,
      approval: store.approval,
      rejectionReason: store.rejectionReason,
      openingHours: store.openingHours,
    };
  }

  private toMenuItem(item: {
    id: string;
    storeId: string;
    section: string;
    name: string;
    description: string;
    price: Prisma.Decimal;
    imageUrl: string | null;
    tags: string[];
    available: boolean;
    stock: number;
    customizations: Prisma.JsonValue;
  }) {
    return {
      id: item.id,
      storeId: item.storeId,
      section: item.section,
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      imageUrl: item.imageUrl,
      tags: item.tags,
      available: item.available,
      stock: item.stock,
      customizations: item.customizations,
    };
  }
}

