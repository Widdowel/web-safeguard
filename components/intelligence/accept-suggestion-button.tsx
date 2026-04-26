"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  acceptSuggestion,
  type AcceptSuggestionState,
} from "@/app/(admin)/intelligence/actions";
import { Button } from "@/components/ui/button";

const initial: AcceptSuggestionState = { ok: false, error: null };

export function AcceptSuggestionButton({
  siteId,
  country,
}: {
  siteId: string;
  country: string;
}) {
  const [state, action] = useActionState(acceptSuggestion, initial);

  useEffect(() => {
    if (state.ok && state.domain) {
      toast.success(`${state.domain} bloqué pour ${country}`);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [country, state]);

  return (
    <form action={action}>
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="country" value={country} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? "…" : "Accepter & bloquer"}
    </Button>
  );
}
