import { ScanProvider, ScanVerdict } from "@/app/generated/prisma";
import { env } from "@/lib/env";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";

const ENDPOINT = "https://checkurl.phishtank.com/checkurl/";

export const phishtank: ProviderRunner = {
  name: ScanProvider.PHISHTANK,
  enabled: true,

  async run({ domain }): Promise<ProviderResult> {
    try {
      const params = new URLSearchParams({
        url: `https://${domain}/`,
        format: "json",
      });
      if (env.PHISHTANK_API_KEY) params.set("app_key", env.PHISHTANK_API_KEY);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "phishtank/web-safeguard",
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return {
          provider: ScanProvider.PHISHTANK,
          verdict: ScanVerdict.ERROR,
          score: null,
          raw: { status: res.status, statusText: res.statusText },
        };
      }

      const data = (await res.json()) as {
        results?: { in_database?: boolean; valid?: string; verified?: string };
      };
      const r = data.results ?? {};
      const isPhish = r.in_database === true && r.valid === "true" && r.verified === "true";

      return {
        provider: ScanProvider.PHISHTANK,
        verdict: isPhish ? ScanVerdict.MALICIOUS : ScanVerdict.SAFE,
        score: isPhish ? 1 : 0,
        raw: data as Record<string, unknown>,
      };
    } catch (error) {
      return {
        provider: ScanProvider.PHISHTANK,
        verdict: ScanVerdict.ERROR,
        score: null,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  },
};
