import { ScanVerdict } from "@/app/generated/prisma";

export type TrustLevel = "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "VERY_LOW" | "UNKNOWN";

export type TrustInfo = {
  score: number | null;
  level: TrustLevel;
  label: string;
  badge: "success" | "secondary" | "muted" | "warning" | "destructive";
  description: string;
};

export function trustScoreFromAggregate(
  aggregateScore: number | null | undefined,
  aggregateVerdict: ScanVerdict | null | undefined,
): number | null {
  if (aggregateVerdict == null) return null;
  if (aggregateVerdict === ScanVerdict.NO_DATA || aggregateVerdict === ScanVerdict.ERROR) {
    return null;
  }
  const score = typeof aggregateScore === "number" ? aggregateScore : 0;
  const clamped = Math.max(0, Math.min(1, score));
  return Math.round((1 - clamped) * 100);
}

export function trustInfoFor(score: number | null | undefined): TrustInfo {
  if (score == null) {
    return {
      score: null,
      level: "UNKNOWN",
      label: "Non évalué",
      badge: "muted",
      description: "Aucun scan exploitable n'a encore été effectué.",
    };
  }
  if (score >= 80) {
    return {
      score,
      level: "VERY_HIGH",
      label: "Confiance très élevée",
      badge: "success",
      description: "Tous les indicateurs convergent vers un site légitime.",
    };
  }
  if (score >= 60) {
    return {
      score,
      level: "HIGH",
      label: "Confiance élevée",
      badge: "secondary",
      description: "Globalement sûr ; aucun signal fort de fraude.",
    };
  }
  if (score >= 40) {
    return {
      score,
      level: "MODERATE",
      label: "Confiance modérée",
      badge: "warning",
      description: "Indicateurs mitigés — surveillance recommandée.",
    };
  }
  if (score >= 20) {
    return {
      score,
      level: "LOW",
      label: "Confiance faible",
      badge: "warning",
      description: "Plusieurs signaux suspects — vérification analyste requise.",
    };
  }
  return {
    score,
    level: "VERY_LOW",
    label: "Confiance très faible",
    badge: "destructive",
    description: "Indicateurs convergents de fraude — blocage recommandé.",
  };
}
