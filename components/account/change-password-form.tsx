"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { changePassword, type ChangePasswordState } from "@/app/(admin)/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ChangePasswordState = { ok: false, error: null };

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Mot de passe mis à jour");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">Au moins 10 caractères.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
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
