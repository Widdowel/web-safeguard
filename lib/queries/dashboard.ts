import { Prisma, SiteStatus } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

export type DashboardSummary = {
  sitesByStatus: Record<SiteStatus, number>;
  totalSites: number;
  activeBlockRules: number;
  scansLast24h: number;
  trafficLast24h: bigint;
  ingestSources: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [byStatus, totalSites, activeBlockRules, scansLast24h, trafficAgg, ingestSources] =
    await Promise.all([
      prisma.site.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.site.count(),
      prisma.blockRule.count({ where: { isActive: true } }),
      prisma.scanRun.count({ where: { startedAt: { gte: since24h } } }),
      prisma.trafficSample.aggregate({
        where: { ts: { gte: since24h } },
        _sum: { bytes: true },
      }),
      prisma.ingestSource.count({ where: { isActive: true } }),
    ]);

  const sitesByStatus: Record<SiteStatus, number> = {
    PENDING: 0,
    SAFE: 0,
    SUSPICIOUS: 0,
    DANGEROUS: 0,
    WHITELISTED: 0,
  };
  for (const row of byStatus) {
    sitesByStatus[row.status] = row._count._all;
  }

  return {
    sitesByStatus,
    totalSites,
    activeBlockRules,
    scansLast24h,
    trafficLast24h: trafficAgg._sum.bytes ?? BigInt(0),
    ingestSources,
  };
}

export type TrafficByDay = { day: string; bytes: number; samples: number };

export async function getTrafficByDay(days = 14): Promise<TrafficByDay[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);

  const rows = await prisma.$queryRaw<Array<{ day: Date; bytes: bigint; samples: bigint }>>(
    Prisma.sql`
      SELECT date_trunc('day', "ts") AS day,
             COALESCE(SUM("bytes"), 0)::bigint AS bytes,
             COUNT(*)::bigint AS samples
      FROM "TrafficSample"
      WHERE "ts" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `,
  );

  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    bytes: Number(r.bytes),
    samples: Number(r.samples),
  }));
}

export type TopDomain = { domain: string; status: SiteStatus; trafficScore: number };

export async function getTopDomains(limit = 10): Promise<TopDomain[]> {
  const sites = await prisma.site.findMany({
    orderBy: { trafficScore: "desc" },
    take: limit,
    select: { domain: true, status: true, trafficScore: true },
  });
  return sites;
}
