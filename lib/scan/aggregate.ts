import { ScanVerdict } from "@/app/generated/prisma";
import type { ProviderResult } from "@/lib/scan/types";

const VERDICT_WEIGHT: Record<ScanVerdict, number> = {
  SAFE: 0,
  NO_DATA: 0,
  ERROR: 0,
  SUSPICIOUS: 0.5,
  MALICIOUS: 1,
};

export type Aggregate = {
  verdict: ScanVerdict;
  score: number;
};

export function aggregateResults(results: ProviderResult[]): Aggregate {
  const usable = results.filter(
    (r) => r.verdict !== ScanVerdict.NO_DATA && r.verdict !== ScanVerdict.ERROR,
  );

  if (usable.length === 0) {
    return { verdict: ScanVerdict.NO_DATA, score: 0 };
  }

  const weighted = usable.reduce<number>((acc, r) => acc + VERDICT_WEIGHT[r.verdict], 0);
  const score = weighted / usable.length;

  let verdict: ScanVerdict;
  if (score >= 0.5) verdict = ScanVerdict.MALICIOUS;
  else if (score >= 0.2) verdict = ScanVerdict.SUSPICIOUS;
  else verdict = ScanVerdict.SAFE;

  return { verdict, score };
}
