import { Activity, AlertTriangle, Database, Shield } from "lucide-react";
import { StatusDistribution } from "@/components/dashboard/status-distribution";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrafficChart } from "@/components/dashboard/traffic-chart";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, formatNumber } from "@/lib/format";
import {
  getDashboardSummary,
  getTopDomains,
  getTrafficByDay,
} from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  const [summary, traffic, topDomains] = await Promise.all([
    getDashboardSummary(),
    getTrafficByDay(14),
    getTopDomains(10),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue synthétique de l&apos;activité de la plateforme sur les dernières 24 heures.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sites suivis"
          value={formatNumber(summary.totalSites)}
          icon={Database}
          hint={`${formatNumber(summary.sitesByStatus.PENDING)} en attente de classification`}
        />
        <StatCard
          label="Sites dangereux"
          value={formatNumber(summary.sitesByStatus.DANGEROUS)}
          icon={AlertTriangle}
          tone="danger"
          hint={`${formatNumber(summary.sitesByStatus.SUSPICIOUS)} suspects`}
        />
        <StatCard
          label="Règles de blocage actives"
          value={formatNumber(summary.activeBlockRules)}
          icon={Shield}
          tone="success"
        />
        <StatCard
          label="Scans (24 h)"
          value={formatNumber(summary.scansLast24h)}
          icon={Activity}
          hint={`${formatNumber(summary.ingestSources)} sources d'ingestion actives`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Trafic ingéré</CardTitle>
            <CardDescription>Volume agrégé sur les 14 derniers jours.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrafficChart data={traffic} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Répartition des sites</CardTitle>
            <CardDescription>Par statut de classification.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDistribution data={summary.sitesByStatus} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Domaines les plus consultés</CardTitle>
            <CardDescription>
              Top 10 par score de trafic agrégé. Volume cumulé 24 h :{" "}
              {formatBytes(summary.trafficLast24h)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {topDomains.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Aucune donnée de trafic disponible pour le moment.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domaine</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Score de trafic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDomains.map((d) => (
                    <TableRow key={d.domain}>
                      <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                      <TableCell>
                        <SiteStatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(Math.round(d.trafficScore))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
