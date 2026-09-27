import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { retryUncertainRuns } from "@/lib/ai-assistant.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Links each AI suggestion to what actually happened: decision, lead status, deal stage moves, loss reason, revenue, corrections. */
export function AiOutcomes({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const retry = useServerFn(retryUncertainRuns);
  const { data: rows = [] } = useQuery({
    queryKey: ["ai-outcomes", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ai_recommendation_outcomes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: uncertain = 0 } = useQuery({
    queryKey: ["ai-uncertain", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("ai_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["uncertain", "running"]);
      return count ?? 0;
    },
  });
  const m = useMutation({
    mutationFn: () => retry({ data: { tenantId } }),
    onSuccess: (r) => { toast.success(`Checked ${r.checked}: ${r.resumed} resumed, ${r.retried} retried, ${r.failed} failed`); qc.invalidateQueries({ queryKey: ["ai-uncertain", tenantId] }); qc.invalidateQueries({ queryKey: ["ai-outcomes", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const won = rows.filter((r) => r.opp_state === "won");
  const revenue = won.reduce((s, r) => s + Number(r.opp_value ?? 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="font-display text-lg">Suggestion outcomes</CardTitle>
          <CardDescription>What happened after each suggestion, tied to the prompt version and model that produced it.</CardDescription>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Retrying…" : `Retry interrupted runs (${uncertain})`}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{rows.length} suggestions</Badge>
          <Badge variant="secondary">{rows.filter((r) => r.decision === "accepted" || r.decision === "edited").length} acted on</Badge>
          <Badge variant="secondary">{won.length} won · {revenue.toLocaleString()} revenue</Badge>
          <Badge variant="secondary">{rows.filter((r) => r.opp_state === "lost").length} lost</Badge>
          <Badge variant="secondary">{rows.reduce((s, r) => s + Number(r.score_corrections ?? 0), 0)} score corrections</Badge>
        </div>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No suggestions yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Lead</th><th className="pr-3">Suggested</th><th className="pr-3">Decision</th><th className="pr-3">Lead now</th><th className="pr-3">Deal</th><th className="pr-3">Version</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.recommendation_id} className="border-t border-border">
                    <td className="py-1 pr-3">{r.lead_name ?? "—"}</td>
                    <td className="pr-3">{r.recommended ?? "—"}</td>
                    <td className="pr-3">{r.decision}</td>
                    <td className="pr-3">{r.lead_status ?? "—"}</td>
                    <td className="pr-3">{r.opportunity_id ? `${r.opp_state} · ${r.opp_stage} · ${r.stage_moves} moves${r.opp_value ? ` · ${Number(r.opp_value).toLocaleString()} ${r.currency}` : ""}${r.lost_reason ? ` · lost: ${r.lost_reason}` : ""}` : "—"}</td>
                    <td className="pr-3 text-muted-foreground">{r.prompt_version} · {r.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
