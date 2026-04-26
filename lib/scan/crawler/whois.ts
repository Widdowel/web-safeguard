export type WhoisInspection = {
  ok: boolean;
  registrar?: string;
  createdAt?: string;
  ageDays?: number;
  error?: string;
};

const TIMEOUT_MS = 8_000;

const RDAP_BOOTSTRAP_TLDS: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/",
  net: "https://rdap.verisign.com/net/v1/",
  org: "https://rdap.publicinterestregistry.org/rdap/",
  io: "https://rdap.identitydigital.services/rdap/",
  me: "https://rdap.afilias.net/rdap/",
  bj: "https://rdap.nic.bj/rdap/",
};

const RDAP_DEFAULT = "https://rdap.org/domain/";

export async function inspectWhois(domain: string): Promise<WhoisInspection> {
  const tld = domain.split(".").pop()?.toLowerCase() ?? "";
  const base = RDAP_BOOTSTRAP_TLDS[tld] ?? RDAP_DEFAULT;
  const url = base === RDAP_DEFAULT ? `${base}${domain}` : `${base}domain/${domain}`;

  try {
    const res = await fetch(url, {
      headers: { accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });

    if (res.status === 404) {
      return { ok: false, error: "Domain not found in RDAP" };
    }
    if (!res.ok) {
      return { ok: false, error: `RDAP HTTP ${res.status}` };
    }

    const data = (await res.json()) as RdapResponse;
    const registration = pickEvent(data, "registration");
    const createdAt = registration?.eventDate ? new Date(registration.eventDate) : null;

    return {
      ok: true,
      registrar: extractRegistrar(data),
      createdAt: createdAt?.toISOString(),
      ageDays: createdAt
        ? Math.round((Date.now() - createdAt.getTime()) / 86_400_000)
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapEntity = {
  roles?: string[];
  vcardArray?: unknown[];
};
type RdapResponse = {
  events?: RdapEvent[];
  entities?: RdapEntity[];
};

function pickEvent(data: RdapResponse, action: string): RdapEvent | undefined {
  return data.events?.find((e) => e.eventAction === action);
}

function extractRegistrar(data: RdapResponse): string | undefined {
  const entity = data.entities?.find((e) => e.roles?.includes("registrar"));
  if (!entity?.vcardArray) return undefined;
  const vcard = entity.vcardArray[1];
  if (!Array.isArray(vcard)) return undefined;
  for (const item of vcard) {
    if (Array.isArray(item) && item[0] === "fn" && typeof item[3] === "string") {
      return item[3];
    }
  }
  return undefined;
}
