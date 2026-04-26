import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

export type CountryTraffic = {
  country: string;
  totalBytes: bigint;
  totalSamples: bigint;
  uniqueDomains: number;
};

export async function getTrafficByCountry(limit = 20): Promise<CountryTraffic[]> {
  const rows = await prisma.$queryRaw<
    Array<{ country: string; bytes: bigint; samples: bigint; domains: bigint }>
  >`
    SELECT "countryIso" AS country,
           COALESCE(SUM("bytes"), 0)::bigint AS bytes,
           COUNT(*)::bigint AS samples,
           COUNT(DISTINCT "dstDomain")::bigint AS domains
    FROM "TrafficSample"
    GROUP BY "countryIso"
    ORDER BY bytes DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    country: r.country,
    totalBytes: r.bytes,
    totalSamples: r.samples,
    uniqueDomains: Number(r.domains),
  }));
}

export type SiteByTraffic = {
  siteId: string;
  domain: string;
  status: string;
  trustScore: number | null;
  lastScanAt: Date | null;
  totalBytes: bigint;
  totalSamples: number;
  pendingScan: boolean;
};

export async function getTopSitesForCountry(
  country: string,
  options: { limit?: number; sinceDays?: number; onlyUnscanned?: boolean } = {},
): Promise<SiteByTraffic[]> {
  const limit = options.limit ?? 50;
  const sinceDays = options.sinceDays ?? 14;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<
    Array<{
      siteId: string;
      domain: string;
      status: string;
      trustScore: number | null;
      lastScanAt: Date | null;
      bytes: bigint;
      samples: bigint;
      pending: bigint;
    }>
  >(
    Prisma.sql`
      SELECT s."id" AS "siteId",
             s."domain",
             s."status",
             s."trustScore",
             s."lastScanAt",
             COALESCE(SUM(t."bytes"), 0)::bigint AS bytes,
             COUNT(t."id")::bigint AS samples,
             (SELECT COUNT(*) FROM "ScanRun" sr
              WHERE sr."siteId" = s."id"
              AND sr."status" IN ('PENDING','RUNNING'))::bigint AS pending
      FROM "Site" s
      JOIN "TrafficSample" t ON t."dstDomain" = s."domain"
      WHERE t."countryIso" = ${country}
        AND t."ts" >= ${since}
        ${options.onlyUnscanned ? Prisma.sql`AND s."lastScanAt" IS NULL` : Prisma.empty}
      GROUP BY s."id", s."domain", s."status", s."trustScore", s."lastScanAt"
      ORDER BY bytes DESC
      LIMIT ${limit}
    `,
  );

  return rows.map((r) => ({
    siteId: r.siteId,
    domain: r.domain,
    status: r.status,
    trustScore: r.trustScore,
    lastScanAt: r.lastScanAt,
    totalBytes: r.bytes,
    totalSamples: Number(r.samples),
    pendingScan: Number(r.pending) > 0,
  }));
}

export type CountryTrustDistribution = {
  veryHigh: number;
  high: number;
  moderate: number;
  low: number;
  veryLow: number;
  unscanned: number;
};

export async function getCountryTrustDistribution(
  country: string,
  sinceDays = 14,
): Promise<CountryTrustDistribution> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<
    Array<{ bucket: string; n: bigint }>
  >(
    Prisma.sql`
      WITH country_sites AS (
        SELECT DISTINCT s."id", s."trustScore"
        FROM "Site" s
        JOIN "TrafficSample" t ON t."dstDomain" = s."domain"
        WHERE t."countryIso" = ${country} AND t."ts" >= ${since}
      )
      SELECT bucket, COUNT(*)::bigint AS n
      FROM (
        SELECT CASE
          WHEN "trustScore" IS NULL THEN 'unscanned'
          WHEN "trustScore" >= 80 THEN 'veryHigh'
          WHEN "trustScore" >= 60 THEN 'high'
          WHEN "trustScore" >= 40 THEN 'moderate'
          WHEN "trustScore" >= 20 THEN 'low'
          ELSE 'veryLow'
        END AS bucket
        FROM country_sites
      ) buckets
      GROUP BY bucket
    `,
  );

  const out: CountryTrustDistribution = {
    veryHigh: 0,
    high: 0,
    moderate: 0,
    low: 0,
    veryLow: 0,
    unscanned: 0,
  };
  for (const r of rows) {
    const k = r.bucket as keyof CountryTrustDistribution;
    if (k in out) out[k] = Number(r.n);
  }
  return out;
}
