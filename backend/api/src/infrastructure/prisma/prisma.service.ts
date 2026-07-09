import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { Pool } from "pg";

const DEFAULT_DATABASE_URL = "postgresql://movex:movex@localhost:5432/movex?schema=public";

function createPrismaOptions() {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    adapter: new PrismaPg(pool),
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