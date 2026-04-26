"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  toggleSourceActive,
  type ToggleSourceState,
} from "@/app/(admin)/sources/actions";
import { Button } from "@/components/ui/button";

const initial: ToggleSourceState = { ok: false, error: null };

export function ToggleSourceButton({
  sourceId,
  isActive,
}: {
  sourceId: string;
  isActive: boolean;
}) {
  const [state, action] = useActionState(toggleSourceActive, initial);

  useEffect(() => {
    if (state.ok) toast.success("État mis à jour");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Submit isActive={isActive} />
    </form>
  );
}

function Submit({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : isActive ? "Désactiver" : "Activer"}
    </Button>
  );
}
