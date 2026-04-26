import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const FALLBACK_SALT = env.IP_HASH_SALT ?? "ws-dev-only-salt-rotate-before-prod";

let cachedCurrentSalt: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function getCurrentSalt(): Promise<string> {
  const now = Date.now();
  if (cachedCurrentSalt && now - cachedAt < CACHE_TTL_MS) return cachedCurrentSalt;

  const current = await prisma.hashSalt.findFirst({ where: { isCurrent: true } });
  cachedCurrentSalt = current?.saltCipher ?? FALLBACK_SALT;
  cachedAt = now;
  return cachedCurrentSalt;
}

export async function hashIp(ip: string): Promise<string> {
  const salt = await getCurrentSalt();
  return createHmac("sha256", salt).update(ip).digest("hex");
}

export function hashIpSync(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

export async function rotateSalt(): Promise<{ id: string }> {
  const newSalt = randomBytes(32).toString("hex");
  return prisma.$transaction(async (tx) => {
    await tx.hashSalt.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false, retiredAt: new Date() },
    });
    const created = await tx.hashSalt.create({
      data: { saltCipher: newSalt, isCurrent: true },
    });
    cachedCurrentSalt = null;
    return { id: created.id };
  });
}
