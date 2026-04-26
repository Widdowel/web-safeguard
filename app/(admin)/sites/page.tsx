import Link from "next/link";
import { BlockRuleType, SiteStatus } from "@/app/generated/prisma";
import { BulkBlockForm } from "@/components/sites/bulk-block-form";
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
import { formatCountries } from "@/lib/countries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{ status?: string; q?: string }>;

const STATUS_OPTIONS: Array<{ value: SiteStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "SUSPICIOUS", label: "Suspects" },
  { value: "DANGEROUS", label: "Dangereux" },
  { value: "SAFE", label: "Sûrs" },
  { value: "WHITELISTED", label: "Liste blanche" },
];

export default async function SitesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusFilter = (params.status as SiteStatus) || undefined;
  const query = params.q?.trim() || undefined;
  const isValidStatus =
    statusFilter && (Object.values(SiteStatus) as string[]).includes(statusFilter);

  const sites = await prisma.site.findMany({
    where: {
      ...(isValidStatus && statusFilter ? { status: statusFilter } : {}),
      ...(query ? { domain: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ trafficScore: "desc" }, { lastSeenAt: "desc" }],
    take: 100,
    select: {
      id: true,
      domain: true,
      status: true,
      trafficScore: true,
      lastSeenAt: true,
      blockRules: {
        where: { isActive: true, type: BlockRuleType.DOMAIN },
        select: { countries: true },
      },
    },
  });

  const totalMatching = await prisma.site.count({
    where: {
      ...(isValidStatus && statusFilter ? { status: statusFilter } : {}),
      ...(query ? { domain: { contains: query, mode: "insensitive" } } : {}),
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sites surveillés</h1>
        <p className="text-sm text-muted-foreground">
          Domaines collectés via l&apos;ingestion. Cliquez sur un site pour examiner les scans et
          modifier sa classification ou son blocage.
        </p>
      </header>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Filtres</CardTitle>
            <CardDescription>
              Affichage limité à 100 sites par défaut. {totalMatching} site(s) correspondent aux
              filtres.
            </CardDescription>
          </div>
          <form className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const href =
                  opt.value === "ALL"
                    ? `/sites${query ? `?q=${encodeURIComponent(query)}` : ""}`
                    : `/sites?status=${opt.value}${
                        query ? `&q=${encodeURIComponent(query)}` : ""
                      }`;
                const active =
                  opt.value === "ALL" ? !isValidStatus : statusFilter === opt.value;
                return (
                  <Link
                    key={opt.value}
                    href={href}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
            <input
              type="search"
              name="q"
              defaultValue={query ?? ""}
              placeholder="Rechercher un domaine"
              className="ml-auto h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
            />
          </form>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 pt-0">
          <BulkBlockForm
            defaultStatus={isValidStatus ? statusFilter : undefined}
            defaultQuery={query}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Résultats</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {sites.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Aucun site ne correspond aux filtres.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domaine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Blocage</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Vu pour la dernière fois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => {
                  const rule = site.blockRules[0];
                  return (
                    <TableRow key={site.id}>
                      <TableCell>
                        <Link
                          href={`/sites/${site.id}`}
                          className="font-mono text-xs underline-offset-2 hover:underline"
                        >
                          {site.domain}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SiteStatusBadge status={site.status} />
                      </TableCell>
                      <TableCell>
                        {rule ? (
                          <Badge variant="destructive">
                            {formatCountries(rule.countries)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(Math.round(site.trafficScore))}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(site.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
