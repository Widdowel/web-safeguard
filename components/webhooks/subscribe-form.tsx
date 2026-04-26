"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { subscribeWebhook, type SubscribeState } from "@/app/(admin)/webhooks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: SubscribeState = { ok: false, error: null };

export function SubscribeForm() {
  const [state, action] = useActionState(subscribeWebhook, initial);
  const [acknowledgedSecret, setAcknowledgedSecret] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.plaintextSecret) {
      toast.success("Webhook enregistré — copie le secret maintenant.");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const secretToReveal =
    state.ok && state.plaintextSecret && state.plaintextSecret !== acknowledgedSecret
      ? state.plaintextSecret
      : null;

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="webhook-name">Nom</Label>
          <Input id="webhook-name" name="name" required minLength={2} maxLength={80} placeholder="FAI-A" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhook-url">URL HTTPS</Label>
          <Input
            id="webhook-url"
            name="url"
            type="url"
            required
            placeholder="https://example.com/web-safeguard/blocklist"
          />
        </div>
        <div className="sm:col-span-2">
          <Submit />
        </div>
      </form>

      {secretToReveal && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
          <p className="text-xs font-medium text-warning">
            ⚠️ Stocke ce secret côté FAI. Il sert à signer les requêtes
            (header <code>x-webhook-signature</code>). Il ne sera plus affiché.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-card px-2 py-1.5 font-mono text-xs">
              {secretToReveal}
            </code>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(secretToReveal);
                toast.success("Secret copié");
              }}
            >
              <Copy />
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setAcknowledgedSecret(secretToReveal)}
          >
            J&apos;ai copié, masquer
          </button>
        </div>
      )}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Ajouter le webhook"}
    </Button>
  );
}
