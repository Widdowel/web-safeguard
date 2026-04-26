"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  quickBlockDomain,
  type QuickBlockState,
} from "@/app/(admin)/sites/actions";
import { CountrySelector } from "@/components/country-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: QuickBlockState = { ok: false, error: null };

export function QuickBlockForm() {
  const [state, action] = useActionState(quickBlockDomain, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.blockedDomain) {
      toast.success(`${state.blockedDomain} bloqué — ${state.scope ?? "Mondial"}`);
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bloquer un nouveau domaine…
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-md border bg-card p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">Blocage rapide par nom de domaine</h3>
        <p className="text-xs text-muted-foreground">
          Crée le site (statut DANGEROUS) puis applique la règle de blocage. Utile pour bloquer
          un domaine signalé manuellement, sans attendre qu&apos;il apparaisse dans le trafic
          ingéré.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="quick-domain">Nom de domaine</Label>
          <Input
            id="quick-domain"
            name="domain"
            required
            minLength={3}
            maxLength={253}
            placeholder="exemple-frauduleux.com"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Périmètre géographique</Label>
        <CountrySelector
          name="countries"
          worldwideHint="Aucun pays sélectionné = blocage mondial"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quick-reason">Motif</Label>
        <Input
          id="quick-reason"
          name="reason"
          maxLength={500}
          placeholder="Ex: signalement utilisateur, fraude confirmée"
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
      {pending ? "Application…" : "Bloquer le domaine"}
    </Button>
  );
}
