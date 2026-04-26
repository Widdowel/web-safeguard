import { describe, expect, test, vi } from "vitest";

vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("AUTH_SECRET", "x".repeat(32));

import { ScanProvider, ScanVerdict } from "@/app/generated/prisma";
import { aggregateResults } from "@/lib/scan/aggregate";

const make = (
  verdict: ScanVerdict,
  provider: ScanProvider = ScanProvider.GOOGLE_SAFE_BROWSING,
) => ({
  provider,
  verdict,
  score: null,
  raw: {},
});

describe("aggregateResults", () => {
  test("ignores NO_DATA and ERROR results", () => {
    const r = aggregateResults([
      make(ScanVerdict.NO_DATA),
      make(ScanVerdict.ERROR),
    ]);
    expect(r.verdict).toBe(ScanVerdict.NO_DATA);
    expect(r.score).toBe(0);
  });

  test("all SAFE → SAFE", () => {
    const r = aggregateResults([
      make(ScanVerdict.SAFE, ScanProvider.GOOGLE_SAFE_BROWSING),
      make(ScanVerdict.SAFE, ScanProvider.PHISHTANK),
      make(ScanVerdict.SAFE, ScanProvider.URLSCAN),
    ]);
    expect(r.verdict).toBe(ScanVerdict.SAFE);
    expect(r.score).toBe(0);
  });

  test("majority MALICIOUS → MALICIOUS", () => {
    const r = aggregateResults([
      make(ScanVerdict.MALICIOUS, ScanProvider.GOOGLE_SAFE_BROWSING),
      make(ScanVerdict.MALICIOUS, ScanProvider.VIRUSTOTAL),
      make(ScanVerdict.SAFE, ScanProvider.PHISHTANK),
    ]);
    expect(r.verdict).toBe(ScanVerdict.MALICIOUS);
    expect(r.score).toBeGreaterThanOrEqual(0.5);
  });

  test("mixed SUSPICIOUS + SAFE → SUSPICIOUS", () => {
    const r = aggregateResults([
      make(ScanVerdict.SUSPICIOUS, ScanProvider.GOOGLE_SAFE_BROWSING),
      make(ScanVerdict.SAFE, ScanProvider.PHISHTANK),
    ]);
    expect(r.verdict).toBe(ScanVerdict.SUSPICIOUS);
  });

  test("ignores ERROR but counts MALICIOUS", () => {
    const r = aggregateResults([
      make(ScanVerdict.ERROR),
      make(ScanVerdict.MALICIOUS),
    ]);
    expect(r.verdict).toBe(ScanVerdict.MALICIOUS);
    expect(r.score).toBe(1);
  });
});
