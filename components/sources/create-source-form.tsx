"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  createIngestSource,
  type CreateSourceState,
} from "@/app/(admin)/sources/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: CreateSourceState = { ok: false, error: null };

export function CreateSourceForm() {
  const [state, action] = useActionState(createIngestSource, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Source créée");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" required maxLength={80} placeholder="Ex: FAI-A" />
        <p className="text-xs text-muted-foreground">Lettres, chiffres, espaces, &apos;-&apos; et &apos;_&apos;.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" maxLength={500} placeholder="Optionnel" />
      </div>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Création…" : "Créer la source"}
    </Button>
  );
}
