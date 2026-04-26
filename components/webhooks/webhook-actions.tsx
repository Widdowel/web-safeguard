"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  triggerWebhook,
  unsubscribeWebhook,
  type TriggerState,
  type UnsubscribeState,
} from "@/app/(admin)/webhooks/actions";
import { Button } from "@/components/ui/button";

const triggerInitial: TriggerState = { ok: false, error: null };
const unsubInitial: UnsubscribeState = { ok: false, error: null };

export function TriggerWebhookButton({ id }: { id: string }) {
  const [state, action] = useActionState(triggerWebhook, triggerInitial);

  useEffect(() => {
    if (state.ok && state.result) toast.success(state.result);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <TriggerSubmit />
    </form>
  );
}

function TriggerSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Envoi…" : "Tester"}
    </Button>
  );
}

export function UnsubscribeButton({ id }: { id: string }) {
  const [state, action] = useActionState(unsubscribeWebhook, unsubInitial);

  useEffect(() => {
    if (state.ok) toast.success("Webhook désactivé");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <UnsubSubmit />
    </form>
  );
}

function UnsubSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Désactiver"}
    </Button>
  );
}
