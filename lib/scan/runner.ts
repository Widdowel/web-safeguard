import { type Prisma, ScanRunStatus } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { aggregateResults } from "@/lib/scan/aggregate";
import { googleSafeBrowsing } from "@/lib/scan/providers/google-safe-browsing";
import { internalCrawler } from "@/lib/scan/providers/internal-crawler";
import { phishtank } from "@/lib/scan/providers/phishtank";
import { urlscan } from "@/lib/scan/providers/urlscan";
import { virustotal } from "@/lib/scan/providers/virustotal";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";
import { trustScoreFromAggregate } from "@/lib/trust-score";

const PROVIDERS: ProviderRunner[] = [
  googleSafeBrowsing,
  phishtank,
  urlscan,
  virustotal,
  internalCrawler,
];

export async function runScan(scanRunId: string): Promise<void> {
  const scanRun = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { site: { select: { id: true, domain: true } } },
  });
  if (!scanRun) throw new Error(`Scan run ${scanRunId} not found`);

  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: { status: ScanRunStatus.RUNNING, startedAt: new Date() },
  });

  const enabled = PROVIDERS.filter((p) => p.enabled);
  const settled = await Promise.allSettled(
    enabled.map((p) => p.run({ domain: scanRun.site.domain })),
  );

  const results: ProviderResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          provider: enabled[i].name,
          verdict: "ERROR" as const,
          score: null,
          raw: { error: s.reason instanceof Error ? s.reason.message : String(s.reason) },
        },
  );

  const aggregate = aggregateResults(results);
  const trust = trustScoreFromAggregate(aggregate.score, aggregate.verdict);
  const finishedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      for (const r of results) {
        await tx.scanResult.upsert({
          where: { scanRunId_provider: { scanRunId, provider: r.provider } },
          create: {
            scanRunId,
            provider: r.provider,
            verdict: r.verdict,
            score: r.score,
            rawJson: r.raw as Prisma.InputJsonValue,
          },
          update: {
            verdict: r.verdict,
            score: r.score,
            rawJson: r.raw as Prisma.InputJsonValue,
          },
        });
      }

      await tx.scanRun.update({
        where: { id: scanRunId },
        data: {
          status: ScanRunStatus.DONE,
          finishedAt,
          aggregateVerdict: aggregate.verdict,
          aggregateScore: aggregate.score,
          trustScore: trust,
        },
      });

      await tx.site.update({
        where: { id: scanRun.site.id },
        data: {
          trustScore: trust,
          lastScanAt: finishedAt,
        },
      });
    });
  } catch (error) {
    await prisma.scanRun
      .update({
        where: { id: scanRunId },
        data: {
          status: ScanRunStatus.FAILED,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});
    throw error;
  }
}
