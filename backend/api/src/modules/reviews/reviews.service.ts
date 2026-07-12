import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { ReviewModerationDto, ReviewsQueryDto } from "./dto/reviews.dto";

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublic(query: ReviewsQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.menuItemId ? { menuItemId: query.menuItemId } : {}),
        ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        tags: review.tags,
        author: { id: review.author.id, name: review.author.name ?? "MoveX customer", avatarUrl: review.author.avatarUrl },
        createdAt: review.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined,
    };
  }

  async listForModeration(query: ReviewsQueryDto) {
    const limit = query.limit ?? 25;
    const rows = await this.prisma.review.findMany({
      where: {
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { author: { select: { id: true, name: true, role: true } }, store: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return { items: page, nextCursor: rows.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async moderate(reviewId: string, body: ReviewModerationDto) {
    const existing = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new NotFoundException("Review not found");
    return this.prisma.review.update({ where: { id: reviewId }, data: { status: body.status } });
  }
}
