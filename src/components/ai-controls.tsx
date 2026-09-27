import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AiControls({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const sb = supabase as any;
  const { data } = useQuery({
    queryKey: ["ai-controls", tenantId],
    queryFn: async () => {
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
      const [{ data: t }, { data: runs }, { data: recs }, { count: monthRuns }] = await Promise.all([
        sb.from("tenants").select("ai_paused, ai_daily_run_limit, ai_monthly_run_budget").eq("id", tenantId).single(),
        sb.from("ai_runs").select("id, status, model, prompt_version, error, duration_ms, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
        sb.from("ai_recommendations").select("status, payload, lead_id, created_at, leads(status)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
        sb.from("ai_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart),
      ]);
      const counts: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => (counts[r.status] = (counts[r.status] ?? 0) + 1));
      // Outcome check: compare the latest suggestion per lead with what actually happened to that lead.
      const seen = new Set<string>();
      const o = { resolved: 0, correct: 0, openLeads: 0 };
      (recs ?? []).forEach((r: any) => {
        if (seen.has(r.lead_id)) return; seen.add(r.lead_id);
        const outcome = r.leads?.status; const q = r.payload?.qualification;
        if (outcome !== "converted" && outcome !== "disqualified") { o.openLeads++; return; }
        o.resolved++;
        if ((outcome === "converted" && q === "qualified") || (outcome === "disqualified" && q === "unqualified")) o.correct++;
      });
      return { tenant: t, runs: runs ?? [], counts, outcomes: o, monthRuns: monthRuns ?? 0 };
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const paused = !data?.tenant?.ai_paused;
      const { error } = await sb.from("tenants").update({ ai_paused: paused }).eq("id", tenantId);
      if (error) throw error;
      await supabase.from("audit_events").insert({ tenant_id: tenantId, action: paused ? "ai.emergency_stop" : "ai.resumed", entity_type: "tenant", entity_id: tenantId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-controls", tenantId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const paused = data?.tenant?.ai_paused;
  const c = (data?.counts ?? {}) as { pending?: number; accepted?: number; edited?: number; dismissed?: number };
  const decided = (c.accepted ?? 0) + (c.edited ?? 0) + (c.dismissed ?? 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">AI activity & emergency stop</CardTitle>
        <CardDescription>Every AI run is recorded. Limit: {data?.tenant?.ai_daily_run_limit ?? 200} runs per day. This month: {data?.monthRuns ?? 0} of {data?.tenant?.ai_monthly_run_budget ?? 3000} budgeted runs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={paused ? "destructive" : "default"}>{paused ? "Paused" : "Active"}</Badge>
          <Button variant={paused ? "default" : "destructive"} size="sm" onClick={() => toggle.mutate()} disabled={toggle.isPending || !data}>
            {paused ? "Resume AI" : "Emergency stop"}
          </Button>
          <span className="text-sm text-muted-foreground">
            Suggestions: {c.pending ?? 0} waiting · {c.accepted ?? 0} approved · {c.edited ?? 0} changed · {c.dismissed ?? 0} dismissed
            {decided > 0 && ` · ${Math.round((((c.accepted ?? 0) + (c.edited ?? 0)) / decided) * 100)}% useful`}
          </span>
        </div>
        <div className="rounded border p-3 text-sm">
          <p className="font-medium">Measured against real outcomes</p>
          {data?.outcomes.resolved ? (
            <p className="text-muted-foreground">
              Of {data.outcomes.resolved} leads that have since been converted or disqualified, the assistant's call was right for {data.outcomes.correct} ({Math.round((data.outcomes.correct / data.outcomes.resolved) * 100)}%). {data.outcomes.openLeads} analyzed leads are still open.
            </p>
          ) : (
            <p className="text-muted-foreground">No analyzed lead has been converted or disqualified yet. This fills in as leads close ({data?.outcomes.openLeads ?? 0} analyzed leads still open).</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">"Right" means it said qualified and the lead converted, or unqualified and the lead was disqualified. "Needs info" counts as not right.</p>
        </div>
        <div className="max-h-72 overflow-auto rounded border text-xs">
          {data?.runs.length === 0 && <p className="p-3 text-muted-foreground">No AI runs yet.</p>}
          {data?.runs.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 border-b p-2 last:border-0">
              <Badge variant={r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge>
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span className="text-muted-foreground">{r.model} · {r.prompt_version}{r.duration_ms ? ` · ${(r.duration_ms / 1000).toFixed(1)}s` : ""}</span>
              {r.error && <span className="truncate text-destructive">{r.error}</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
