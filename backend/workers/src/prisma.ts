import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL = "postgresql://movex:movex@localhost:5432/movex?schema=public";

export function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL),
  });
}