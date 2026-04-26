import { ScanProvider, ScanVerdict } from "@/app/generated/prisma";
import { env } from "@/lib/env";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";

const ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

export const googleSafeBrowsing: ProviderRunner = {
  name: ScanProvider.GOOGLE_SAFE_BROWSING,
  enabled: Boolean(env.GOOGLE_SAFE_BROWSING_API_KEY),

  async run({ domain }): Promise<ProviderResult> {
    if (!env.GOOGLE_SAFE_BROWSING_API_KEY) {
      return noData(domain);
    }

    const body = {
      client: { clientId: "web-safeguard", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: `https://${domain}/` }, { url: `http://${domain}/` }],
      },
    };

    try {
      const res = await fetch(`${ENDPOINT}?key=${env.GOOGLE_SAFE_BROWSING_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return {
          provider: ScanProvider.GOOGLE_SAFE_BROWSING,
          verdict: ScanVerdict.ERROR,
          score: null,
          raw: { status: res.status, statusText: res.statusText },
        };
      }

      const data = (await res.json()) as { matches?: Array<{ threatType: string }> };
      const matches = data.matches ?? [];

      return {
        provider: ScanProvider.GOOGLE_SAFE_BROWSING,
        verdict: matches.length === 0 ? ScanVerdict.SAFE : ScanVerdict.MALICIOUS,
        score: matches.length === 0 ? 0 : 1,
        raw: { matches },
      };
    } catch (error) {
      return {
        provider: ScanProvider.GOOGLE_SAFE_BROWSING,
        verdict: ScanVerdict.ERROR,
        score: null,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  },
};

function noData(domain: string): ProviderResult {
  return {
    provider: ScanProvider.GOOGLE_SAFE_BROWSING,
    verdict: ScanVerdict.NO_DATA,
    score: null,
    raw: { reason: "API key not configured", domain },
  };
}
