import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const PEPPER = env.INGEST_TOKEN_PEPPER ?? "ws-dev-pepper-rotate-before-prod";

export function hashIngestToken(rawToken: string): string {
  return createHmac("sha256", PEPPER).update(rawToken).digest("hex");
}

export type AuthenticatedToken = {
  tokenId: string;
  sourceId: string;
  sourceName: string;
};

export async function authenticateIngestToken(
  rawToken: string,
): Promise<AuthenticatedToken | null> {
  const tokenHash = hashIngestToken(rawToken);
  const token = await prisma.ingestToken.findUnique({
    where: { tokenHash },
    include: { source: true },
  });

  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;
  if (!token.source.isActive) return null;

  await prisma.ingestToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    tokenId: token.id,
    sourceId: token.sourceId,
    sourceName: token.source.name,
  };
}

export function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}
