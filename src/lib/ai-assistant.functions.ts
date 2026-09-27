import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEAD_AGENT, loadMemory, runLeadAgent } from "./ai-agent.server";
import { scoreLead } from "./scoring";

const LEAD_COLS = "id, tenant_id, full_name, email, phone, source, status, score, tags, notes, next_action, custom_fields, created_at";

async function gate(sb: any, tenantId: string) {
  const { data: tenant } = await sb.from("tenants").select("ai_autonomy, ai_paused, ai_daily_run_limit, ai_monthly_run_budget, industry, is_demo").eq("id", tenantId).single();
  if (!tenant) throw new Error("Workspace not found");
  if (tenant.ai_autonomy === "off") throw new Error("AI assistance is turned off for this workspace.");
  if (tenant.ai_paused) throw new Error("AI is paused by a workspace administrator (emergency stop).");
  const { data: setting } = await sb.from("ai_agent_settings").select("enabled, release_stage, prompt_version, autonomy").eq("tenant_id", tenantId).eq("agent", LEAD_AGENT.id).maybeSingle();
  if (setting && !setting.enabled) throw new Error("The lead qualification assistant is disabled for this workspace.");
  if (setting?.autonomy === "off") throw new Error("The lead qualification assistant's autonomy is set to Off.");
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const { count: monthCount } = await sb.from("ai_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart);
  if ((monthCount ?? 0) >= tenant.ai_monthly_run_budget) throw new Error("This workspace has used its monthly AI budget.");
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await sb.from("ai_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since);
  return { tenant, stage: (setting?.release_stage ?? "shadow") as "shadow" | "pilot" | "live", runsToday: count ?? 0 };
}

export const analyzeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => analyzeLeadCore(context.supabase as any, context.userId, data.leadId));

async function analyzeLeadCore(sb: any, userId: string, leadId: string, retryOf?: string) {
  const context = { userId };
  const data = { leadId };
  {
    const { data: lead } = await sb.from("leads").select(LEAD_COLS).eq("id", data.leadId).maybeSingle(); // RLS-scoped
    if (!lead) throw new Error("Lead not found");

    const { tenant, stage, runsToday } = await gate(sb, lead.tenant_id);
    if (runsToday >= tenant.ai_daily_run_limit) throw new Error("Daily AI limit reached for this workspace.");
    if (stage === "shadow" && !tenant.is_demo)
      throw new Error("This assistant is still in testing. An admin must run and approve an evaluation before it can be used on real leads.");
    if (stage === "pilot") {
      const { data: ok } = await sb.rpc("has_tenant_role", { _tenant_id: lead.tenant_id, _roles: ["tenant_admin", "sales_manager"] });
      if (!ok) throw new Error("This assistant is in pilot — only admins and managers can use it for now.");
    }

    // Reconcile before retry: stale "running" runs become "uncertain"; a completed run whose suggestion was never saved is resumed.
    await sb.from("ai_runs").update({ status: "uncertain", error: "Interrupted before finishing", finished_at: new Date().toISOString() })
      .eq("lead_id", lead.id).eq("status", "running").lt("created_at", new Date(Date.now() - 180000).toISOString());
    const { data: running } = await sb.from("ai_runs").select("id").eq("lead_id", lead.id).eq("status", "running").limit(1);
    if (running?.length) throw new Error("An analysis for this lead is already running.");
    const { data: done } = await sb.from("ai_runs").select("id, output, ai_recommendations(id)").eq("lead_id", lead.id).eq("status", "completed").eq("mode", "live")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString()).order("created_at", { ascending: false }).limit(1);
    const orphan = done?.[0];
    if (orphan && orphan.output && !(orphan.ai_recommendations ?? []).length) {
      const { data: rec, error } = await sb.from("ai_recommendations").insert({ tenant_id: lead.tenant_id, run_id: orphan.id, lead_id: lead.id, payload: orphan.output }).select("id").single();
      if (error) throw new Error(error.message);
      return { runId: orphan.id as string, recommendationId: rec.id as string, resumed: true };
    }

    const memory = await loadMemory(sb, lead.tenant_id, lead.id);
    const { data: run, error: runErr } = await sb.from("ai_runs").insert({
      tenant_id: lead.tenant_id, lead_id: lead.id, agent: LEAD_AGENT.id, prompt_version: LEAD_AGENT.promptVersion, model: LEAD_AGENT.model,
      input_snapshot: { lead, memory_ids: memory.map((m) => m.id), release_stage: stage }, created_by: context.userId, mode: "live", retry_of: retryOf ?? null,
    }).select("id").single();
    if (runErr) throw new Error(runErr.message);

    const started = Date.now();
    try {
      const out = await runLeadAgent(lead, tenant.industry, memory);
      await sb.from("ai_runs").update({ status: "completed", output: out, model: out.model_used, duration_ms: Date.now() - started, finished_at: new Date().toISOString() }).eq("id", run.id);
      const { data: rec, error } = await sb.from("ai_recommendations").insert({ tenant_id: lead.tenant_id, run_id: run.id, lead_id: lead.id, payload: out }).select("id").single();
      if (error) throw new Error(error.message);
      return { runId: run.id as string, recommendationId: rec.id as string, resumed: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI failed";
      await sb.from("ai_runs").update({ status: "failed", error: msg, duration_ms: Date.now() - started, finished_at: new Date().toISOString() }).eq("id", run.id);
      throw new Error(msg);
    }
  }
}

/** Shadow evaluation: runs the agent on recent leads without creating suggestions, tasks or notifications. */
export const runEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenantId: z.string().uuid(), sampleSize: z.number().int().min(1).max(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_tenant_role", { _tenant_id: data.tenantId, _roles: ["tenant_admin"] });
    if (!isAdmin) throw new Error("Only workspace administrators can run evaluations.");
    const { tenant, runsToday } = await gate(sb, data.tenantId);
    if (runsToday + data.sampleSize > tenant.ai_daily_run_limit) throw new Error("Daily AI limit would be exceeded.");

    const { data: leads } = await sb.from("leads").select(LEAD_COLS).eq("tenant_id", data.tenantId).order("created_at", { ascending: false }).limit(data.sampleSize);
    if (!leads?.length) throw new Error("Add at least one lead before running an evaluation.");

    const results: any[] = [];
    for (const lead of leads) {
      const rules = scoreLead({ full_name: lead.full_name, email: lead.email, phone: lead.phone, source: lead.source, message: lead.notes });
      const baseline = rules.category === "hot" ? "qualified" : rules.category === "warm" ? "needs_info" : "unqualified";
      const started = Date.now();
      const memory = await loadMemory(sb, data.tenantId, lead.id);
      const { data: run } = await sb.from("ai_runs").insert({
        tenant_id: data.tenantId, lead_id: lead.id, agent: LEAD_AGENT.id, prompt_version: LEAD_AGENT.promptVersion, model: LEAD_AGENT.model,
        input_snapshot: { lead, memory_ids: memory.map((m) => m.id) }, created_by: context.userId, mode: "eval",
      }).select("id").single();
      try {
        const out = await runLeadAgent(lead, tenant.industry, memory);
        await sb.from("ai_runs").update({ status: "completed", output: out, duration_ms: Date.now() - started, finished_at: new Date().toISOString() }).eq("id", run.id);
        results.push({ lead_id: lead.id, lead_name: lead.full_name, output: out, baseline, agrees_with_rules: baseline === out.qualification, rating: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI failed";
        await sb.from("ai_runs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", run.id);
        results.push({ lead_id: lead.id, lead_name: lead.full_name, error: msg, baseline, rating: "bad" });
        if (/credits|blocked/i.test(msg)) break; // terminal — stop the batch
      }
    }
    const { data: ev, error } = await sb.from("ai_evaluations").insert({
      tenant_id: data.tenantId, agent: LEAD_AGENT.id, prompt_version: LEAD_AGENT.promptVersion, model: LEAD_AGENT.model, results, created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { evaluationId: ev.id as string };
  });

/** Durable-run recovery: marks stale runs uncertain, then retries each uncertain lead run once (resuming saved results without a new AI call). */
export const retryUncertainRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_tenant_role", { _tenant_id: data.tenantId, _roles: ["tenant_admin"] });
    if (!isAdmin) throw new Error("Only workspace administrators can retry runs.");
    const now = new Date().toISOString();
    await sb.from("ai_runs").update({ status: "uncertain", error: "Interrupted before finishing", finished_at: now })
      .eq("tenant_id", data.tenantId).eq("status", "running").lt("created_at", new Date(Date.now() - 180000).toISOString());
    const { data: runs } = await sb.from("ai_runs").select("id, lead_id, output, ai_recommendations(id)")
      .eq("tenant_id", data.tenantId).eq("status", "uncertain").eq("mode", "live").not("lead_id", "is", null)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).limit(20);
    let resumed = 0, retried = 0, failed = 0;
    const seen = new Set<string>();
    for (const r of runs ?? []) {
      // Idempotent: claim the uncertain run first so parallel retries cannot both act on it.
      const { data: claimed } = await sb.from("ai_runs").update({ status: "retried" }).eq("id", r.id).eq("status", "uncertain").select("id");
      if (!claimed?.length || seen.has(r.lead_id)) continue;
      seen.add(r.lead_id);
      if ((r.ai_recommendations ?? []).length) continue; // already delivered — nothing to redo
      if (r.output) {
        const { error } = await sb.from("ai_recommendations").insert({ tenant_id: data.tenantId, run_id: r.id, lead_id: r.lead_id, payload: r.output });
        error ? failed++ : resumed++;
        continue;
      }
      try {
        await analyzeLeadCore(sb, context.userId, r.lead_id, r.id);
        retried++;
      } catch { failed++; }
    }
    return { checked: runs?.length ?? 0, resumed, retried, failed };
  });
