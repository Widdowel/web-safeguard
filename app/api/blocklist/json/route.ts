import { authorizeBlocklistConsumer, blocklistHeaders, notModifiedIfMatchingEtag } from "@/lib/blocklist/http";
import { getActiveBlocklist } from "@/lib/blocklist/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authorizeBlocklistConsumer(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const country = url.searchParams.get("country");
  const snapshot = await getActiveBlocklist(country);
  const notModified = notModifiedIfMatchingEtag(req, snapshot.etag);
  if (notModified) return notModified;

  const body = JSON.stringify({
    version: snapshot.etag,
    generatedAt: new Date().toISOString(),
    lastModified: snapshot.lastModified.toISOString(),
    country: snapshot.country,
    count: snapshot.entries.length,
    entries: snapshot.entries.map((e) => ({
      type: e.type,
      value: e.value,
      countries: e.countries,
      updatedAt: e.updatedAt.toISOString(),
    })),
  });

  return new Response(body, {
    status: 200,
    headers: blocklistHeaders("application/json; charset=utf-8", snapshot.etag, snapshot.lastModified),
  });
}
