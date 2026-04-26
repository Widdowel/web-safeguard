"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { requestRescan, type RescanState } from "@/app/(admin)/sites/actions";
import { CountrySelector } from "@/components/country-selector";
import { Button } from "@/components/ui/button";

const initial: RescanState = { ok: false, error: null };

export function RescanButton({ siteId }: { siteId: string }) {
  const [state, action] = useActionState(requestRescan, initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) toast.success("Scan demandé");
    else if (state.error) toast.error(state.error);
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Demander un rescan
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-md border bg-card p-4 space-y-3 max-w-md"
    >
      <input type="hidden" name="siteId" value={siteId} />
      <div className="text-sm font-medium">Pays concernés (optionnel)</div>
      <CountrySelector
        name="countries"
        worldwideHint="Vide = scan global, sans contexte pays particulier"
      />
      <div className="flex gap-2">
        <Submit />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Lancement…" : "Lancer le scan"}
    </Button>
  );
}
