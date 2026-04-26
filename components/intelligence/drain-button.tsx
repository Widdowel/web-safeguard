"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { drainQueueOnce } from "@/app/(admin)/intelligence/actions";
import { Button } from "@/components/ui/button";

export function DrainButton() {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        startTransition(async () => {
          const r = await drainQueueOnce();
          if (r.ok) {
            const picked = r.picked ?? 0;
            toast.success(picked === 0 ? "File vide" : `${picked} scan(s) traité(s)`);
          } else if (r.error) {
            toast.error(r.error);
          }
          setBusy(false);
        });
      }}
    >
      {busy ? "Traitement…" : "Forcer le traitement"}
    </Button>
  );
}
