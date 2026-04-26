import { createHash, createHmac } from "node:crypto";
import { WebhookDeliveryStatus } from "@/app/generated/prisma";
import { getActiveBlocklist } from "@/lib/blocklist/source";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000];
const REQUEST_TIMEOUT_MS = 10_000;

export type DeliveryOutcome = {
  subscriberId: string;
  status: "succeeded" | "failed" | "skipped";
  attempts: number;
  responseCode?: number;
};

export async function notifyBlocklistChanged(): Promise<DeliveryOutcome[]> {
  const snapshot = await getActiveBlocklist();
  const subscribers = await prisma.blocklistSubscriber.findMany({
    where: { isActive: true },
  });

  const results: DeliveryOutcome[] = [];
  for (const sub of subscribers) {
    if (sub.lastEtagSent === snapshot.etag) {
      results.push({ subscriberId: sub.id, status: "skipped", attempts: 0 });
      continue;
    }
    const outcome = await deliverToSubscriber(sub.id, snapshot.etag);
    results.push(outcome);
  }
  return results;
}

export async function deliverToSubscriber(
  subscriberId: string,
  etag: string,
): Promise<DeliveryOutcome> {
  const subscriber = await prisma.blocklistSubscriber.findUnique({
    where: { id: subscriberId },
  });
  if (!subscriber) throw new Error(`Subscriber ${subscriberId} not found`);

  const snapshot = await getActiveBlocklist();
  const payload = JSON.stringify({
    type: "blocklist.changed",
    etag: snapshot.etag,
    generatedAt: new Date().toISOString(),
    count: snapshot.entries.length,
    entries: snapshot.entries.map((e) => ({
      type: e.type,
      value: e.value,
      countries: e.countries,
    })),
  });
  const payloadHash = createHash("sha256").update(payload).digest("hex");
  const signature = createHmac("sha256", subscriber.secretHash)
    .update(payload)
    .digest("hex");

  const delivery = await prisma.webhookDelivery.create({
    data: { subscriberId, etag, payloadHash },
  });

  let lastError: { code?: number; body?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }

    const result = await sendOnce(subscriber.url, payload, signature, etag);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { attempts: attempt + 1 },
    });

    if (result.ok) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: WebhookDeliveryStatus.SUCCEEDED,
            responseCode: result.statusCode,
            deliveredAt: new Date(),
          },
        }),
        prisma.blocklistSubscriber.update({
          where: { id: subscriberId },
          data: { lastEtagSent: etag, lastSuccessAt: new Date() },
        }),
      ]);
      return {
        subscriberId,
        status: "succeeded",
        attempts: attempt + 1,
        responseCode: result.statusCode,
      };
    }

    lastError = {
      code: result.statusCode,
      body: result.body,
      message: result.error,
    };
  }

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: WebhookDeliveryStatus.FAILED,
      responseCode: lastError?.code ?? null,
      responseBody: lastError?.body?.slice(0, 2000) ?? null,
      errorMessage: lastError?.message ?? null,
    },
  });

  return {
    subscriberId,
    status: "failed",
    attempts: MAX_ATTEMPTS,
    responseCode: lastError?.code,
  };
}

type SendResult =
  | { ok: true; statusCode: number }
  | { ok: false; statusCode?: number; body?: string; error?: string };

async function sendOnce(
  url: string,
  payload: string,
  signature: string,
  etag: string,
): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": `sha256=${signature}`,
        "x-blocklist-etag": etag,
        "user-agent": "web-safeguard/webhook",
      },
      body: payload,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.ok) return { ok: true, statusCode: res.status };

    const body = await res.text().catch(() => "");
    return { ok: false, statusCode: res.status, body };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
