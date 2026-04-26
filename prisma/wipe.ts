import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`\n=== web-safeguard wipe operational data ===`);
  console.log(`DB: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const counts = await prisma.$transaction(async (tx) => {
    const scanResults = await tx.scanResult.deleteMany({});
    const scanRuns = await tx.scanRun.deleteMany({});
    const classifications = await tx.siteClassification.deleteMany({});
    const blockRules = await tx.blockRule.deleteMany({});
    const trafficSamples = await tx.trafficSample.deleteMany({});
    const sites = await tx.site.deleteMany({});
    const auditEvents = await tx.auditEvent.deleteMany({});
    const webhookDeliveries = await tx.webhookDelivery.deleteMany({});
    const blocklistPublishes = await tx.blocklistPublish.deleteMany({});

    return {
      scanResults: scanResults.count,
      scanRuns: scanRuns.count,
      classifications: classifications.count,
      blockRules: blockRules.count,
      trafficSamples: trafficSamples.count,
      sites: sites.count,
      auditEvents: auditEvents.count,
      webhookDeliveries: webhookDeliveries.count,
      blocklistPublishes: blocklistPublishes.count,
    };
  });

  console.log("✓ Deleted:");
  console.log(`  ${counts.sites} sites`);
  console.log(`  ${counts.classifications} classifications`);
  console.log(`  ${counts.blockRules} block rules`);
  console.log(`  ${counts.scanRuns} scan runs (+ ${counts.scanResults} per-provider results)`);
  console.log(`  ${counts.trafficSamples} traffic samples`);
  console.log(`  ${counts.auditEvents} audit events`);
  console.log(`  ${counts.webhookDeliveries} webhook deliveries`);
  console.log(`  ${counts.blocklistPublishes} blocklist publishes`);

  console.log("\n→ Preserved: users, ingest sources, ingest tokens, blocklist subscribers, hash salts.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
