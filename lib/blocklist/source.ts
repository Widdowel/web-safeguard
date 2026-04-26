import { createHash } from "node:crypto";
import { BlockRuleType } from "@/app/generated/prisma";
import { isValidCountryCode } from "@/lib/countries";
import { prisma } from "@/lib/prisma";

export type BlockEntry = {
  type: BlockRuleType;
  value: string;
  countries: string[];
  updatedAt: Date;
};

export type Snapshot = {
  entries: BlockEntry[];
  etag: string;
  lastModified: Date;
  country: string | null;
};

export async function getActiveBlocklist(country?: string | null): Promise<Snapshot> {
  const normalized = country && isValidCountryCode(country.toUpperCase()) ? country.toUpperCase() : null;

  const rules = await prisma.blockRule.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { value: "asc" }],
    select: { type: true, value: true, countries: true, updatedAt: true },
  });

  const filtered = normalized
    ? rules.filter((r) => r.countries.length === 0 || r.countries.includes(normalized))
    : rules;

  const lastModified = filtered.reduce<Date>(
    (acc, r) => (r.updatedAt > acc ? r.updatedAt : acc),
    new Date(0),
  );

  const hash = createHash("sha256");
  hash.update(String(filtered.length));
  if (normalized) hash.update(`@${normalized}`);
  for (const r of filtered) {
    hash.update("\n");
    hash.update(r.type);
    hash.update("\t");
    hash.update(r.value);
    hash.update("\t");
    hash.update(r.countries.slice().sort().join(","));
    hash.update("\t");
    hash.update(r.updatedAt.toISOString());
  }
  const etag = `"${hash.digest("hex").slice(0, 16)}"`;

  return { entries: filtered, etag, lastModified, country: normalized };
}

export function partition(snapshot: Snapshot) {
  const domains: BlockEntry[] = [];
  const ips: BlockEntry[] = [];
  const prefixes: BlockEntry[] = [];
  for (const e of snapshot.entries) {
    if (e.type === BlockRuleType.DOMAIN) domains.push(e);
    else if (e.type === BlockRuleType.IP) ips.push(e);
    else if (e.type === BlockRuleType.IP_PREFIX) prefixes.push(e);
  }
  return { domains, ips, prefixes };
}
