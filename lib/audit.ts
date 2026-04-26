import type { Prisma } from "@/app/generated/prisma";
import { AuditAction } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

export type AuditPayload = {
  actorId?: string | null;
  action: AuditAction;
  target?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function logAudit(
  event: AuditPayload,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      actorId: event.actorId ?? null,
      action: event.action,
      target: event.target ?? null,
      before: event.before ?? undefined,
      after: event.after ?? undefined,
      reason: event.reason ?? null,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
    },
  });
}

export { AuditAction };
