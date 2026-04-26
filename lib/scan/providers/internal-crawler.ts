import { ScanProvider, ScanVerdict } from "@/app/generated/prisma";
import { runHeuristics, detectTyposquat } from "@/lib/scan/crawler/heuristics";
import { inspectTls } from "@/lib/scan/crawler/tls";
import { inspectWhois } from "@/lib/scan/crawler/whois";
import type { ProviderResult, ProviderRunner } from "@/lib/scan/types";

export const internalCrawler: ProviderRunner = {
  name: ScanProvider.INTERNAL_CRAWLER,
  enabled: true,

  async run({ domain }): Promise<ProviderResult> {
    const [tls, whois, heuristics] = await Promise.all([
      inspectTls(domain),
      inspectWhois(domain),
      runHeuristics(domain),
    ]);
    const typosquat = detectTyposquat(domain);

    let suspicionScore = 0;
    const reasons: string[] = [];

    if (tls.ok) {
      if (tls.selfSigned) {
        suspicionScore += 0.3;
        reasons.push("self_signed_certificate");
      }
      if (typeof tls.ageDays === "number" && tls.ageDays < 7) {
        suspicionScore += 0.2;
        reasons.push("brand_new_certificate");
      }
      if (typeof tls.daysUntilExpiry === "number" && tls.daysUntilExpiry < 0) {
        suspicionScore += 0.3;
        reasons.push("expired_certificate");
      }
    } else {
      suspicionScore += 0.15;
      reasons.push("tls_unreachable");
    }

    if (whois.ok && typeof whois.ageDays === "number") {
      if (whois.ageDays < 30) {
        suspicionScore += 0.25;
        reasons.push("very_young_domain");
      } else if (whois.ageDays < 90) {
        suspicionScore += 0.1;
        reasons.push("young_domain");
      }
    }

    if (heuristics.ok && heuristics.fetched) {
      if (heuristics.hasInsecureForm) {
        suspicionScore += 0.4;
        reasons.push("insecure_form_action");
      }
      if (heuristics.hasPasswordField && heuristics.hasInsecureForm) {
        suspicionScore += 0.2;
        reasons.push("password_over_http");
      }
      if (heuristics.suspiciousKeywords && heuristics.suspiciousKeywords.length >= 3) {
        suspicionScore += 0.25;
        reasons.push("multiple_suspicious_keywords");
      } else if (heuristics.suspiciousKeywords && heuristics.suspiciousKeywords.length > 0) {
        suspicionScore += 0.1;
        reasons.push("suspicious_keywords");
      }
    }

    if (typosquat.isLikelyTyposquat) {
      suspicionScore += 0.4;
      reasons.push(`typosquat_of_${typosquat.closestBrand}`);
    }

    const score = Math.min(1, suspicionScore);
    let verdict: ScanVerdict;
    if (score >= 0.6) verdict = ScanVerdict.MALICIOUS;
    else if (score >= 0.3) verdict = ScanVerdict.SUSPICIOUS;
    else if (heuristics.ok && heuristics.fetched) verdict = ScanVerdict.SAFE;
    else verdict = ScanVerdict.NO_DATA;

    return {
      provider: ScanProvider.INTERNAL_CRAWLER,
      verdict,
      score,
      raw: {
        tls,
        whois,
        heuristics,
        typosquat,
        reasons,
      },
    };
  },
};
