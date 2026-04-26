"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  revokeIngestToken,
  type RevokeTokenState,
} from "@/app/(admin)/sources/actions";
import { Button } from "@/components/ui/button";

const initial: RevokeTokenState = { ok: false, error: null };

export function RevokeTokenButton({ tokenId }: { tokenId: string }) {
  const [state, action] = useActionState(revokeIngestToken, initial);

  useEffect(() => {
    if (state.ok) toast.success("Token révoqué");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="tokenId" value={tokenId} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Révoquer"}
    </Button>
  );
}
