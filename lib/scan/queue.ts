import { ScanRunStatus } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { runScan } from "@/lib/scan/runner";

const DEFAULT_BATCH = 20;
const DEFAULT_CONCURRENCY = 10;

export type EnqueueResult = {
  enqueued: number;
  alreadyPending: number;
};

export async function enqueueScansForSites(
  siteIds: string[],
  options: { requesterId?: string; countries?: string[] } = {},
): Promise<EnqueueResult> {
  if (siteIds.length === 0) return { enqueued: 0, alreadyPending: 0 };

  const existing = await prisma.scanRun.findMany({
    where: {
      siteId: { in: siteIds },
      status: { in: [ScanRunStatus.PENDING, ScanRunStatus.RUNNING] },
    },
    select: { siteId: true },
  });
  const alreadyPendingIds = new Set(existing.map((s) => s.siteId));

  const toCreate = siteIds.filter((id) => !alreadyPendingIds.has(id));
  if (toCreate.length === 0) {
    return { enqueued: 0, alreadyPending: alreadyPendingIds.size };
  }

  await prisma.scanRun.createMany({
    data: toCreate.map((siteId) => ({
      siteId,
      requesterId: options.requesterId ?? null,
      countries: options.countries ?? [],
      status: ScanRunStatus.PENDING,
    })),
  });

  return { enqueued: toCreate.length, alreadyPending: alreadyPendingIds.size };
}

export type DrainResult = {
  picked: number;
  succeeded: number;
  failed: number;
  durationMs: number;
};

export async function drainPendingScans(
  options: { batch?: number; concurrency?: number } = {},
): Promise<DrainResult> {
  const batch = options.batch ?? DEFAULT_BATCH;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const startedAt = Date.now();

  const claimed = await claimBatch(batch);
  if (claimed.length === 0) {
    return { picked: 0, succeeded: 0, failed: 0, durationMs: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < claimed.length; i += concurrency) {
    const slice = claimed.slice(i, i + concurrency);
    const settled = await Promise.allSettled(slice.map((id) => runScan(id)));
    for (const r of settled) {
      if (r.status === "fulfilled") succeeded++;
      else failed++;
    }
  }

  return {
    picked: claimed.length,
    succeeded,
    failed,
    durationMs: Date.now() - startedAt,
  };
}

async function claimBatch(limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "ScanRun"
    SET "status" = 'RUNNING', "startedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "ScanRun"
      WHERE "status" = 'PENDING'
      ORDER BY "startedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING "id"
  `;
  return rows.map((r) => r.id);
}

export type QueueStats = {
  pending: number;
  running: number;
  doneRecent: number;
  failedRecent: number;
};

export async function getQueueStats(sinceMs = 24 * 60 * 60 * 1000): Promise<QueueStats> {
  const since = new Date(Date.now() - sinceMs);
  const [pending, running, doneRecent, failedRecent] = await Promise.all([
    prisma.scanRun.count({ where: { status: ScanRunStatus.PENDING } }),
    prisma.scanRun.count({ where: { status: ScanRunStatus.RUNNING } }),
    prisma.scanRun.count({
      where: { status: ScanRunStatus.DONE, finishedAt: { gte: since } },
    }),
    prisma.scanRun.count({
      where: { status: ScanRunStatus.FAILED, finishedAt: { gte: since } },
    }),
  ]);
  return { pending, running, doneRecent, failedRecent };
}
