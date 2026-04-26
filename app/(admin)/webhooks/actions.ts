"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction } from "@/app/generated/prisma";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";
import { deliverToSubscriber } from "@/lib/webhook/delivery";
import { getActiveBlocklist } from "@/lib/blocklist/source";

const subscribeSchema = z.object({
  name: z.string().min(2).max(80),
  url: z.string().url(),
});

export type SubscribeState = {
  ok: boolean;
  error: string | null;
  plaintextSecret?: string;
};

export async function subscribeWebhook(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = subscribeSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  if (!parsed.data.url.startsWith("https://")) {
    return { ok: false, error: "L'URL doit utiliser HTTPS" };
  }

  const plaintextSecret = `wsh_${randomBytes(32).toString("hex")}`;
  const secretHash = createHash("sha256").update(plaintextSecret).digest("hex");

  await prisma.$transaction(async (tx) => {
    await tx.blocklistSubscriber.create({
      data: {
        name: parsed.data.name,
        url: parsed.data.url,
        secretHash,
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.WEBHOOK_SUBSCRIBE,
        target: parsed.data.name,
      },
      tx,
    );
  });

  revalidatePath("/webhooks");
  return { ok: true, error: null, plaintextSecret };
}

const unsubscribeSchema = z.object({ id: z.string().min(1) });

export type UnsubscribeState = { ok: boolean; error: string | null };

export async function unsubscribeWebhook(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = unsubscribeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide" };

  const subscriber = await prisma.blocklistSubscriber.findUnique({
    where: { id: parsed.data.id },
  });
  if (!subscriber) return { ok: false, error: "Webhook introuvable" };

  await prisma.$transaction(async (tx) => {
    await tx.blocklistSubscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.WEBHOOK_UNSUBSCRIBE,
        target: subscriber.name,
      },
      tx,
    );
  });

  revalidatePath("/webhooks");
  return { ok: true, error: null };
}

const triggerSchema = z.object({ id: z.string().min(1) });

export type TriggerState = {
  ok: boolean;
  error: string | null;
  result?: string;
};

export async function triggerWebhook(
  _prev: TriggerState,
  formData: FormData,
): Promise<TriggerState> {
  try {
    await requireRole("OPERATOR");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = triggerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide" };

  const snapshot = await getActiveBlocklist();
  const outcome = await deliverToSubscriber(parsed.data.id, snapshot.etag);

  revalidatePath("/webhooks");

  if (outcome.status === "succeeded") {
    return { ok: true, error: null, result: `OK (${outcome.responseCode}) en ${outcome.attempts} tentative(s)` };
  }
  return {
    ok: false,
    error: `Échec après ${outcome.attempts} tentative(s)${
      outcome.responseCode ? ` — code HTTP ${outcome.responseCode}` : ""
    }`,
  };
}
