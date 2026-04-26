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

  const { ips, prefixes } = partition(snapshot);
  const lines: string[] = [
    `# web-safeguard BGP blackhole prefixes`,
    `# Generated: ${new Date().toISOString()}`,
    `# Version: ${snapshot.etag}`,
    `# Single IPs: ${ips.length} | prefixes: ${prefixes.length}`,
    "",
  ];

  for (const entry of ips) {
    lines.push(`${entry.value}/32`);
  }
  for (const entry of prefixes) {
    lines.push(entry.value);
  }

  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: blocklistHeaders("text/plain; charset=utf-8", snapshot.etag, snapshot.lastModified),
  });
}
