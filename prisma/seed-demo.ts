import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BlockRuleType,
  type Prisma,
  PrismaClient,
  ScanProvider,
  ScanVerdict,
  SiteStatus,
} from "../app/generated/prisma";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const DEMO_DOMAINS: Array<{ domain: string; status: SiteStatus; weight: number }> = [
  { domain: "google.com", status: SiteStatus.SAFE, weight: 8000 },
  { domain: "youtube.com", status: SiteStatus.SAFE, weight: 7500 },
  { domain: "facebook.com", status: SiteStatus.SAFE, weight: 7000 },
  { domain: "wikipedia.org", status: SiteStatus.SAFE, weight: 4000 },
  { domain: "gov.bj", status: SiteStatus.WHITELISTED, weight: 3500 },
  { domain: "presidence.bj", status: SiteStatus.WHITELISTED, weight: 2500 },
  { domain: "moov.bj", status: SiteStatus.SAFE, weight: 5000 },
  { domain: "mtn.bj", status: SiteStatus.SAFE, weight: 4800 },
  { domain: "amazon.com", status: SiteStatus.SAFE, weight: 3200 },
  { domain: "github.com", status: SiteStatus.SAFE, weight: 2400 },
  { domain: "binance.com", status: SiteStatus.SUSPICIOUS, weight: 2200 },
  { domain: "coinbase.com", status: SiteStatus.SAFE, weight: 1800 },
  { domain: "paypa1.com", status: SiteStatus.DANGEROUS, weight: 1500 },
  { domain: "binance-secure-login.com", status: SiteStatus.DANGEROUS, weight: 1200 },
  { domain: "moov-bj-cashback.net", status: SiteStatus.DANGEROUS, weight: 1100 },
  { domain: "mtn-bj-promo.online", status: SiteStatus.DANGEROUS, weight: 1000 },
  { domain: "free-bitcoin-bj.com", status: SiteStatus.DANGEROUS, weight: 950 },
  { domain: "ecobank-cotonou-secure.com", status: SiteStatus.DANGEROUS, weight: 880 },
  { domain: "boa-bj-online.net", status: SiteStatus.SUSPICIOUS, weight: 720 },
  { domain: "investissement-rapide.bj", status: SiteStatus.SUSPICIOUS, weight: 650 },
  { domain: "loterie-nationale-bj-gagnant.com", status: SiteStatus.SUSPICIOUS, weight: 580 },
  { domain: "western-union-bj-transfer.com", status: SiteStatus.SUSPICIOUS, weight: 510 },
  { domain: "newsapp.example.com", status: SiteStatus.PENDING, weight: 420 },
  { domain: "shopping-bj.example.com", status: SiteStatus.PENDING, weight: 380 },
  { domain: "stream-fr-bj.example.com", status: SiteStatus.PENDING, weight: 340 },
  { domain: "annonces-bj.example.com", status: SiteStatus.PENDING, weight: 300 },
  { domain: "messagerie-pro-bj.example.com", status: SiteStatus.PENDING, weight: 260 },
  { domain: "petites-annonces.example.com", status: SiteStatus.PENDING, weight: 220 },
];

const SALT = "demo-seed-salt";

function hashIp(ip: string): string {
  return createHmac("sha256", SALT).update(ip).digest("hex");
}

function randomIp(): string {
  return `${10 + Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256,
  )}.${Math.floor(Math.random() * 256)}`;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function ensureUser() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No user found — run npm run db:seed first");
  return user;
}

async function ensureSource() {
  let source = await prisma.ingestSource.findUnique({ where: { name: "DEMO_SOURCE" } });
  if (!source) {
    source = await prisma.ingestSource.create({
      data: {
        name: "DEMO_SOURCE",
        description: "Source synthétique pour démo / développement",
        isActive: true,
      },
    });
  }
  return source;
}

async function clearDemo() {
  console.log("→ Cleaning previous demo data…");
  await prisma.scanResult.deleteMany({});
  await prisma.scanRun.deleteMany({});
  await prisma.siteClassification.deleteMany({});
  await prisma.blockRule.deleteMany({});
  await prisma.trafficSample.deleteMany({});
  await prisma.site.deleteMany({});
}

async function seedSites(actorId: string) {
  console.log(`→ Seeding ${DEMO_DOMAINS.length} sites…`);
  const now = new Date();

  for (const def of DEMO_DOMAINS) {
    const firstSeen = new Date(now.getTime() - (5 + Math.random() * 25) * 24 * 60 * 60 * 1000);
    const trafficScore = def.weight * (0.8 + Math.random() * 0.4);

    const site = await prisma.site.upsert({
      where: { domain: def.domain },
      create: {
        domain: def.domain,
        firstSeenAt: firstSeen,
        lastSeenAt: now,
        status: def.status,
        trafficScore,
      },
      update: {
        status: def.status,
        trafficScore,
        lastSeenAt: now,
      },
    });

    if (def.status !== SiteStatus.PENDING) {
      await prisma.siteClassification.create({
        data: {
          siteId: site.id,
          actorId,
          fromState: SiteStatus.PENDING,
          toState: def.status,
          reason: classificationReason(def.status, def.domain),
        },
      });
    }

    if (def.status === SiteStatus.DANGEROUS) {
      await prisma.blockRule.upsert({
        where: { type_value: { type: BlockRuleType.DOMAIN, value: def.domain } },
        create: {
          type: BlockRuleType.DOMAIN,
          value: def.domain,
          siteId: site.id,
          reason: "Démo: site frauduleux confirmé",
          isActive: true,
        },
        update: { isActive: true, revokedAt: null },
      });
    }

    if (Math.random() < 0.6) {
      const startedAt = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      const finishedAt = new Date(startedAt.getTime() + (10 + Math.random() * 50) * 1000);
      const aggregateVerdict = statusToVerdict(def.status);
      const aggregateScore =
        aggregateVerdict === ScanVerdict.MALICIOUS
          ? 0.7 + Math.random() * 0.3
          : aggregateVerdict === ScanVerdict.SUSPICIOUS
          ? 0.3 + Math.random() * 0.2
          : Math.random() * 0.15;

      const scan = await prisma.scanRun.create({
        data: {
          siteId: site.id,
          startedAt,
          finishedAt,
          aggregateVerdict,
          aggregateScore,
        },
      });

      const providers: ScanProvider[] = [
        ScanProvider.GOOGLE_SAFE_BROWSING,
        ScanProvider.PHISHTANK,
        ScanProvider.URLSCAN,
        ScanProvider.VIRUSTOTAL,
      ];
      for (const provider of providers) {
        const verdict = jitterVerdict(aggregateVerdict);
        await prisma.scanResult.create({
          data: {
            scanRunId: scan.id,
            provider,
            verdict,
            score: verdict === ScanVerdict.MALICIOUS ? 0.9 : verdict === ScanVerdict.SUSPICIOUS ? 0.5 : 0,
            rawJson: { demo: true, provider } satisfies Prisma.InputJsonValue,
          },
        });
      }
    }
  }
}

async function seedTraffic(sourceId: string) {
  console.log("→ Seeding 14 days of traffic samples…");
  const now = new Date();
  const samples: Array<{
    ts: Date;
    srcIpHash: string;
    dstDomain: string;
    bytes: bigint;
    countryIso: string;
    sourceId: string;
  }> = [];

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - dayOffset);

    for (const def of DEMO_DOMAINS) {
      const sampleCount = Math.max(1, Math.floor(def.weight / 200 + Math.random() * 5));
      for (let i = 0; i < sampleCount; i++) {
        const ts = new Date(day.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000));
        const ip = randomIp();
        const bytes = BigInt(Math.floor((1 + Math.random() * 50) * 1024));
        samples.push({
          ts,
          srcIpHash: hashIp(`${ip}-${dayOffset}-${i}`),
          dstDomain: def.domain,
          bytes,
          countryIso: pick(["BJ", "BJ", "BJ", "BJ", "TG", "NG"]),
          sourceId,
        });
      }
    }
  }

  console.log(`  ${samples.length} samples`);
  await prisma.trafficSample.createMany({ data: samples, skipDuplicates: true });
}

async function seedAuditEvents(actorId: string) {
  console.log("→ Seeding audit events…");
  const now = new Date();
  const events = DEMO_DOMAINS.filter((d) => d.status === SiteStatus.DANGEROUS).map((d, i) => ({
    actorId,
    action: "BLOCK_ADD" as const,
    target: d.domain,
    reason: "Démo: ajout automatique suite à classification DANGEROUS",
    createdAt: new Date(now.getTime() - (i + 1) * 60 * 60 * 1000),
  }));
  if (events.length > 0) {
    await prisma.auditEvent.createMany({ data: events });
  }
}

function classificationReason(status: SiteStatus, domain: string): string {
  switch (status) {
    case SiteStatus.DANGEROUS:
      return `Phishing / fraude financière confirmée sur ${domain}`;
    case SiteStatus.SUSPICIOUS:
      return `Indicateurs de fraude (TLS récent, mots-clés sensibles) sur ${domain}`;
    case SiteStatus.SAFE:
      return `Service grand public légitime`;
    case SiteStatus.WHITELISTED:
      return `Service institutionnel — liste blanche permanente`;
    default:
      return "";
  }
}

function statusToVerdict(status: SiteStatus): ScanVerdict {
  switch (status) {
    case SiteStatus.DANGEROUS:
      return ScanVerdict.MALICIOUS;
    case SiteStatus.SUSPICIOUS:
      return ScanVerdict.SUSPICIOUS;
    case SiteStatus.SAFE:
    case SiteStatus.WHITELISTED:
      return ScanVerdict.SAFE;
    default:
      return ScanVerdict.NO_DATA;
  }
}

function jitterVerdict(base: ScanVerdict): ScanVerdict {
  if (base === ScanVerdict.MALICIOUS) {
    return Math.random() < 0.8 ? ScanVerdict.MALICIOUS : ScanVerdict.SUSPICIOUS;
  }
  if (base === ScanVerdict.SUSPICIOUS) {
    return Math.random() < 0.5 ? ScanVerdict.SUSPICIOUS : Math.random() < 0.5 ? ScanVerdict.SAFE : ScanVerdict.MALICIOUS;
  }
  return Math.random() < 0.9 ? ScanVerdict.SAFE : ScanVerdict.SUSPICIOUS;
}

async function main() {
  console.log(`\n=== web-safeguard demo seed ===`);
  console.log(`DB: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const user = await ensureUser();
  const source = await ensureSource();

  await clearDemo();
  await seedSites(user.id);
  await seedTraffic(source.id);
  await seedAuditEvents(user.id);

  const counts = {
    sites: await prisma.site.count(),
    blockRules: await prisma.blockRule.count({ where: { isActive: true } }),
    trafficSamples: await prisma.trafficSample.count(),
    scanRuns: await prisma.scanRun.count(),
    auditEvents: await prisma.auditEvent.count(),
  };

  console.log("\n✓ Demo seed complete:");
  console.log(`  ${counts.sites} sites`);
  console.log(`  ${counts.blockRules} active block rules`);
  console.log(`  ${counts.trafficSamples} traffic samples`);
  console.log(`  ${counts.scanRuns} scan runs`);
  console.log(`  ${counts.auditEvents} audit events`);
  console.log(`\n→ Refresh /dashboard to see the data.`);
  void randomBytes;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
