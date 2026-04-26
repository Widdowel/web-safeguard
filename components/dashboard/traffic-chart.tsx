"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBytes } from "@/lib/format";

type Point = { day: string; bytes: number; samples: number };

export function TrafficChart({ data }: { data: Point[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(220 91% 28%)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(220 91% 28%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 90%)" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={(v) => formatBytes(Number(v))}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value ?? 0);
              return name === "bytes" ? formatBytes(num) : num.toLocaleString("fr-FR");
            }}
            labelClassName="text-xs"
            contentStyle={{
              border: "1px solid hsl(0 0% 90%)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="bytes"
            stroke="hsl(220 91% 28%)"
            strokeWidth={2}
            fill="url(#trafficFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
