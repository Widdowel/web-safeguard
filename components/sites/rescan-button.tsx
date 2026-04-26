"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { requestRescan, type RescanState } from "@/app/(admin)/sites/actions";
import { Button } from "@/components/ui/button";

const initial: RescanState = { ok: false, error: null };

export function RescanButton({ siteId }: { siteId: string }) {
  const [state, action] = useActionState(requestRescan, initial);

  useEffect(() => {
    if (state.ok) toast.success("Rescan demandé");
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
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Demande…" : "Demander un rescan"}
    </Button>
  );
}
