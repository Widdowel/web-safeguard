"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuditAction,
  BlockRuleType,
  Prisma,
  SiteStatus,
} from "@/app/generated/prisma";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";
import { runScan } from "@/lib/scan/runner";

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
        },
        update: { isActive: true, revokedAt: null, reason: reason ?? "Re-activated" },
      });
      await logAudit(
        {
          actorId: user.id,
          action: AuditAction.BLOCK_ADD,
          target: before.domain,
          reason,
        },
        tx,
      );
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
      }
    }
  });

  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/blocklist");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  return { ok: true, error: null };
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

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return { ok: false, error: "Site introuvable" };

  const scanRun = await prisma.$transaction(async (tx) => {
    const run = await tx.scanRun.create({
      data: { siteId: site.id, requesterId: user.id },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.SITE_RESCAN,
        target: site.domain,
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
