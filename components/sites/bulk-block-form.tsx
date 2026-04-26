"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { SiteStatus } from "@/app/generated/prisma";
import {
  bulkBlockSites,
  type BulkBlockState,
} from "@/app/(admin)/sites/actions";
import { CountrySelector } from "@/components/country-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: BulkBlockState = { ok: false, error: null };

const STATUS_LABEL: Record<SiteStatus, string> = {
  PENDING: "En attente",
  SAFE: "Sûrs",
  SUSPICIOUS: "Suspects",
  DANGEROUS: "Dangereux",
  WHITELISTED: "Liste blanche",
};

export function BulkBlockForm({
  defaultStatus,
  defaultQuery,
}: {
  defaultStatus?: SiteStatus | undefined;
  defaultQuery?: string;
}) {
  const [state, action] = useActionState(bulkBlockSites, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.blocked) {
      toast.success(`${state.blocked} site(s) bloqué(s) — ${state.scope ?? "Mondial"}`);
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Bloquer en masse les sites filtrés…
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-md border border-destructive/30 bg-destructive/5 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">Blocage en masse</h3>
        <p className="text-xs text-muted-foreground">
          Applique une règle de blocage à TOUS les sites correspondant aux filtres ci-dessous.
          Inclut aussi les sites SAFE / WHITELISTED si tu choisis ces statuts. Action tracée
          dans le journal d&apos;audit.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bulk-status">Statut concerné</Label>
          <select
            id="bulk-status"
            name="status"
            defaultValue={defaultStatus ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABEL) as SiteStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-query">Filtre par domaine (optionnel)</Label>
          <Input
            id="bulk-query"
            name="query"
            defaultValue={defaultQuery ?? ""}
            maxLength={120}
            placeholder="contient…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Périmètre géographique</Label>
        <CountrySelector
          name="countries"
          worldwideHint="Aucun pays sélectionné = blocage mondial pour tous les sites filtrés"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bulk-reason">Motif</Label>
        <Input
          id="bulk-reason"
          name="reason"
          maxLength={500}
          placeholder="Ex: campagne anti-phishing avril 2026"
        />
      </div>

      <div className="flex gap-2">
        <Submit />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Application…" : "Confirmer le blocage en masse"}
    </Button>
  );
}
