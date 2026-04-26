"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, BlockRuleType, Prisma, SiteStatus } from "@/app/generated/prisma";
import { logAudit } from "@/lib/audit";
import { sanitizeCountries } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";
import { enqueueScansForSites, drainPendingScans } from "@/lib/scan/queue";
import { notifyBlocklistChanged } from "@/lib/webhook/delivery";

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

const acceptSchema = z.object({
  siteId: z.string().min(1),
  country: z.string().length(2),
  reason: z.string().max(500).optional(),
});

export type AcceptSuggestionState = {
  ok: boolean;
  error: string | null;
  domain?: string;
};

export async function acceptSuggestion(
  _prev: AcceptSuggestionState,
  formData: FormData,
): Promise<AcceptSuggestionState> {
  let user;
  try {
    user = await requireRole("OPERATOR");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = acceptSchema.safeParse({
    siteId: formData.get("siteId"),
    country: formData.get("country"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const country = parsed.data.country.toUpperCase();
  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return { ok: false, error: "Site introuvable" };

  const reason =
    parsed.data.reason ??
    `Blocage automatique via suggestion (trust=${site.trustScore ?? "?"})`;

  await prisma.$transaction(async (tx) => {
    if (site.status !== SiteStatus.DANGEROUS) {
      await tx.site.update({
        where: { id: site.id },
        data: { status: SiteStatus.DANGEROUS },
      });
      await tx.siteClassification.create({
        data: {
          siteId: site.id,
          actorId: user.id,
          fromState: site.status,
          toState: SiteStatus.DANGEROUS,
          reason,
        },
      });
      await logAudit(
        {
          actorId: user.id,
          action: AuditAction.SITE_CLASSIFY,
          target: site.domain,
          before: { status: site.status } satisfies Prisma.InputJsonValue,
          after: { status: SiteStatus.DANGEROUS } satisfies Prisma.InputJsonValue,
          reason,
        },
        tx,
      );
    }

    const existing = await tx.blockRule.findUnique({
      where: { type_value: { type: BlockRuleType.DOMAIN, value: site.domain } },
    });
    const merged = mergeCountries(existing?.countries ?? [], [country]);

    if (existing) {
      await tx.blockRule.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          revokedAt: null,
          countries: merged,
          reason,
        },
      });
    } else {
      await tx.blockRule.create({
        data: {
          type: BlockRuleType.DOMAIN,
          value: site.domain,
          siteId: site.id,
          reason,
          isActive: true,
          countries: merged,
        },
      });
    }

    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.BLOCK_ADD,
        target: site.domain,
        reason,
        before: existing
          ? ({ countries: existing.countries } satisfies Prisma.InputJsonValue)
          : null,
        after: {
          countries: merged,
          viaSuggestion: true,
          trustScore: site.trustScore,
        } satisfies Prisma.InputJsonValue,
      },
      tx,
    );
  });

  notifyBlocklistChanged().catch((err) => {
    console.error("Webhook delivery failed:", err);
  });

  revalidatePath("/intelligence");
  revalidatePath("/sites");
  revalidatePath(`/sites/${parsed.data.siteId}`);
  revalidatePath("/blocklist");
  revalidatePath("/audit");
  revalidatePath("/dashboard");

  return { ok: true, error: null, domain: site.domain };
}

function mergeCountries(existing: readonly string[], adding: readonly string[]): string[] {
  if (existing.length === 0 || adding.length === 0) return [];
  return [...new Set([...existing, ...adding])];
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
