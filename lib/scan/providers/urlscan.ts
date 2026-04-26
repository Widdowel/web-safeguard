import { ScanProvider, ScanVerdict } from "@/app/generated/prisma";
import { env } from "@/lib/env";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";

const SEARCH_ENDPOINT = "https://urlscan.io/api/v1/search/";

export const urlscan: ProviderRunner = {
  name: ScanProvider.URLSCAN,
  enabled: Boolean(env.URLSCAN_API_KEY),

  async run({ domain }): Promise<ProviderResult> {
    if (!env.URLSCAN_API_KEY) {
      return {
        provider: ScanProvider.URLSCAN,
        verdict: ScanVerdict.NO_DATA,
        score: null,
        raw: { reason: "API key not configured", domain },
      };
    }

    try {
      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set("q", `domain:${domain}`);
      url.searchParams.set("size", "5");

      const res = await fetch(url, {
        headers: { "API-Key": env.URLSCAN_API_KEY },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return {
          provider: ScanProvider.URLSCAN,
          verdict: ScanVerdict.ERROR,
          score: null,
          raw: { status: res.status, statusText: res.statusText },
        };
      }

      const data = (await res.json()) as {
        results?: Array<{
          page?: { url?: string };
          verdicts?: { overall?: { malicious?: boolean; score?: number } };
        }>;
      };
      const results = data.results ?? [];
      const malicious = results.some((r) => r.verdicts?.overall?.malicious === true);
      const maxScore = results.reduce((acc, r) => {
        const s = r.verdicts?.overall?.score ?? 0;
        return s > acc ? s : acc;
      }, 0);

      const verdict: ScanVerdict =
        results.length === 0
          ? ScanVerdict.NO_DATA
          : malicious
          ? ScanVerdict.MALICIOUS
          : maxScore >= 50
          ? ScanVerdict.SUSPICIOUS
          : ScanVerdict.SAFE;

      return {
        provider: ScanProvider.URLSCAN,
        verdict,
        score: results.length === 0 ? null : maxScore / 100,
        raw: { count: results.length, malicious, maxScore },
      };
    } catch (error) {
      return {
        provider: ScanProvider.URLSCAN,
        verdict: ScanVerdict.ERROR,
        score: null,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  },
};
