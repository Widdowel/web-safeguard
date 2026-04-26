import Link from "next/link";
import { DrainButton } from "@/components/intelligence/drain-button";
import { EnqueueForm } from "@/components/intelligence/enqueue-form";
import { QueueStatus } from "@/components/intelligence/queue-status";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { TrustBadge } from "@/components/trust-badge";
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
import { AcceptSuggestionButton } from "@/components/intelligence/accept-suggestion-button";
import { COUNTRIES, countryName } from "@/lib/countries";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import {
  getBlockSuggestions,
  getCountryTrustDistribution,
  getTopSitesForCountry,
  getTrafficByCountry,
} from "@/lib/queries/intelligence";
import { requireRole } from "@/lib/rbac";

type SearchParams = Promise<{ country?: string; limit?: string }>;

const VALID_CODES = new Set(COUNTRIES.map((c) => c.code));

export default async function IntelligencePage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("ANALYST");

  const params = await searchParams;
  const country =
    params.country && VALID_CODES.has(params.country.toUpperCase())
      ? params.country.toUpperCase()
      : "BJ";
  const limit = Math.min(Math.max(Number.parseInt(params.limit ?? "100", 10) || 100, 10), 500);

  const [trafficByCountry, topSites, distribution, suggestions] = await Promise.all([
    getTrafficByCountry(),
    getTopSitesForCountry(country, { limit }),
    getCountryTrustDistribution(country),
    getBlockSuggestions(country, { trustMax: 30, limit: 30 }),
  ]);

  const totalSites = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Intelligence par pays</h1>
        <p className="text-sm text-muted-foreground">
          Identifie les plateformes à fort trafic depuis un pays donné, lance des scans en masse
          et mesure le niveau de confiance global.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pays observés (14 derniers jours)</CardTitle>
          <CardDescription>
            Volume de trafic ingéré agrégé par pays. Clique pour analyser.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {trafficByCountry.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Aucun trafic ingéré. Configure une source d&apos;ingestion (/sources) et envoie du
              trafic.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pays</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Échantillons</TableHead>
                  <TableHead className="text-right">Domaines uniques</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trafficByCountry.map((c) => (
                  <TableRow key={c.country}>
                    <TableCell className="font-medium">
                      <span className="font-mono text-xs">{c.country}</span> —{" "}
                      {countryName(c.country)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(c.totalBytes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.totalSamples)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.uniqueDomains)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/intelligence?country=${c.country}`}
                        className="text-xs underline-offset-2 hover:underline"
                      >
                        Analyser →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                Scan en masse — <span className="font-mono">{country}</span>{" "}
                <span className="font-normal text-muted-foreground">({countryName(country)})</span>
              </CardTitle>
              <CardDescription>
                Enfile les scans des sites les plus consultés depuis ce pays. Le moteur les
                exécute en parallèle (jusqu&apos;à 5 providers par site).
              </CardDescription>
            </div>
            <DrainButton />
          </div>
          <QueueStatus />
        </CardHeader>
        <CardContent>
          <EnqueueForm defaultCountry={country} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Niveau de confiance — distribution sur {countryName(country)}
          </CardTitle>
          <CardDescription>
            {formatNumber(totalSites)} site(s) consulté(s) depuis ce pays sur 14 jours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Très élevée" value={distribution.veryHigh} tone="success" />
            <Stat label="Élevée" value={distribution.high} tone="success-soft" />
            <Stat label="Modérée" value={distribution.moderate} tone="warning" />
            <Stat label="Faible" value={distribution.low} tone="warning-strong" />
            <Stat label="Très faible" value={distribution.veryLow} tone="destructive" />
            <Stat label="Non évalués" value={distribution.unscanned} tone="muted" />
          </div>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>
              ⚠️ Suggestions de blocage — {countryName(country)} ({suggestions.length})
            </CardTitle>
            <CardDescription>
              Sites consultés depuis {countryName(country)} avec un score de confiance ≤ 30,
              non encore bloqués. Un clic = classification DANGEROUS + règle de blocage pour ce
              pays.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domaine</TableHead>
                  <TableHead>Confiance</TableHead>
                  <TableHead>Statut actuel</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s) => (
                  <TableRow key={s.siteId}>
                    <TableCell>
                      <Link
                        href={`/sites/${s.siteId}`}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {s.domain}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <TrustBadge score={s.trustScore} />
                    </TableCell>
                    <TableCell>
                      <SiteStatusBadge
                        status={
                          s.status as React.ComponentProps<typeof SiteStatusBadge>["status"]
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(s.totalBytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <AcceptSuggestionButton siteId={s.siteId} country={country} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top {topSites.length} sites — {countryName(country)}</CardTitle>
          <CardDescription>
            Triés par volume de trafic depuis ce pays sur 14 jours.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {topSites.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Aucun trafic récent depuis ce pays.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Domaine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Niveau de confiance</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Dernier scan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSites.map((s, i) => (
                  <TableRow key={s.siteId}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sites/${s.siteId}`}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {s.domain}
                      </Link>
                      {s.pendingScan && (
                        <Badge variant="secondary" className="ml-2 animate-pulse">
                          scan en cours
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <SiteStatusBadge
                        status={
                          s.status as React.ComponentProps<typeof SiteStatusBadge>["status"]
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <TrustBadge score={s.trustScore} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(s.totalBytes)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.lastScanAt ? formatDateTime(s.lastScanAt) : "jamais"}
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

const TONE_CLASS: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  "success-soft": "border-success/20 bg-success/5",
  warning: "border-warning/40 bg-warning/10 text-warning",
  "warning-strong": "border-warning/60 bg-warning/20 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-muted bg-muted/30 text-muted-foreground",
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-md border p-3 ${TONE_CLASS[tone] ?? ""}`}>
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString("fr-FR")}</div>
      <div className="mt-1 text-xs uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}
