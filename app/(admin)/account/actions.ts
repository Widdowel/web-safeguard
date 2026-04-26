"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction } from "@/app/generated/prisma";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireSession } from "@/lib/rbac";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(10, "Le nouveau mot de passe doit faire au moins 10 caractères"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux mots de passe ne correspondent pas",
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l'actuel",
  });

export type ChangePasswordState = { ok: boolean; error: string | null };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.hashedPassword) {
    return { ok: false, error: "Compte sans mot de passe (OAuth uniquement)" };
  }

  const validCurrent = await compare(parsed.data.currentPassword, dbUser.hashedPassword);
  if (!validCurrent) {
    return { ok: false, error: "Mot de passe actuel incorrect" };
  }

  const newHash = await hash(parsed.data.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { hashedPassword: newHash },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.PASSWORD_CHANGE,
        target: user.email,
      },
      tx,
    );
  });

  revalidatePath("/account");
  return { ok: true, error: null };
}
