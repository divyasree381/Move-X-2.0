import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL = "postgresql://movex:movex@localhost:5432/movex?schema=public";

function createPrismaOptions() {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  return {
    adapter: new PrismaPg(databaseUrl),
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor() {
    super(createPrismaOptions());
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}