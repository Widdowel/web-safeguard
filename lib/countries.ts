export type Country = { code: string; name: string; group: "ECOWAS" | "Afrique" | "Hors Afrique" };

export const COUNTRIES: Country[] = [
  { code: "BJ", name: "Bénin", group: "ECOWAS" },
  { code: "BF", name: "Burkina Faso", group: "ECOWAS" },
  { code: "CV", name: "Cap-Vert", group: "ECOWAS" },
  { code: "CI", name: "Côte d'Ivoire", group: "ECOWAS" },
  { code: "GM", name: "Gambie", group: "ECOWAS" },
  { code: "GH", name: "Ghana", group: "ECOWAS" },
  { code: "GN", name: "Guinée", group: "ECOWAS" },
  { code: "GW", name: "Guinée-Bissau", group: "ECOWAS" },
  { code: "LR", name: "Libéria", group: "ECOWAS" },
  { code: "ML", name: "Mali", group: "ECOWAS" },
  { code: "NE", name: "Niger", group: "ECOWAS" },
  { code: "NG", name: "Nigeria", group: "ECOWAS" },
  { code: "SN", name: "Sénégal", group: "ECOWAS" },
  { code: "SL", name: "Sierra Leone", group: "ECOWAS" },
  { code: "TG", name: "Togo", group: "ECOWAS" },
  { code: "CM", name: "Cameroun", group: "Afrique" },
  { code: "GA", name: "Gabon", group: "Afrique" },
  { code: "TD", name: "Tchad", group: "Afrique" },
  { code: "CG", name: "Congo", group: "Afrique" },
  { code: "CD", name: "RD Congo", group: "Afrique" },
  { code: "MA", name: "Maroc", group: "Afrique" },
  { code: "DZ", name: "Algérie", group: "Afrique" },
  { code: "TN", name: "Tunisie", group: "Afrique" },
  { code: "EG", name: "Égypte", group: "Afrique" },
  { code: "FR", name: "France", group: "Hors Afrique" },
  { code: "BE", name: "Belgique", group: "Hors Afrique" },
  { code: "CA", name: "Canada", group: "Hors Afrique" },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export const ECOWAS_CODES = COUNTRIES.filter((c) => c.group === "ECOWAS").map((c) => c.code);

export function countryName(code: string): string {
  return COUNTRY_BY_CODE.get(code)?.name ?? code;
}

export function isValidCountryCode(code: string): boolean {
  return COUNTRY_BY_CODE.has(code);
}

export function sanitizeCountries(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const code = raw.trim().toUpperCase();
    if (!isValidCountryCode(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function formatCountries(codes: readonly string[]): string {
  if (codes.length === 0) return "Mondial";
  if (codes.length === 1) return countryName(codes[0]);
  if (codes.length === COUNTRIES.length) return "Tous les pays configurés";
  if (codes.length === ECOWAS_CODES.length && codes.every((c) => ECOWAS_CODES.includes(c))) {
    return "CEDEAO complet";
  }
  if (codes.length <= 3) return codes.map(countryName).join(", ");
  return `${codes.slice(0, 2).map(countryName).join(", ")} +${codes.length - 2}`;
}
