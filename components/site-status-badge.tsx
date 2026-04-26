import type { SiteStatus } from "@/app/generated/prisma";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  SiteStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  PENDING: "muted",
  SAFE: "success",
  SUSPICIOUS: "warning",
  DANGEROUS: "destructive",
  WHITELISTED: "secondary",
};

const STATUS_LABEL: Record<SiteStatus, string> = {
  PENDING: "En attente",
  SAFE: "Sûr",
  SUSPICIOUS: "Suspect",
  DANGEROUS: "Dangereux",
  WHITELISTED: "Liste blanche",
};

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
