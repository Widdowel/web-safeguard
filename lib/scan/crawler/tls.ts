import { connect, type PeerCertificate } from "node:tls";

export type TlsInspection = {
  ok: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  ageDays?: number;
  selfSigned?: boolean;
  error?: string;
};

const TIMEOUT_MS = 8_000;

export function inspectTls(host: string): Promise<TlsInspection> {
  return new Promise((resolve) => {
    const socket = connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          resolve({ ok: false, error: "No certificate" });
          return;
        }

        resolve(parseCert(cert));
      },
    );

    socket.setTimeout(TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ ok: false, error: "Timeout" });
    });

    socket.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

function parseCert(cert: PeerCertificate): TlsInspection {
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
  const now = Date.now();

  return {
    ok: true,
    issuer: formatName(cert.issuer),
    subject: formatName(cert.subject),
    validFrom: validFrom?.toISOString(),
    validTo: validTo?.toISOString(),
    daysUntilExpiry: validTo ? Math.round((validTo.getTime() - now) / 86_400_000) : undefined,
    ageDays: validFrom ? Math.round((now - validFrom.getTime()) / 86_400_000) : undefined,
    selfSigned: isSelfSigned(cert),
  };
}

function formatName(name: PeerCertificate["issuer"] | PeerCertificate["subject"]): string {
  if (!name) return "";
  const parts: string[] = [];
  if (name.CN) parts.push(`CN=${name.CN}`);
  if (name.O) parts.push(`O=${name.O}`);
  if (name.C) parts.push(`C=${name.C}`);
  return parts.join(", ");
}

function isSelfSigned(cert: PeerCertificate): boolean {
  if (!cert.issuer || !cert.subject) return false;
  return JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);
}
