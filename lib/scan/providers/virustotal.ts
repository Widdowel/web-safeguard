import { ScanProvider, ScanVerdict } from "@/app/generated/prisma";
import { env } from "@/lib/env";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";

const ENDPOINT = "https://www.virustotal.com/api/v3/domains/";

export const virustotal: ProviderRunner = {
  name: ScanProvider.VIRUSTOTAL,
  enabled: Boolean(env.VIRUSTOTAL_API_KEY),

  async run({ domain }): Promise<ProviderResult> {
    if (!env.VIRUSTOTAL_API_KEY) {
      return {
        provider: ScanProvider.VIRUSTOTAL,
        verdict: ScanVerdict.NO_DATA,
        score: null,
        raw: { reason: "API key not configured", domain },
      };
    }

    try {
      const res = await fetch(`${ENDPOINT}${encodeURIComponent(domain)}`, {
        headers: { "x-apikey": env.VIRUSTOTAL_API_KEY },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 404) {
        return {
          provider: ScanProvider.VIRUSTOTAL,
          verdict: ScanVerdict.NO_DATA,
          score: null,
          raw: { reason: "domain unknown to VT" },
        };
      }
      if (!res.ok) {
        return {
          provider: ScanProvider.VIRUSTOTAL,
          verdict: ScanVerdict.ERROR,
          score: null,
          raw: { status: res.status, statusText: res.statusText },
        };
      }

      const data = (await res.json()) as {
        data?: {
          attributes?: {
            last_analysis_stats?: {
              harmless?: number;
              malicious?: number;
              suspicious?: number;
              undetected?: number;
              timeout?: number;
            };
            reputation?: number;
          };
        };
      };

      const stats = data.data?.attributes?.last_analysis_stats ?? {};
      const malicious = stats.malicious ?? 0;
      const suspicious = stats.suspicious ?? 0;
      const total = Object.values(stats).reduce<number>((sum, n) => sum + (n ?? 0), 0);

      let verdict: ScanVerdict = ScanVerdict.SAFE;
      if (malicious >= 3) verdict = ScanVerdict.MALICIOUS;
      else if (malicious >= 1 || suspicious >= 2) verdict = ScanVerdict.SUSPICIOUS;
      else if (total === 0) verdict = ScanVerdict.NO_DATA;

      const score = total > 0 ? (malicious + suspicious * 0.5) / total : null;

      return {
        provider: ScanProvider.VIRUSTOTAL,
        verdict,
        score,
        raw: { stats, reputation: data.data?.attributes?.reputation ?? null },
      };
    } catch (error) {
      return {
        provider: ScanProvider.VIRUSTOTAL,
        verdict: ScanVerdict.ERROR,
        score: null,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  },
};
