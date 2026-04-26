"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { blockSite, type BlockState } from "@/app/(admin)/sites/actions";
import { CountrySelector } from "@/components/country-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: BlockState = { ok: false, error: null };

export function BlockForm({
  siteId,
  defaultCountries = [],
}: {
  siteId: string;
  defaultCountries?: readonly string[];
}) {
  const [state, action] = useActionState(blockSite, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Règle de blocage mise à jour");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />

      <div className="space-y-1.5">
        <Label>Périmètre géographique</Label>
        <CountrySelector
          name="countries"
          defaultSelected={defaultCountries}
          worldwideHint="Aucun pays sélectionné = blocage mondial (toutes IP)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`block-reason-${siteId}`}>Motif</Label>
        <Input
          id={`block-reason-${siteId}`}
          name="reason"
          maxLength={500}
          placeholder="Ex: phishing financier confirmé"
        />
      </div>

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Application…" : "Bloquer"}
    </Button>
  );
}
