"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  createIngestToken,
  type CreateTokenState,
} from "@/app/(admin)/sources/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: CreateTokenState = { ok: false, error: null };

export function IssueTokenForm({ sourceId }: { sourceId: string }) {
  const [state, action] = useActionState(createIngestToken, initial);
  const [acknowledgedToken, setAcknowledgedToken] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.plaintextToken) {
      toast.success("Token créé — copie-le, il n'est plus affichable après.");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const tokenToReveal =
    state.ok && state.plaintextToken && state.plaintextToken !== acknowledgedToken
      ? state.plaintextToken
      : null;

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="sourceId" value={sourceId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`label-${sourceId}`}>Étiquette</Label>
            <Input
              id={`label-${sourceId}`}
              name="label"
              maxLength={80}
              placeholder="Ex: prod-rotated-2026Q2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`expiry-${sourceId}`}>Expiration (jours)</Label>
            <Input
              id={`expiry-${sourceId}`}
              name="expiresInDays"
              type="number"
              min={0}
              max={3650}
              placeholder="Vide = pas d'expiration"
            />
          </div>
        </div>
        <Submit />
      </form>

      {tokenToReveal && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
          <p className="text-xs font-medium text-warning">
            ⚠️ Copie ce token MAINTENANT. Il ne sera plus jamais affiché.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-card px-2 py-1.5 font-mono text-xs">
              {tokenToReveal}
            </code>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(tokenToReveal);
                toast.success("Token copié");
              }}
            >
              <Copy />
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setAcknowledgedToken(tokenToReveal)}
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
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Génération…" : "Générer un token"}
    </Button>
  );
}
