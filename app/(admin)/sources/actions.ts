"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction } from "@/app/generated/prisma";
import { logAudit } from "@/lib/audit";
import { hashIngestToken } from "@/lib/ingest/auth";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";

const createSourceSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9 _-]+$/, "Lettres, chiffres, espaces, '-' et '_' uniquement"),
  description: z.string().max(500).optional(),
});

export type CreateSourceState = {
  ok: boolean;
  error: string | null;
  sourceId?: string;
};

export async function createIngestSource(
  _prev: CreateSourceState,
  formData: FormData,
): Promise<CreateSourceState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = createSourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const existing = await prisma.ingestSource.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { ok: false, error: "Ce nom est déjà utilisé" };
  }

  const source = await prisma.$transaction(async (tx) => {
    const created = await tx.ingestSource.create({
      data: { name: parsed.data.name, description: parsed.data.description ?? null },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.INGEST_SOURCE_CREATE,
        target: created.name,
      },
      tx,
    );
    return created;
  });

  revalidatePath("/sources");
  return { ok: true, error: null, sourceId: source.id };
}

const createTokenSchema = z.object({
  sourceId: z.string().min(1),
  label: z.string().max(80).optional(),
  expiresInDays: z.coerce.number().int().min(0).max(3650).optional(),
});

export type CreateTokenState = {
  ok: boolean;
  error: string | null;
  plaintextToken?: string;
};

export async function createIngestToken(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = createTokenSchema.safeParse({
    sourceId: formData.get("sourceId"),
    label: formData.get("label") || undefined,
    expiresInDays: formData.get("expiresInDays") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const source = await prisma.ingestSource.findUnique({ where: { id: parsed.data.sourceId } });
  if (!source) return { ok: false, error: "Source introuvable" };

  const plaintext = `wsg_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashIngestToken(plaintext);

  const expiresAt =
    parsed.data.expiresInDays && parsed.data.expiresInDays > 0
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.ingestToken.create({
      data: {
        sourceId: source.id,
        tokenHash,
        label: parsed.data.label ?? null,
        expiresAt,
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.INGEST_TOKEN_CREATE,
        target: `${source.name}${parsed.data.label ? `:${parsed.data.label}` : ""}`,
      },
      tx,
    );
  });

  revalidatePath("/sources");
  return { ok: true, error: null, plaintextToken: plaintext };
}

const revokeTokenSchema = z.object({ tokenId: z.string().min(1) });

export type RevokeTokenState = { ok: boolean; error: string | null };

export async function revokeIngestToken(
  _prev: RevokeTokenState,
  formData: FormData,
): Promise<RevokeTokenState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = revokeTokenSchema.safeParse({ tokenId: formData.get("tokenId") });
  if (!parsed.success) return { ok: false, error: "Token invalide" };

  const token = await prisma.ingestToken.findUnique({
    where: { id: parsed.data.tokenId },
    include: { source: true },
  });
  if (!token) return { ok: false, error: "Token introuvable" };
  if (token.revokedAt) return { ok: false, error: "Token déjà révoqué" };

  await prisma.$transaction(async (tx) => {
    await tx.ingestToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.INGEST_TOKEN_REVOKE,
        target: `${token.source.name}${token.label ? `:${token.label}` : ""}`,
      },
      tx,
    );
  });

  revalidatePath("/sources");
  return { ok: true, error: null };
}

const toggleSourceSchema = z.object({
  sourceId: z.string().min(1),
  isActive: z.coerce.boolean(),
});

export type ToggleSourceState = { ok: boolean; error: string | null };

export async function toggleSourceActive(
  _prev: ToggleSourceState,
  formData: FormData,
): Promise<ToggleSourceState> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = toggleSourceSchema.safeParse({
    sourceId: formData.get("sourceId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  await prisma.ingestSource.update({
    where: { id: parsed.data.sourceId },
    data: { isActive: parsed.data.isActive },
  });

  revalidatePath("/sources");
  return { ok: true, error: null };
}
