import { extractBearerToken, authenticateIngestToken } from "@/lib/ingest/auth";

export type AuthFailure = { ok: false; response: Response };
export type AuthSuccess = { ok: true; sourceName: string };

export async function authorizeBlocklistConsumer(
  req: Request,
): Promise<AuthFailure | AuthSuccess> {
  const raw = extractBearerToken(req.headers);
  if (!raw) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "missing_authorization",
          hint: "Authorization: Bearer <consumer-token>",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    };
  }

  const token = await authenticateIngestToken(raw);
  if (!token) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }

  return { ok: true, sourceName: token.sourceName };
}

export function notModifiedIfMatchingEtag(req: Request, etag: string): Response | null {
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: { etag, "cache-control": "no-cache" },
    });
  }
  return null;
}

export function blocklistHeaders(
  contentType: string,
  etag: string,
  lastModified: Date,
): HeadersInit {
  return {
    "content-type": contentType,
    etag,
    "last-modified": lastModified.toUTCString(),
    "cache-control": "no-cache, must-revalidate",
  };
}
