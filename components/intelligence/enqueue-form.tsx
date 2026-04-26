"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  enqueueScansForCountry,
  type EnqueueState,
} from "@/app/(admin)/intelligence/actions";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: EnqueueState = { ok: false, error: null };

export function EnqueueForm({ defaultCountry = "BJ" }: { defaultCountry?: string }) {
  const [state, action] = useActionState(enqueueScansForCountry, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      const enqueued = state.enqueued ?? 0;
      const already = state.alreadyPending ?? 0;
      if (enqueued > 0) toast.success(`${enqueued} scan(s) enfilé(s)`);
      if (already > 0) toast.info(`${already} site(s) déjà en file ou en cours`);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[1fr_140px_180px_auto]">
      <div className="space-y-2">
        <Label htmlFor="enq-country">Pays cible</Label>
        <select
          id="enq-country"
          name="country"
          defaultValue={defaultCountry}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="enq-limit">Top N sites</Label>
        <Input
          id="enq-limit"
          name="limit"
          type="number"
          min={1}
          max={5000}
          defaultValue={500}
          required
        />
      </div>
      <div className="flex items-end gap-2">
        <label className="flex h-10 items-center gap-2 text-xs">
          <input type="checkbox" name="onlyUnscanned" value="true" className="size-4 accent-primary" />
          Uniquement les non-scannés
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
    <Button type="submit" disabled={pending}>
      {pending ? "Enfilement…" : "Enfiler les scans"}
    </Button>
  );
}
