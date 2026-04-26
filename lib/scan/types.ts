import type { ScanProvider, ScanVerdict } from "@/app/generated/prisma";

export type ProviderInput = {
  domain: string;
};

export type ProviderResult = {
  provider: ScanProvider;
  verdict: ScanVerdict;
  score: number | null;
  raw: Record<string, unknown>;
};

export type ProviderRunner = {
  name: ScanProvider;
  enabled: boolean;
  run: (input: ProviderInput) => Promise<ProviderResult>;
};
