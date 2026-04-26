"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  quickScanDomain,
  type QuickScanState,
} from "@/app/(admin)/sites/actions";
import { CountrySelector } from "@/components/country-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: QuickScanState = { ok: false, error: null };

export function QuickScanForm() {
  const [state, action] = useActionState(quickScanDomain, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.scannedDomain) {
      toast.success(`Scan lancé pour ${state.scannedDomain}`);
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" />
        Scanner un nouveau domaine…
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-md border bg-card p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">Scan rapide d&apos;un domaine</h3>
        <p className="text-xs text-muted-foreground">
          Crée le site (statut « En attente ») et lance le scan complet (5 providers : Google
          Safe Browsing, PhishTank, urlscan, VirusTotal, crawler interne).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quick-scan-domain">Nom de domaine</Label>
        <Input
          id="quick-scan-domain"
          name="domain"
          required
          minLength={3}
          maxLength={253}
          placeholder="exemple.com"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Pays concernés (contexte)</Label>
        <CountrySelector
          name="countries"
          worldwideHint="Vide = scan global, sans contexte pays particulier"
        />
      </div>

      <div className="flex gap-2">
        <Submit />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Lancement…" : "Lancer le scan"}
    </Button>
  );
}
