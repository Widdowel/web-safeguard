import { z } from "zod";

export const trafficEventSchema = z.object({
  ts: z.union([z.string().datetime(), z.iso.datetime()]).transform((v) => new Date(v)),
  src_ip_hash: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[a-f0-9]+$/i, "Doit être un hex"),
  dst_domain: z
    .string()
    .min(1)
    .max(253)
    .toLowerCase()
    .regex(/^[a-z0-9.-]+$/, "Caractères invalides dans le domaine"),
  dst_ip: z
    .union([z.ipv4(), z.ipv6()])
    .optional()
    .nullable(),
  bytes: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  country_iso: z
    .string()
    .length(2)
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
});

export type TrafficEvent = z.infer<typeof trafficEventSchema>;
