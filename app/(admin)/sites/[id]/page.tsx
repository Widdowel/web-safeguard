import { notFound } from "next/navigation";
import { BlockRuleType } from "@/app/generated/prisma";
import { BlockForm } from "@/components/sites/block-form";
import { ClassifyForm } from "@/components/sites/classify-form";
import { RescanButton } from "@/components/sites/rescan-button";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { UnblockButton } from "@/components/sites/unblock-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCountries } from "@/lib/countries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export default async function SiteDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      classifications: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { email: true, name: true } } },
      },
      scans: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { results: true },
      },
      blockRules: true,
    },
  });

  if (!site) notFound();

  const domainRule = site.blockRules.find(
    (r) => r.type === BlockRuleType.DOMAIN && r.isActive,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{site.domain}</h1>
            <SiteStatusBadge status={site.status} />
            {domainRule && (
              <Badge variant="destructive">
                Bloqué — {formatCountries(domainRule.countries)}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vu pour la première fois le {formatDateTime(site.firstSeenAt)} · score{" "}
            {formatNumber(Math.round(site.trafficScore))}
          </p>
        </div>
        <RescanButton siteId={site.id} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classification</CardTitle>
            <CardDescription>
              Le passage en « Dangereux » crée automatiquement une règle de blocage mondial.
              Pour un blocage géo-ciblé, utilise le bloc à droite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClassifyForm siteId={site.id} currentStatus={site.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blocage géo-ciblé</CardTitle>
            <CardDescription>
              Bloque le domaine pour les IP des pays sélectionnés. Les pays s&apos;ajoutent à la
              règle existante (cumul). Aucun pays = blocage mondial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {domainRule && (
              <div className="rounded-md border bg-card/50 p-3 text-sm">
                <div className="font-medium text-destructive">Règle active</div>
                <div className="mt-1 text-muted-foreground">
                  Périmètre : {formatCountries(domainRule.countries)}
                </div>
                {domainRule.reason && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Motif : {domainRule.reason}
                  </div>
                )}
                <div className="mt-2">
                  <UnblockButton siteId={site.id} />
                </div>
              </div>
            )}
            <BlockForm siteId={site.id} defaultCountries={domainRule?.countries ?? []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des scans</CardTitle>
          <CardDescription>10 derniers scans, du plus récent au plus ancien.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {site.scans.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Aucun scan effectué.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Démarré</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Pays demandés</TableHead>
                  <TableHead>Verdict agrégé</TableHead>
                  <TableHead>Sources</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {site.scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(scan.startedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {scan.finishedAt
                        ? `${Math.round(
                            (scan.finishedAt.getTime() - scan.startedAt.getTime()) / 1000,
                          )} s`
                        : "en cours"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatCountries(scan.countries)}
                    </TableCell>
                    <TableCell>
                      {scan.aggregateVerdict ? (
                        <Badge variant={verdictVariant(scan.aggregateVerdict)}>
                          {scan.aggregateVerdict}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {scan.results.length} résultat(s)
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des classifications</CardTitle>
          <CardDescription>10 dernières mutations.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {site.classifications.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Aucune classification.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Avant</TableHead>
                  <TableHead>Après</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {site.classifications.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.actor.name ?? c.actor.email}
                    </TableCell>
                    <TableCell>
                      <SiteStatusBadge status={c.fromState} />
                    </TableCell>
                    <TableCell>
                      <SiteStatusBadge status={c.toState} />
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {c.reason ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function verdictVariant(
  verdict: string,
): React.ComponentProps<typeof Badge>["variant"] {
  switch (verdict) {
    case "MALICIOUS":
      return "destructive";
    case "SUSPICIOUS":
      return "warning";
    case "SAFE":
      return "success";
    default:
      return "muted";
  }
}
