import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { processIntakeEvent, sha256Hex } from "./intake.server";

export const createIntakeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenantId: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = "sos_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await (context.supabase as any).from("intake_credentials").insert({
      tenant_id: data.tenantId, name: data.name, key_prefix: key.slice(0, 10), key_hash: await sha256Hex(key), created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { key };
  });

export const reprocessIntakeEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Visibility via RLS proves caller is admin/manager/ops of the event's workspace
    const { data: ev } = await (context.supabase as any).from("intake_events").select("id").eq("id", data.eventId).maybeSingle();
    if (!ev) throw new Error("Not allowed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await processIntakeEvent(supabaseAdmin, data.eventId);
    return { status: r.status as string, error: (r.error as string | null) ?? null };
  });
