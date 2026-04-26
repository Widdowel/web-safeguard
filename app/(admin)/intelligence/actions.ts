"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";
import { sanitizeCountries } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";
import { enqueueScansForSites, drainPendingScans } from "@/lib/scan/queue";

const enqueueSchema = z.object({
  country: z.string().length(2),
  limit: z.coerce.number().int().min(1).max(5000).default(100),
  onlyUnscanned: z.coerce.boolean().default(false),
});

export type EnqueueState = {
  ok: boolean;
  error: string | null;
  enqueued?: number;
  alreadyPending?: number;
  picked?: number;
};

export async function enqueueScansForCountry(
  _prev: EnqueueState,
  formData: FormData,
): Promise<EnqueueState> {
  let user;
  try {
    user = await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = enqueueSchema.safeParse({
    country: formData.get("country"),
    limit: formData.get("limit"),
    onlyUnscanned: formData.get("onlyUnscanned"),
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const country = parsed.data.country.toUpperCase();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const sites = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT s."id"
      FROM "Site" s
      JOIN "TrafficSample" t ON t."dstDomain" = s."domain"
      WHERE t."countryIso" = ${country}
        AND t."ts" >= ${since}
        ${parsed.data.onlyUnscanned ? Prisma.sql`AND s."lastScanAt" IS NULL` : Prisma.empty}
      GROUP BY s."id", s."trafficScore"
      ORDER BY SUM(t."bytes") DESC
      LIMIT ${parsed.data.limit}
    `,
  );

  if (sites.length === 0) {
    return { ok: false, error: "Aucun site éligible pour ce pays" };
  }

  const enqueueResult = await enqueueScansForSites(
    sites.map((s) => s.id),
    { requesterId: user.id, countries: [country] },
  );

  kickWorker().catch(() => {});

  revalidatePath("/intelligence");
  revalidatePath("/sites");

  return {
    ok: true,
    error: null,
    enqueued: enqueueResult.enqueued,
    alreadyPending: enqueueResult.alreadyPending,
  };
}

const enqueueSitesSchema = z.object({
  siteIds: z.array(z.string().min(1)).min(1).max(5000),
});

export async function enqueueScansForSiteIdsAction(
  siteIds: string[],
  countries: string[] = [],
): Promise<EnqueueState> {
  let user;
  try {
    user = await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = enqueueSitesSchema.safeParse({ siteIds });
  if (!parsed.success) return { ok: false, error: "Sélection invalide" };

  const sanitized = sanitizeCountries(countries);
  const result = await enqueueScansForSites(parsed.data.siteIds, {
    requesterId: user.id,
    countries: sanitized,
  });

  kickWorker().catch(() => {});

  revalidatePath("/intelligence");
  revalidatePath("/sites");

  return {
    ok: true,
    error: null,
    enqueued: result.enqueued,
    alreadyPending: result.alreadyPending,
  };
}

export async function drainQueueOnce(): Promise<EnqueueState> {
  try {
    await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const result = await drainPendingScans({ batch: 30, concurrency: 10 });
  revalidatePath("/intelligence");
  return {
    ok: true,
    error: null,
    picked: result.picked,
  };
}

async function kickWorker(): Promise<void> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (!base) return;

  const url = base.startsWith("http") ? `${base}/api/scan/worker` : `https://${base}/api/scan/worker`;
  const headers: Record<string, string> = {};
  if (process.env.SCAN_WORKER_TOKEN) {
    headers.authorization = `Bearer ${process.env.SCAN_WORKER_TOKEN}`;
  }

  for (let i = 0; i < 3; i++) {
    fetch(url, { method: "POST", headers, signal: AbortSignal.timeout(2000) }).catch(() => {});
  }
}
