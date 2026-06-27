import { createPrismaClient } from "./prisma.js";
import { createRedisClient } from "./redis.js";
import { OutboxProcessor } from "./outbox-processor.js";
import { SearchIndexer } from "./search-indexer.js";
import { captureException, startObservability } from "./observability.js";

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2_000);

async function main() {
  await startObservability();
  const prisma = createPrismaClient();

  if (process.argv.includes("--rebuild-search")) {
    const result = await new SearchIndexer(prisma).rebuildStores();
    console.log(JSON.stringify({ job: "search.rebuild", ...result }));
    await prisma.$disconnect();
    return;
  }

  const redis = createRedisClient();
  const processor = new OutboxProcessor(prisma, redis);
  let stopped = false;

  async function shutdown() {
    stopped = true;
    await prisma.$disconnect();
    redis.disconnect();
  }

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  while (!stopped) {
    await processor.processBatch();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  captureException(error);
  console.error(error);
  process.exitCode = 1;
});

