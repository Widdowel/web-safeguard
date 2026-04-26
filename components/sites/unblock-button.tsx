"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { unblockSite, type UnblockState } from "@/app/(admin)/sites/actions";
import { Button } from "@/components/ui/button";

const initial: UnblockState = { ok: false, error: null };

export function UnblockButton({ siteId }: { siteId: string }) {
  const [state, action] = useActionState(unblockSite, initial);

  useEffect(() => {
    if (state.ok) toast.success("Site débloqué");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="siteId" value={siteId} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Lever le blocage"}
    </Button>
  );
}
