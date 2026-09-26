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
      const [{ data: t }, { data: runs }, { data: recs }] = await Promise.all([
        sb.from("tenants").select("ai_paused, ai_daily_run_limit").eq("id", tenantId).single(),
        sb.from("ai_runs").select("id, status, model, prompt_version, error, duration_ms, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
        sb.from("ai_recommendations").select("status").eq("tenant_id", tenantId),
      ]);
      const counts: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => (counts[r.status] = (counts[r.status] ?? 0) + 1));
      return { tenant: t, runs: runs ?? [], counts };
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
        <CardDescription>Every AI run is recorded. Limit: {data?.tenant?.ai_daily_run_limit ?? 200} runs per day.</CardDescription>
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
