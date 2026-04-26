import { prisma } from "@/lib/prisma";
import type { TrafficEvent } from "@/lib/ingest/schema";

export type PersistResult = {
  inserted: number;
  duplicates: number;
};

export async function persistTrafficBatch(
  events: TrafficEvent[],
  sourceId: string,
): Promise<PersistResult> {
  if (events.length === 0) return { inserted: 0, duplicates: 0 };

  const result = await prisma.trafficSample.createMany({
    data: events.map((e) => ({
      ts: e.ts,
      srcIpHash: e.src_ip_hash,
      dstDomain: e.dst_domain,
      dstIp: e.dst_ip ?? null,
      bytes: BigInt(e.bytes),
      countryIso: e.country_iso,
      sourceId,
    })),
    skipDuplicates: true,
  });

  await touchSites(events);

  return {
    inserted: result.count,
    duplicates: events.length - result.count,
  };
}

async function touchSites(events: TrafficEvent[]): Promise<void> {
  const seenAt = new Date();
  const byDomain = new Map<string, { bytes: bigint; samples: number }>();
  for (const e of events) {
    const acc = byDomain.get(e.dst_domain) ?? { bytes: BigInt(0), samples: 0 };
    acc.bytes += BigInt(e.bytes);
    acc.samples += 1;
    byDomain.set(e.dst_domain, acc);
  }

  await prisma.$transaction(
    [...byDomain.entries()].map(([domain, agg]) =>
      prisma.site.upsert({
        where: { domain },
        create: {
          domain,
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
          trafficScore: agg.samples + Number(agg.bytes) / 1024,
        },
        update: {
          lastSeenAt: seenAt,
          trafficScore: { increment: agg.samples + Number(agg.bytes) / 1024 },
        },
      }),
    ),
  );
}
