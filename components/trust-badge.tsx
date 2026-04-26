import { Badge } from "@/components/ui/badge";
import { trustInfoFor } from "@/lib/trust-score";

export function TrustBadge({
  score,
  showScore = true,
}: {
  score: number | null | undefined;
  showScore?: boolean;
}) {
  const info = trustInfoFor(score ?? null);
  return (
    <Badge variant={info.badge} title={info.description}>
      {info.label}
      {showScore && info.score !== null && (
        <span className="ml-1 font-mono opacity-80">{info.score}/100</span>
      )}
    </Badge>
  );
}
