import { createFileRoute } from "@tanstack/react-router";
import { processIntakeEvent, sha256Hex } from "@/lib/intake.server";

const RATE_PER_MIN = 60;
const MAX_SKEW_MS = 5 * 60_000;

function json(body: unknown, status: number, correlationId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
  });
}

export const Route = createFileRoute("/api/public/intake/v1/leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
        const auth = request.headers.get("authorization") ?? "";
        const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!key.startsWith("sos_")) return json({ error: "Missing or invalid API key" }, 401, correlationId);

        const idem = request.headers.get("idempotency-key")?.trim();
        if (!idem || idem.length > 200) return json({ error: "Idempotency-Key header required" }, 400, correlationId);

        // Replay protection: request timestamp must be recent
        const ts = Number(request.headers.get("x-timestamp"));
        if (!ts || Math.abs(Date.now() - ts * (ts < 1e12 ? 1000 : 1)) > MAX_SKEW_MS)
          return json({ error: "X-Timestamp header missing or outside 5-minute window" }, 400, correlationId);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const { data: cred } = await admin.from("intake_credentials").select("id, tenant_id, status").eq("key_hash", await sha256Hex(key)).maybeSingle();
        if (!cred || cred.status !== "active") return json({ error: "Invalid or revoked API key" }, 401, correlationId);

        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await admin.from("intake_events").select("id", { count: "exact", head: true }).eq("credential_id", cred.id).gte("received_at", since);
        if ((count ?? 0) >= RATE_PER_MIN) return json({ error: "Rate limit exceeded" }, 429, correlationId);

        let payload: unknown;
        try {
          const text = await request.text();
          if (text.length > 64_000) return json({ error: "Payload too large" }, 413, correlationId);
          payload = JSON.parse(text);
        } catch {
          return json({ error: "Body must be valid JSON" }, 400, correlationId);
        }

        const { data: existing } = await admin.from("intake_events").select("id, status, lead_id, error").eq("tenant_id", cred.tenant_id).eq("idempotency_key", idem).maybeSingle();
        if (existing) return json({ event_id: existing.id, status: existing.status, lead_id: existing.lead_id, replayed: true }, 200, correlationId);

        const { data: ev, error } = await admin.from("intake_events").insert({
          tenant_id: cred.tenant_id, credential_id: cred.id, idempotency_key: idem, correlation_id: correlationId, payload,
        }).select("id").single();
        if (error) return json({ error: "Could not record event" }, 500, correlationId);
        await admin.from("intake_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", cred.id);

        const result = await processIntakeEvent(admin, ev.id);
        const status = result.status === "failed" ? 422 : result.status === "duplicate" ? 200 : 201;
        return json({ event_id: ev.id, status: result.status, lead_id: result.lead_id ?? null, error: result.error ?? undefined }, status, correlationId);
      },
    },
  },
});
