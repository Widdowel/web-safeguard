import { authorizeBlocklistConsumer, blocklistHeaders, notModifiedIfMatchingEtag } from "@/lib/blocklist/http";
import { getActiveBlocklist, partition } from "@/lib/blocklist/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authorizeBlocklistConsumer(req);
  if (!auth.ok) return auth.response;

  const snapshot = await getActiveBlocklist();
  const notModified = notModifiedIfMatchingEtag(req, snapshot.etag);
  if (notModified) return notModified;

  const { domains } = partition(snapshot);
  const serial = Math.floor(snapshot.lastModified.getTime() / 1000);

  const lines: string[] = [
    `$TTL 300`,
    `$ORIGIN rpz.web-safeguard.local.`,
    `@ IN SOA ns.web-safeguard.local. admin.web-safeguard.local. (`,
    `    ${serial} ; serial`,
    `    3600     ; refresh`,
    `    600      ; retry`,
    `    86400    ; expire`,
    `    300      ; minimum`,
    `)`,
    `@ IN NS ns.web-safeguard.local.`,
    "",
    "; Blocked domains (NXDOMAIN)",
  ];

  for (const entry of domains) {
    lines.push(`${entry.value} CNAME .`);
    lines.push(`*.${entry.value} CNAME .`);
  }

  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: blocklistHeaders("text/dns; charset=utf-8", snapshot.etag, snapshot.lastModified),
  });
}
