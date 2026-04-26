"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuditAction,
  BlockRuleType,
  Prisma,
  SiteStatus,
} from "@/app/generated/prisma";
import { sanitizeCountries, formatCountries } from "@/lib/countries";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";
import { runScan } from "@/lib/scan/runner";
import { notifyBlocklistChanged } from "@/lib/webhook/delivery";

const classifySchema = z.object({
  siteId: z.string().min(1),
  toState: z.enum(SiteStatus),
  reason: z.string().max(500).optional(),
});

export type ClassifyState = { ok: boolean; error: string | null };

export async function classifySite(
  _prev: ClassifyState,
  formData: FormData,
): Promise<ClassifyState> {
  let user;
  try {
    user = await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = classifySchema.safeParse({
    siteId: formData.get("siteId"),
    toState: formData.get("toState"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { siteId, toState, reason } = parsed.data;
  const blocklistChange = { changed: false };

  await prisma.$transaction(async (tx) => {
    const before = await tx.site.findUnique({ where: { id: siteId } });
    if (!before) throw new Error("Site introuvable");
    if (before.status === toState) return;

    const after = await tx.site.update({
      where: { id: siteId },
      data: { status: toState },
    });

    await tx.siteClassification.create({
      data: {
        siteId,
        actorId: user.id,
        fromState: before.status,
        toState,
        reason,
      },
    });

    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.SITE_CLASSIFY,
        target: before.domain,
        before: { status: before.status } satisfies Prisma.InputJsonValue,
        after: { status: after.status } satisfies Prisma.InputJsonValue,
        reason,
      },
      tx,
    );

    if (toState === SiteStatus.DANGEROUS) {
      await tx.blockRule.upsert({
        where: { type_value: { type: BlockRuleType.DOMAIN, value: before.domain } },
        create: {
          type: BlockRuleType.DOMAIN,
          value: before.domain,
          siteId,
          reason: reason ?? "Classified DANGEROUS",
          isActive: true,
          countries: [],
        },
        update: { isActive: true, revokedAt: null, reason: reason ?? "Re-activated" },
      });
      await logAudit(
        {
          actorId: user.id,
          action: AuditAction.BLOCK_ADD,
          target: before.domain,
          reason,
          after: { countries: [] } satisfies Prisma.InputJsonValue,
        },
        tx,
      );
      blocklistChange.changed = true;
    } else if (before.status === SiteStatus.DANGEROUS) {
      const rule = await tx.blockRule.findUnique({
        where: { type_value: { type: BlockRuleType.DOMAIN, value: before.domain } },
      });
      if (rule && rule.isActive) {
        await tx.blockRule.update({
          where: { id: rule.id },
          data: { isActive: false, revokedAt: new Date() },
        });
        await logAudit(
          {
            actorId: user.id,
            action: AuditAction.BLOCK_REMOVE,
            target: before.domain,
            reason: reason ?? `Classification changed to ${toState}`,
          },
          tx,
        );
        blocklistChange.changed = true;
      }
    }
  });

  if (blocklistChange.changed) {
    notifyBlocklistChanged().catch((err) => {
      console.error("Webhook delivery failed:", err);
    });
  }

  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/blocklist");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  return { ok: true, error: null };
}

const blockSchema = z.object({
  siteId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type BlockState = { ok: boolean; error: string | null };

export async function blockSite(
  _prev: BlockState,
  formData: FormData,
): Promise<BlockState> {
  let user;
  try {
    user = await requireRole("OPERATOR");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = blockSchema.safeParse({
    siteId: formData.get("siteId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const countries = sanitizeCountries(formData.getAll("countries"));

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return { ok: false, error: "Site introuvable" };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.blockRule.findUnique({
      where: { type_value: { type: BlockRuleType.DOMAIN, value: site.domain } },
    });

    const merged = existing
      ? mergeCountries(existing.countries, countries)
      : countries;

    if (existing) {
      await tx.blockRule.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          revokedAt: null,
          countries: merged,
          reason: parsed.data.reason ?? existing.reason ?? "Manual block",
        },
      });
    } else {
      await tx.blockRule.create({
        data: {
          type: BlockRuleType.DOMAIN,
          value: site.domain,
          siteId: site.id,
          reason: parsed.data.reason ?? "Manual block",
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
        reason: parsed.data.reason,
        before: existing
          ? ({ countries: existing.countries } satisfies Prisma.InputJsonValue)
          : null,
        after: { countries: merged } satisfies Prisma.InputJsonValue,
      },
      tx,
    );
  });

  notifyBlocklistChanged().catch((err) => {
    console.error("Webhook delivery failed:", err);
  });

  revalidatePath(`/sites/${site.id}`);
  revalidatePath("/sites");
  revalidatePath("/blocklist");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  return { ok: true, error: null };
}

const unblockSchema = z.object({ siteId: z.string().min(1) });

export type UnblockState = { ok: boolean; error: string | null };

export async function unblockSite(
  _prev: UnblockState,
  formData: FormData,
): Promise<UnblockState> {
  let user;
  try {
    user = await requireRole("OPERATOR");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = unblockSchema.safeParse({ siteId: formData.get("siteId") });
  if (!parsed.success) return { ok: false, error: "Site invalide" };

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return { ok: false, error: "Site introuvable" };

  const rule = await prisma.blockRule.findUnique({
    where: { type_value: { type: BlockRuleType.DOMAIN, value: site.domain } },
  });
  if (!rule || !rule.isActive) return { ok: false, error: "Aucune règle active" };

  await prisma.$transaction(async (tx) => {
    await tx.blockRule.update({
      where: { id: rule.id },
      data: { isActive: false, revokedAt: new Date() },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.BLOCK_REMOVE,
        target: site.domain,
        before: { countries: rule.countries } satisfies Prisma.InputJsonValue,
      },
      tx,
    );
  });

  notifyBlocklistChanged().catch((err) => {
    console.error("Webhook delivery failed:", err);
  });

  revalidatePath(`/sites/${site.id}`);
  revalidatePath("/sites");
  revalidatePath("/blocklist");
  revalidatePath("/audit");
  return { ok: true, error: null };
}

const bulkBlockSchema = z.object({
  status: z.enum(SiteStatus).optional(),
  query: z.string().max(120).optional(),
  reason: z.string().max(500).optional(),
});

export type BulkBlockState = {
  ok: boolean;
  error: string | null;
  blocked?: number;
  scope?: string;
};

export async function bulkBlockSites(
  _prev: BulkBlockState,
  formData: FormData,
): Promise<BulkBlockState> {
  let user;
  try {
    user = await requireRole("OPERATOR");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = bulkBlockSchema.safeParse({
    status: formData.get("status") || undefined,
    query: formData.get("query") || undefined,
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const countries = sanitizeCountries(formData.getAll("countries"));

  const sites = await prisma.site.findMany({
    where: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.query
        ? { domain: { contains: parsed.data.query, mode: "insensitive" } }
        : {}),
    },
    select: { id: true, domain: true },
    take: 1000,
  });

  if (sites.length === 0) {
    return { ok: false, error: "Aucun site ne correspond aux filtres" };
  }

  let blocked = 0;
  await prisma.$transaction(async (tx) => {
    for (const site of sites) {
      const existing = await tx.blockRule.findUnique({
        where: { type_value: { type: BlockRuleType.DOMAIN, value: site.domain } },
      });
      const merged = existing
        ? mergeCountries(existing.countries, countries)
        : countries;

      if (existing) {
        await tx.blockRule.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            revokedAt: null,
            countries: merged,
            reason: parsed.data.reason ?? existing.reason ?? "Bulk block",
          },
        });
      } else {
        await tx.blockRule.create({
          data: {
            type: BlockRuleType.DOMAIN,
            value: site.domain,
            siteId: site.id,
            reason: parsed.data.reason ?? "Bulk block",
            isActive: true,
            countries: merged,
          },
        });
      }
      blocked++;
    }

    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.BLOCK_BULK_ADD,
        target: `${blocked} site(s)`,
        reason: parsed.data.reason,
        after: {
          countries,
          status: parsed.data.status ?? "ALL",
          query: parsed.data.query ?? null,
          domains: sites.slice(0, 50).map((s) => s.domain),
          totalDomains: sites.length,
        } satisfies Prisma.InputJsonValue,
      },
      tx,
    );
  });

  notifyBlocklistChanged().catch((err) => {
    console.error("Webhook delivery failed:", err);
  });

  revalidatePath("/sites");
  revalidatePath("/blocklist");
  revalidatePath("/audit");
  revalidatePath("/dashboard");

  return {
    ok: true,
    error: null,
    blocked,
    scope: formatCountries(countries),
  };
}

const rescanSchema = z.object({ siteId: z.string().min(1) });

export type RescanState = { ok: boolean; error: string | null };

export async function requestRescan(
  _prev: RescanState,
  formData: FormData,
): Promise<RescanState> {
  let user;
  try {
    user = await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = rescanSchema.safeParse({ siteId: formData.get("siteId") });
  if (!parsed.success) return { ok: false, error: "Site invalide" };

  const countries = sanitizeCountries(formData.getAll("countries"));

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return { ok: false, error: "Site introuvable" };

  const scanRun = await prisma.$transaction(async (tx) => {
    const run = await tx.scanRun.create({
      data: {
        siteId: site.id,
        requesterId: user.id,
        countries,
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.SITE_RESCAN,
        target: site.domain,
        after: { countries } satisfies Prisma.InputJsonValue,
      },
      tx,
    );
    return run;
  });

  runScan(scanRun.id).catch((err) => {
    console.error(`Scan ${scanRun.id} failed:`, err);
  });

  revalidatePath(`/sites/${site.id}`);
  revalidatePath("/audit");
  return { ok: true, error: null };
}

function mergeCountries(existing: readonly string[], adding: readonly string[]): string[] {
  if (existing.length === 0 || adding.length === 0) return [];
  const merged = new Set([...existing, ...adding]);
  return [...merged];
}
