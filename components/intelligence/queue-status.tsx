"use client";

import { useEffect, useState } from "react";

type Stats = {
  pending: number;
  running: number;
  doneRecent: number;
  failedRecent: number;
};

const POLL_MS = 2_000;

export function QueueStatus() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/scan/queue", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Stats;
        if (!cancelled) setStats(data);
      } catch {
        /* ignore */
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!stats) {
    return <p className="text-xs text-muted-foreground">Chargement de la file…</p>;
  }

  const inFlight = stats.pending + stats.running;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Pill label="En attente" value={stats.pending} tone="warning" pulse={stats.pending > 0} />
      <Pill label="En cours" value={stats.running} tone="primary" pulse={stats.running > 0} />
      <Pill label="Terminés (24 h)" value={stats.doneRecent} tone="success" />
      <Pill label="Échecs (24 h)" value={stats.failedRecent} tone="destructive" />
      {inFlight > 0 && (
        <span className="text-xs text-muted-foreground">
          Mise à jour automatique toutes les {POLL_MS / 1000}s
        </span>
      )}
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
  pulse = false,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "destructive";
  pulse?: boolean;
}) {
  const dotClass =
    tone === "primary"
      ? "bg-primary"
      : tone === "success"
      ? "bg-success"
      : tone === "warning"
      ? "bg-warning"
      : "bg-destructive";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
      <span
        className={`size-2 rounded-full ${dotClass} ${pulse ? "animate-pulse" : ""}`}
      />
      <span className="font-mono tabular-nums">{value.toLocaleString("fr-FR")}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
