"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { SiteStatus } from "@/app/generated/prisma";

const COLORS: Record<SiteStatus, string> = {
  PENDING: "hsl(0 0% 64%)",
  SAFE: "hsl(142 71% 35%)",
  SUSPICIOUS: "hsl(38 92% 50%)",
  DANGEROUS: "hsl(0 84% 50%)",
  WHITELISTED: "hsl(220 91% 28%)",
};

const LABELS: Record<SiteStatus, string> = {
  PENDING: "En attente",
  SAFE: "Sûr",
  SUSPICIOUS: "Suspect",
  DANGEROUS: "Dangereux",
  WHITELISTED: "Liste blanche",
};

export function StatusDistribution({ data }: { data: Record<SiteStatus, number> }) {
  const entries = (Object.keys(data) as SiteStatus[])
    .map((status) => ({ status, label: LABELS[status], value: data[status] }))
    .filter((e) => e.value > 0);

  if (entries.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Aucun site classé pour l&apos;instant
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={entries}
            dataKey="value"
            nameKey="label"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {entries.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const num = typeof value === "number" ? value : Number(value ?? 0);
              return num.toLocaleString("fr-FR");
            }}
            contentStyle={{
              border: "1px solid hsl(0 0% 90%)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
