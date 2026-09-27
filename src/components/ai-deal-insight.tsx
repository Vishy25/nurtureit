import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDeal } from "@/lib/ai-insights.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Result = Awaited<ReturnType<typeof analyzeDeal>>;

export function AiDealInsight({ deal, tenantId, canEdit }: { deal: { id: string; name: string; contact_id: string | null }; tenantId: string; canEdit: boolean }) {
  const run = useServerFn(analyzeDeal);
  const [res, setRes] = useState<Result | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const analyze = useMutation({
    mutationFn: () => run({ data: { dealId: deal.id } }),
    onSuccess: (r) => { setRes(r); setAdded(new Set()); },
    onError: (e: Error) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: async (i: number) => {
      const s = res!.output.recovery_steps[i]!;
      const uid = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase.from("tasks").insert({
        tenant_id: tenantId, title: s.title, kind: s.kind, status: "open", opportunity_id: deal.id, contact_id: deal.contact_id,
        due_at: new Date(Date.now() + s.due_in_days * 86400000).toISOString(), assignee_id: uid ?? null, created_by: uid!,
        notes: `Approved from deal-health suggestion (run ${res!.runId})`,
      });
      if (error) throw error;
      return i;
    },
    onSuccess: (i) => { setAdded((p) => new Set(p).add(i)); toast.success("Task created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">AI deal review</p>
        <Button size="sm" variant="outline" disabled={analyze.isPending} onClick={() => analyze.mutate()}>
          <Sparkles className="mr-1 h-4 w-4" />{analyze.isPending ? "Reviewing…" : res ? "Review again" : "Review deal"}
        </Button>
      </div>
      {!res && <p className="mt-1 text-xs text-muted-foreground">Suggestions only — nothing changes until you approve a step.</p>}
      {res && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={res.output.risk === "high" ? "destructive" : res.output.risk === "medium" ? "outline" : "secondary"}>Risk: {res.output.risk}</Badge>
          </div>
          <p>{res.output.summary}</p>
          {res.output.risk_factors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {res.output.risk_factors.map((f, i) => (
                <li key={i}>{f.text}{" "}
                  {f.evidence.map((e) => <span key={e} title={res.evidence[e]} className="ml-1 cursor-help rounded bg-muted px-1 text-xs text-muted-foreground">{e}</span>)}
                  {f.evidence.length === 0 && <span className="ml-1 text-xs text-muted-foreground">(no source cited)</span>}
                </li>
              ))}
            </ul>
          )}
          {res.output.recovery_steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Suggested steps</p>
              {res.output.recovery_steps.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded bg-muted p-2">
                  <span>{s.title} <span className="text-xs text-muted-foreground">· in {s.due_in_days}d</span></span>
                  {canEdit && <Button size="sm" variant="secondary" disabled={added.has(i) || approve.isPending} onClick={() => approve.mutate(i)}>{added.has(i) ? "Added" : "Create task"}</Button>}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Hover a source tag to see the record it cites.</p>
        </div>
      )}
    </div>
  );
}
