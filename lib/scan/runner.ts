import type { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { aggregateResults } from "@/lib/scan/aggregate";
import { googleSafeBrowsing } from "@/lib/scan/providers/google-safe-browsing";
import { phishtank } from "@/lib/scan/providers/phishtank";
import { urlscan } from "@/lib/scan/providers/urlscan";
import { virustotal } from "@/lib/scan/providers/virustotal";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";

const PROVIDERS: ProviderRunner[] = [googleSafeBrowsing, phishtank, urlscan, virustotal];

export async function runScan(scanRunId: string): Promise<void> {
  const scanRun = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { site: { select: { domain: true } } },
  });
  if (!scanRun) throw new Error(`Scan run ${scanRunId} not found`);

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
        finishedAt: new Date(),
        aggregateVerdict: aggregate.verdict,
        aggregateScore: aggregate.score,
      },
    });
  });
}
