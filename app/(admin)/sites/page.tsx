import { BlockRuleType, SiteStatus } from "@/app/generated/prisma";
import { BulkBlockForm } from "@/components/sites/bulk-block-form";
import { QuickBlockForm } from "@/components/sites/quick-block-form";
import { QuickScanForm } from "@/components/sites/quick-scan-form";
import {
  SitesActionTable,
  type SiteRow,
} from "@/components/sites/sites-action-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function SitesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("VIEWER");

  const params = await searchParams;
  const statusFilter = (params.status as SiteStatus) || undefined;
  const query = params.q?.trim() || undefined;
  const isValidStatus =
    statusFilter && (Object.values(SiteStatus) as string[]).includes(statusFilter);

  const where = {
    ...(isValidStatus && statusFilter ? { status: statusFilter } : {}),
    ...(query ? { domain: { contains: query, mode: "insensitive" as const } } : {}),
  };

  const [sites, totalMatching] = await Promise.all([
    prisma.site.findMany({
      where,
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
          take: 1,
        },
      },
    }),
    prisma.site.count({ where }),
  ]);

  const rows: SiteRow[] = sites.map((s) => ({
    id: s.id,
    domain: s.domain,
    status: s.status,
    trafficScore: s.trafficScore,
    lastSeenAt: s.lastSeenAt,
    blockedCountries: s.blockRules[0]?.countries ?? null,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sites surveillés</h1>
        <p className="text-sm text-muted-foreground">
          Workflow opérateur : sélectionne un périmètre géographique en haut, puis bloque /
          débloque / scanne chaque domaine en un clic. Audit log automatique.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>
            Ajoute un nouveau domaine à la base sans attendre qu&apos;il soit vu dans le trafic
            ingéré.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <QuickScanForm />
          <QuickBlockForm />
          <BulkBlockForm
            defaultStatus={isValidStatus ? statusFilter : undefined}
            defaultQuery={query}
          />
        </CardContent>
      </Card>

      <SitesActionTable
        sites={rows}
        totalMatching={totalMatching}
        initialStatus={isValidStatus ? statusFilter : undefined}
        initialQuery={query}
      />
    </div>
  );
}
