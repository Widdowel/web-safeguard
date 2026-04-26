import { notFound } from "next/navigation";
import { ClassifyForm } from "@/components/sites/classify-form";
import { RescanButton } from "@/components/sites/rescan-button";
import { SiteStatusBadge } from "@/components/site-status-badge";
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
    },
  });

  if (!site) notFound();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{site.domain}</h1>
            <SiteStatusBadge status={site.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vu pour la première fois le {formatDateTime(site.firstSeenAt)} · score{" "}
            {formatNumber(Math.round(site.trafficScore))}
          </p>
        </div>
        <RescanButton siteId={site.id} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Classification</CardTitle>
            <CardDescription>
              Le passage en « Dangereux » ajoute automatiquement une règle de blocage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClassifyForm siteId={site.id} currentStatus={site.status} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
      </div>

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
