"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  importTrancoTopN,
  type FetchTrancoState,
} from "@/app/(admin)/intelligence/import/actions";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: FetchTrancoState = { ok: false, error: null };

export function TrancoForm({ defaultCountry = "BJ" }: { defaultCountry?: string }) {
  const [state, action] = useActionState(importTrancoTopN, initial);

  useEffect(() => {
    if (state.ok) toast.success(`Tranco : ${state.fetched} domaine(s) importé(s)`);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[140px_200px_1fr_auto]">
      <div className="space-y-2">
        <Label htmlFor="tranco-limit">Top N</Label>
        <Input
          id="tranco-limit"
          name="limit"
          type="number"
          min={10}
          max={5000}
          defaultValue={500}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tranco-country">Pays</Label>
        <select
          id="tranco-country"
          name="country"
          defaultValue={defaultCountry}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Aucun</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs">
          <input
            type="checkbox"
            name="attachTraffic"
            value="true"
            defaultChecked
            className="size-4 accent-primary"
          />
          Attribuer au pays sélectionné
        </label>
      </div>
      <div className="flex items-end">
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Téléchargement…" : "Importer Tranco"}
    </Button>
  );
}
