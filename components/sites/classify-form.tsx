"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { useEffect } from "react";
import { SiteStatus } from "@/app/generated/prisma";
import { classifySite, type ClassifyState } from "@/app/(admin)/sites/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ClassifyState = { ok: false, error: null };

const STATUS_LABEL: Record<SiteStatus, string> = {
  PENDING: "En attente",
  SAFE: "Sûr",
  SUSPICIOUS: "Suspect",
  DANGEROUS: "Dangereux",
  WHITELISTED: "Liste blanche",
};

export function ClassifyForm({
  siteId,
  currentStatus,
}: {
  siteId: string;
  currentStatus: SiteStatus;
}) {
  const [state, action] = useActionState(classifySite, initial);

  useEffect(() => {
    if (state.ok) toast.success("Classification mise à jour");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />
      <div className="space-y-2">
        <Label htmlFor="toState">Nouvelle classification</Label>
        <select
          id="toState"
          name="toState"
          defaultValue={currentStatus}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {(Object.keys(STATUS_LABEL) as SiteStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Justification</Label>
        <Input id="reason" name="reason" maxLength={500} placeholder="Optionnel" />
      </div>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Mettre à jour"}
    </Button>
  );
}
