export type HeuristicsResult = {
  ok: boolean;
  fetched?: boolean;
  status?: number;
  contentLength?: number;
  hasPasswordField?: boolean;
  formCount?: number;
  hasInsecureForm?: boolean;
  suspiciousKeywords?: string[];
  externalScripts?: number;
  error?: string;
};

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 512 * 1024;

const SUSPICIOUS_KEYWORDS_FR = [
  "mot de passe",
  "vérification compte",
  "compte bloqué",
  "votre compte sera",
  "transfert d'argent",
  "moov money",
  "mtn mobile money",
  "code otp",
  "code de vérification",
  "carte bancaire",
  "numéro de carte",
  "cryptobonus",
  "cashback",
  "loterie",
  "gagnant",
];

const SUSPICIOUS_KEYWORDS_EN = [
  "verify your account",
  "account suspended",
  "confirm your password",
  "credit card",
  "wire transfer",
  "bitcoin reward",
  "free crypto",
  "claim your prize",
  "limited time offer",
];

export async function runHeuristics(domain: string): Promise<HeuristicsResult> {
  try {
    const res = await fetch(`https://${domain}/`, {
      method: "GET",
      headers: {
        "user-agent": "web-safeguard-scanner/1.0 (+https://web-safeguard.local)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return { ok: true, fetched: true, status: res.status };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    reader.cancel().catch(() => {});

    const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks)).toLowerCase();

    const hasPasswordField = /<input[^>]*type=["']?password["']?/i.test(html);
    const formCount = (html.match(/<form[\s>]/g) ?? []).length;
    const hasInsecureForm = /<form[^>]*action=["']http:\/\//i.test(html);
    const externalScripts = (html.match(/<script[^>]*src=["']https?:\/\//gi) ?? []).length;

    const matched: string[] = [];
    for (const kw of [...SUSPICIOUS_KEYWORDS_FR, ...SUSPICIOUS_KEYWORDS_EN]) {
      if (html.includes(kw)) matched.push(kw);
      if (matched.length >= 8) break;
    }

    return {
      ok: true,
      fetched: true,
      status: res.status,
      contentLength: total,
      hasPasswordField,
      formCount,
      hasInsecureForm,
      suspiciousKeywords: matched,
      externalScripts,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type TyposquatCheck = {
  isLikelyTyposquat: boolean;
  closestBrand?: string;
  distance?: number;
};

const PROTECTED_BRANDS = [
  "google",
  "youtube",
  "facebook",
  "instagram",
  "amazon",
  "paypal",
  "binance",
  "coinbase",
  "moov",
  "mtn",
  "ecobank",
  "boa",
  "uba",
  "western union",
  "moneygram",
  "orange",
  "presidence",
];

export function detectTyposquat(domain: string): TyposquatCheck {
  const label = domain.split(".")[0].toLowerCase();
  if (PROTECTED_BRANDS.includes(label)) {
    return { isLikelyTyposquat: false };
  }

  let bestBrand: string | undefined;
  let bestDistance = Infinity;
  for (const brand of PROTECTED_BRANDS) {
    const cleanBrand = brand.replace(/\s+/g, "");
    const d = levenshtein(label, cleanBrand);
    if (d < bestDistance) {
      bestDistance = d;
      bestBrand = brand;
    }
  }

  if (bestBrand && bestDistance > 0 && bestDistance <= 2 && label.length >= 4) {
    return { isLikelyTyposquat: true, closestBrand: bestBrand, distance: bestDistance };
  }

  for (const brand of PROTECTED_BRANDS) {
    const cleanBrand = brand.replace(/\s+/g, "");
    if (label.includes(cleanBrand) && label !== cleanBrand && label.length > cleanBrand.length + 1) {
      return { isLikelyTyposquat: true, closestBrand: brand, distance: 0 };
    }
  }

  return { isLikelyTyposquat: false };
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}
