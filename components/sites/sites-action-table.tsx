"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Search, Shield, ShieldOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SiteStatus } from "@/app/generated/prisma";
import {
  blockSite,
  requestRescan,
  unblockSite,
  type BlockState,
  type RescanState,
  type UnblockState,
} from "@/app/(admin)/sites/actions";
import { CountrySelector } from "@/components/country-selector";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export type SiteRow = {
  id: string;
  domain: string;
  status: SiteStatus;
  trafficScore: number;
  lastSeenAt: Date;
  blockedCountries: string[] | null;
};

const STATUS_OPTIONS: Array<{ value: SiteStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "SUSPICIOUS", label: "Suspects" },
  { value: "DANGEROUS", label: "Dangereux" },
  { value: "SAFE", label: "Sûrs" },
  { value: "WHITELISTED", label: "Liste blanche" },
];

export function SitesActionTable({
  sites,
  totalMatching,
  initialStatus,
  initialQuery,
}: {
  sites: SiteRow[];
  totalMatching: number;
  initialStatus?: SiteStatus;
  initialQuery?: string;
}) {
  const [countries, setCountries] = useState<string[]>(["BJ"]);
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Périmètre géographique des actions</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Toutes les actions de blocage et de scan sur les lignes ci-dessous utiliseront ce
                périmètre. Modifie-le ici en un endroit, applique sur toutes les lignes.
              </p>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Badge variant={countries.length === 0 ? "warning" : "default"}>
                {formatCountries(countries)}
              </Badge>
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setShowSelector((v) => !v)}
              >
                {showSelector ? "Masquer" : "Modifier"}
              </button>
            </div>
          </div>
          {showSelector && (
            <CountrySelector
              value={countries}
              onChange={setCountries}
              worldwideHint="Aucun pays sélectionné = action mondiale (toutes IP)"
            />
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const params = new URLSearchParams();
              if (opt.value !== "ALL") params.set("status", opt.value);
              if (initialQuery) params.set("q", initialQuery);
              const href = params.toString() ? `/sites?${params}` : "/sites";
              const active =
                opt.value === "ALL" ? !initialStatus : initialStatus === opt.value;
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
          <form className="flex items-center gap-2" action="/sites">
            {initialStatus && <input type="hidden" name="status" value={initialStatus} />}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={initialQuery ?? ""}
                placeholder="Rechercher un domaine"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {totalMatching} site{totalMatching > 1 ? "s" : ""}
            </span>
          </form>
        </CardHeader>
        <CardContent className="px-0">
          {sites.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Aucun site ne correspond. Utilise le bouton « Bloquer un nouveau domaine » au-dessus
              pour ajouter manuellement un site signalé.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domaine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Blocage actuel</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="w-[280px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
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
                      {site.blockedCountries === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="destructive">
                          {formatCountries(site.blockedCountries)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatNumber(Math.round(site.trafficScore))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <ScanButton siteId={site.id} domain={site.domain} countries={countries} />
                        {site.blockedCountries === null ? (
                          <BlockRowButton
                            siteId={site.id}
                            domain={site.domain}
                            countries={countries}
                          />
                        ) : (
                          <UnblockRowButton siteId={site.id} domain={site.domain} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Vu pour la dernière fois — clique sur un domaine pour ouvrir la page détail (motifs,
        historique, scans complets).
      </p>
    </div>
  );
}

const blockInitial: BlockState = { ok: false, error: null };
const unblockInitial: UnblockState = { ok: false, error: null };
const rescanInitial: RescanState = { ok: false, error: null };

function BlockRowButton({
  siteId,
  domain,
  countries,
}: {
  siteId: string;
  domain: string;
  countries: string[];
}) {
  const [state, action] = useActionState(blockSite, blockInitial);

  useEffect(() => {
    if (state.ok) toast.success(`${domain} bloqué`);
    else if (state.error) toast.error(`${domain} : ${state.error}`);
  }, [state, domain]);

  return (
    <form action={action}>
      <input type="hidden" name="siteId" value={siteId} />
      {countries.map((c) => (
        <input key={c} type="hidden" name="countries" value={c} />
      ))}
      <BlockSubmit />
    </form>
  );
}

function BlockSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/50 bg-destructive/10 px-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
      title="Bloquer ce site selon le périmètre sélectionné"
    >
      <Shield className="size-3" />
      {pending ? "…" : "Bloquer"}
    </button>
  );
}

function UnblockRowButton({ siteId, domain }: { siteId: string; domain: string }) {
  const [state, action] = useActionState(unblockSite, unblockInitial);

  useEffect(() => {
    if (state.ok) toast.success(`${domain} débloqué`);
    else if (state.error) toast.error(`${domain} : ${state.error}`);
  }, [state, domain]);

  return (
    <form action={action}>
      <input type="hidden" name="siteId" value={siteId} />
      <UnblockSubmit />
    </form>
  );
}

function UnblockSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-input px-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
      title="Lever toutes les règles de blocage actives sur ce domaine"
    >
      <ShieldOff className="size-3" />
      {pending ? "…" : "Débloquer"}
    </button>
  );
}

function ScanButton({
  siteId,
  domain,
  countries,
}: {
  siteId: string;
  domain: string;
  countries: string[];
}) {
  const [state, action] = useActionState(requestRescan, rescanInitial);

  useEffect(() => {
    if (state.ok) toast.success(`Scan lancé pour ${domain}`);
    else if (state.error) toast.error(`${domain} : ${state.error}`);
  }, [state, domain]);

  return (
    <form action={action}>
      <input type="hidden" name="siteId" value={siteId} />
      {countries.map((c) => (
        <input key={c} type="hidden" name="countries" value={c} />
      ))}
      <ScanSubmit />
    </form>
  );
}

function ScanSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-input px-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
      title="Lancer un scan complet (5 providers) pour ce site"
    >
      <Sparkles className="size-3" />
      {pending ? "…" : "Scanner"}
    </button>
  );
}

export { formatDateTime };
