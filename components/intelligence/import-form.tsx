"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  importDomains,
  type ImportState,
} from "@/app/(admin)/intelligence/import/actions";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: ImportState = { ok: false, error: null };

export function DomainImportForm({ defaultCountry = "BJ" }: { defaultCountry?: string }) {
  const [state, action] = useActionState(importDomains, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      const imported = state.imported ?? 0;
      const exist = state.alreadyExisting ?? 0;
      const inv = state.invalid ?? 0;
      toast.success(
        `Import : ${imported} ajouté(s) · ${exist} déjà connu(s) · ${inv} rejeté(s)`,
      );
      if (imported > 0) formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="raw">Domaines (un par ligne, ou séparés par espace/virgule)</Label>
        <textarea
          id="raw"
          name="raw"
          required
          rows={10}
          maxLength={500_000}
          placeholder={`google.com\nfacebook.com\nemileede.com\norange.bj\nhttps://www.example.com/path → www.example.com\n…`}
          className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Maximum 5000 lignes. Les schémas (http://, https://) et chemins sont automatiquement
          nettoyés. Doublons et invalidités ignorés.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="country">Pays (optionnel)</Label>
          <select
            id="country"
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
        <div className="space-y-2">
          <Label className="invisible sm:block" htmlFor="attachTraffic">
            Attribution
          </Label>
          <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs">
            <input
              id="attachTraffic"
              type="checkbox"
              name="attachTraffic"
              value="true"
              defaultChecked
              className="size-4 accent-primary"
            />
            Attacher 1 échantillon de trafic factice par site pour ce pays
            <span className="ml-1 text-muted-foreground">
              (permet la vue « top sites par pays »)
            </span>
          </label>
        </div>
      </div>

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Import en cours…" : "Importer"}
    </Button>
  );
}
