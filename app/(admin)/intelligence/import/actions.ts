"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SiteStatus } from "@/app/generated/prisma";
import { isValidCountryCode } from "@/lib/countries";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireRole } from "@/lib/rbac";

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const MAX_LINES = 5000;

export type ImportState = {
  ok: boolean;
  error: string | null;
  imported?: number;
  alreadyExisting?: number;
  invalid?: number;
  invalidSamples?: string[];
  country?: string;
};

const schema = z.object({
  raw: z.string().min(1).max(500_000),
  country: z.string().optional(),
  attachTraffic: z.coerce.boolean().default(false),
});

export async function importDomains(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  try {
    await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = schema.safeParse({
    raw: formData.get("raw"),
    country: formData.get("country") || undefined,
    attachTraffic: formData.get("attachTraffic"),
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const country =
    parsed.data.country && isValidCountryCode(parsed.data.country.toUpperCase())
      ? parsed.data.country.toUpperCase()
      : null;

  const lines = parsed.data.raw
    .split(/[\s,;\n\r]+/)
    .map((s) => s.trim().toLowerCase())
    .map(stripScheme);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalidSamples: string[] = [];
  let invalid = 0;

  for (const raw of lines) {
    if (!raw) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (!DOMAIN_RE.test(raw)) {
      invalid++;
      if (invalidSamples.length < 5) invalidSamples.push(raw);
      continue;
    }
    valid.push(raw);
    if (valid.length >= MAX_LINES) break;
  }

  if (valid.length === 0) {
    return {
      ok: false,
      error: invalid > 0 ? `Aucun domaine valide (${invalid} rejeté(s))` : "Aucun domaine fourni",
      invalid,
      invalidSamples,
    };
  }

  const existing = await prisma.site.findMany({
    where: { domain: { in: valid } },
    select: { domain: true },
  });
  const existingSet = new Set(existing.map((s) => s.domain));
  const toCreate = valid.filter((d) => !existingSet.has(d));

  let imported = 0;
  if (toCreate.length > 0) {
    const result = await prisma.site.createMany({
      data: toCreate.map((domain) => ({
        domain,
        status: SiteStatus.PENDING,
      })),
      skipDuplicates: true,
    });
    imported = result.count;
  }

  if (parsed.data.attachTraffic && country) {
    await attachSyntheticTraffic(valid, country);
  }

  revalidatePath("/intelligence");
  revalidatePath("/sites");

  return {
    ok: true,
    error: null,
    imported,
    alreadyExisting: valid.length - toCreate.length,
    invalid,
    invalidSamples,
    country: country ?? undefined,
  };
}

function stripScheme(s: string): string {
  return s.replace(/^https?:\/\//, "").replace(/^\/\//, "").split("/")[0].split(":")[0];
}

async function attachSyntheticTraffic(domains: string[], country: string): Promise<void> {
  const PEPPER = env.IP_HASH_SALT ?? "ws-import-fallback";
  const ts = new Date();

  const samples: Array<{
    ts: Date;
    srcIpHash: string;
    dstDomain: string;
    bytes: bigint;
    countryIso: string;
  }> = [];

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    samples.push({
      ts: new Date(ts.getTime() - i * 1000),
      srcIpHash: createHmac("sha256", PEPPER).update(`import-${domain}`).digest("hex"),
      dstDomain: domain,
      bytes: BigInt(1),
      countryIso: country,
    });
  }

  await prisma.trafficSample.createMany({ data: samples, skipDuplicates: true });
}

export type FetchTrancoState = {
  ok: boolean;
  error: string | null;
  fetched?: number;
};

const trancoSchema = z.object({
  limit: z.coerce.number().int().min(10).max(5000).default(500),
  country: z.string().optional(),
  attachTraffic: z.coerce.boolean().default(false),
});

export async function importTrancoTopN(
  _prev: FetchTrancoState,
  formData: FormData,
): Promise<FetchTrancoState> {
  try {
    await requireRole("ANALYST");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = trancoSchema.safeParse({
    limit: formData.get("limit"),
    country: formData.get("country") || undefined,
    attachTraffic: formData.get("attachTraffic"),
  });
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const country =
    parsed.data.country && isValidCountryCode(parsed.data.country.toUpperCase())
      ? parsed.data.country.toUpperCase()
      : null;

  let body: string;
  try {
    const res = await fetch("https://tranco-list.eu/top-1m-id", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, error: `Tranco list-id introuvable (HTTP ${res.status})` };
    }
    const listId = (await res.text()).trim();

    const csvRes = await fetch(`https://tranco-list.eu/download/${listId}/${parsed.data.limit}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!csvRes.ok) {
      return { ok: false, error: `Tranco CSV introuvable (HTTP ${csvRes.status})` };
    }
    body = await csvRes.text();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `Tranco fetch: ${e.message}` : "Tranco fetch failed",
    };
  }

  const domains = body
    .split("\n")
    .map((l) => l.trim().split(",")[1])
    .filter((d): d is string => Boolean(d) && DOMAIN_RE.test(d.toLowerCase()))
    .map((d) => d.toLowerCase());

  if (domains.length === 0) return { ok: false, error: "Tranco a renvoyé une liste vide" };

  const fakeForm = new FormData();
  fakeForm.set("raw", domains.join("\n"));
  if (country) fakeForm.set("country", country);
  fakeForm.set("attachTraffic", String(parsed.data.attachTraffic));

  const result = await importDomains({ ok: false, error: null }, fakeForm);

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Import a échoué" };
  }
  return { ok: true, error: null, fetched: result.imported ?? 0 };
}
