import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),

  IP_HASH_SALT: z.string().min(16).optional(),
  INGEST_TOKEN_PEPPER: z.string().min(16).optional(),

  GOOGLE_SAFE_BROWSING_API_KEY: z.string().optional(),
  VIRUSTOTAL_API_KEY: z.string().optional(),
  URLSCAN_API_KEY: z.string().optional(),
  PHISHTANK_API_KEY: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Environment validation failed — see errors above");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

export const isProduction = env.NODE_ENV === "production";
export const isNeon =
  env.DATABASE_URL.includes("neon.tech") ||
  env.DATABASE_URL.includes(".aws.neon.") ||
  env.DATABASE_URL.includes("neon.build");
