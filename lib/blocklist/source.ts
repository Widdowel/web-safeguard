import { createHash } from "node:crypto";
import { BlockRuleType } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

export type BlockEntry = {
  type: BlockRuleType;
  value: string;
  updatedAt: Date;
};

export type Snapshot = {
  entries: BlockEntry[];
  etag: string;
  lastModified: Date;
};

export async function getActiveBlocklist(): Promise<Snapshot> {
  const rules = await prisma.blockRule.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { value: "asc" }],
    select: { type: true, value: true, updatedAt: true },
  });

  const lastModified =
    rules.reduce<Date>((acc, r) => (r.updatedAt > acc ? r.updatedAt : acc), new Date(0)) ??
    new Date(0);

  const hash = createHash("sha256");
  hash.update(String(rules.length));
  for (const r of rules) {
    hash.update("\n");
    hash.update(r.type);
    hash.update("\t");
    hash.update(r.value);
    hash.update("\t");
    hash.update(r.updatedAt.toISOString());
  }
  const etag = `"${hash.digest("hex").slice(0, 16)}"`;

  return { entries: rules, etag, lastModified };
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
