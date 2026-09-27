import { z } from "zod";
import { scoreLead, resolveScoring, normalizeEmail, normalizePhone } from "./scoring";

export const IntakePayload = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  source: z.string().trim().max(60).optional().default("api"),
  message: z.string().trim().max(5000).optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
  timeline: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
  external_id: z.string().max(200).optional().nullable(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Process one stored intake event. Idempotent: returns existing result if already processed. */
export async function processIntakeEvent(admin: Admin, eventId: string) {
  const { data: ev, error } = await admin.from("intake_events").select("*, intake_credentials(created_by)").eq("id", eventId).single();
  if (error || !ev) throw new Error("Event not found");
  if (ev.status === "processed" || ev.status === "duplicate") return ev;

  const attempts = (ev.attempts ?? 0) + 1;
  try {
    const p = IntakePayload.parse(ev.payload);
    if (!p.email && !p.phone) throw new Error("Either email or phone is required");
    const email = normalizeEmail(p.email);
    const phone = normalizePhone(p.phone);

    // In-tenant duplicate detection
    const ors = [email ? `email.eq.${email}` : null, phone ? `phone.eq.${phone}` : null].filter(Boolean).join(",");
    const { data: dup } = await admin.from("leads").select("id").eq("tenant_id", ev.tenant_id).or(ors).limit(1);
    if (dup && dup.length) {
      await admin.from("intake_events").update({ status: "duplicate", lead_id: dup[0].id, attempts, processed_at: new Date().toISOString(), error: null }).eq("id", ev.id);
      await admin.from("activities").insert({
        tenant_id: ev.tenant_id, kind: "note", created_by: ev.intake_credentials?.created_by,
        summary: `Repeat enquiry received via ${p.source} (correlation ${ev.correlation_id})`, occurred_at: new Date().toISOString(),
      }).then(() => null, () => null);
      return { ...ev, status: "duplicate", lead_id: dup[0].id };
    }

    const { data: tcfg } = await admin.from("tenants").select("scoring_config").eq("id", ev.tenant_id).maybeSingle();
    const s = scoreLead({ ...p, email, phone }, tcfg?.scoring_config ? resolveScoring(tcfg.scoring_config) : null);
    const createdBy = ev.intake_credentials?.created_by;
    if (!createdBy) throw new Error("Credential owner missing");
    const { data: lead, error: le } = await admin.from("leads").insert({
      tenant_id: ev.tenant_id, full_name: p.full_name, email, phone, source: p.source,
      status: "new", score: s.total, tags: [...p.tags, s.category], notes: p.message ?? null,
      next_action: "Assign an owner and make first contact", created_by: createdBy, owner_id: null,
      provenance: { channel: "intake_api", event_id: ev.id, correlation_id: ev.correlation_id, external_id: p.external_id ?? null, budget: p.budget ?? null, timeline: p.timeline ?? null },
    }).select("id").single();
    if (le) throw new Error(le.message);

    await admin.from("lead_score_history").insert({ tenant_id: ev.tenant_id, lead_id: lead.id, score: s.total, breakdown: s, source: "engine", reason: "Scored on intake" });
    // Manager assigns: create an unassigned follow-up task
    await admin.from("tasks").insert({
      tenant_id: ev.tenant_id, title: `Assign & contact new lead: ${p.full_name}`, kind: "call",
      due_at: new Date(Date.now() + 4 * 3600_000).toISOString(), status: "open", lead_id: lead.id, assignee_id: null, created_by: createdBy,
    });
    await admin.from("intake_events").update({ status: "processed", lead_id: lead.id, attempts, processed_at: new Date().toISOString(), error: null }).eq("id", ev.id);
    return { ...ev, status: "processed", lead_id: lead.id };
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (e as Error).message;
    await admin.from("intake_events").update({ status: "failed", error: msg, attempts }).eq("id", ev.id);
    return { ...ev, status: "failed", error: msg };
  }
}

export async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
