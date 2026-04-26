import { trafficEventSchema, type TrafficEvent } from "@/lib/ingest/schema";

export type ParsedLine =
  | { ok: true; event: TrafficEvent; lineNo: number }
  | { ok: false; error: string; lineNo: number; raw?: string };

export function parseNdjson(body: string): ParsedLine[] {
  const lines = body.split("\n");
  const out: ParsedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (raw === "") continue;

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      out.push({ ok: false, error: "Invalid JSON", lineNo: i + 1, raw });
      continue;
    }

    const parsed = trafficEventSchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      out.push({
        ok: false,
        error: `${first.path.join(".") || "(root)"}: ${first.message}`,
        lineNo: i + 1,
        raw,
      });
      continue;
    }

    out.push({ ok: true, event: parsed.data, lineNo: i + 1 });
  }

  return out;
}
