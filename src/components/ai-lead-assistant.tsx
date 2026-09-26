import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeLead } from "@/lib/ai-assistant.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Rec = {
  summary: string;
  qualification: "qualified" | "needs_info" | "unqualified";
  confidence: number;
  missing_info: string[];
  next_action: { kind: string; title: string; due_in_days: number; rationale: string };
  draft_message: string | null;
};

export function AiLeadAssistant({ leadId, tenantId, canAct }: { leadId: string; tenantId: string; canAct: boolean }) {
  const qc = useQueryClient();
  const run = useServerFn(analyzeLead);
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const { data: rec } = useQuery({
    queryKey: ["ai-rec", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_recommendations").select("id, status, payload, feedback, created_at, run_id, ai_runs(model, prompt_version)")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as null | { id: string; status: string; payload: Rec; feedback: string | null; created_at: string; ai_runs: { model: string; prompt_version: string } | null };
    },
  });

  const analyze = useMutation({
    mutationFn: () => run({ data: { leadId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-rec", leadId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (action: "accept" | "dismiss") => {
      if (!rec) return;
      const p = rec.payload;
      let task_id: string | null = null;
      const edited = editTitle !== null && editTitle.trim() !== p.next_action.title;
      if (action === "accept") {
        const due = new Date(Date.now() + p.next_action.due_in_days * 86400000).toISOString();
        const { data: u } = await supabase.auth.getUser();
        const { data: t, error } = await supabase.from("tasks").insert({
          tenant_id: tenantId, lead_id: leadId, title: edited ? editTitle!.trim() : p.next_action.title,
          kind: p.next_action.kind, due_at: due, assignee_id: u.user?.id ?? null, notes: `Suggested by AI: ${p.next_action.rationale}`,
        }).select("id").single();
        if (error) throw error;
        task_id = t.id;
      }
      const { error } = await (supabase as any).from("ai_recommendations").update({
        status: action === "dismiss" ? "dismissed" : edited ? "edited" : "accepted",
        feedback: feedback.trim() || (edited ? `Changed action to: ${editTitle}` : null),
        task_id, decided_by: (await supabase.auth.getUser()).data.user?.id, decided_at: new Date().toISOString(),
      }).eq("id", rec.id);
      if (error) throw error;
      await supabase.from("audit_events").insert({ tenant_id: tenantId, action: `ai.recommendation_${action}`, entity_type: "lead", entity_id: leadId, metadata: { recommendation_id: rec.id, task_id } });
    },
    onSuccess: (_d, action) => {
      toast.success(action === "accept" ? "Task created" : "Suggestion dismissed");
      setEditTitle(null); setFeedback("");
      qc.invalidateQueries({ queryKey: ["ai-rec", leadId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = rec?.payload;
  const qualTone = p?.qualification === "qualified" ? "default" : p?.qualification === "unqualified" ? "destructive" : "secondary";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI assistant</h3>
        {canAct && (
          <Button size="sm" variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? "Analyzing…" : rec ? "Re-analyze" : "Analyze lead"}
          </Button>
        )}
      </div>
      {!p && !analyze.isPending && <p className="text-xs text-muted-foreground">Get a qualification summary and a suggested next step. Nothing happens until you approve it.</p>}
      {p && rec && (
        <div className="space-y-3 rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={qualTone}>{p.qualification.replace("_", " ")}</Badge>
            <span className="text-xs text-muted-foreground">Confidence {Math.round(p.confidence * 100)}%</span>
            <Badge variant="outline" className="ml-auto capitalize">{rec.status}</Badge>
          </div>
          <p>{p.summary}</p>
          {p.missing_info.length > 0 && (
            <div><p className="text-xs font-medium">Missing information</p><ul className="ml-4 list-disc text-xs text-muted-foreground">{p.missing_info.map((m) => <li key={m}>{m}</li>)}</ul></div>
          )}
          <div className="rounded bg-muted p-2">
            <p className="text-xs font-medium">Suggested next step · {p.next_action.kind.replace("_", " ")} in {p.next_action.due_in_days} day(s)</p>
            {rec.status === "pending" && canAct
              ? <Input className="mt-1" value={editTitle ?? p.next_action.title} onChange={(e) => setEditTitle(e.target.value)} />
              : <p>{p.next_action.title}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{p.next_action.rationale}</p>
          </div>
          {p.draft_message && (
            <div><p className="text-xs font-medium">Draft message</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{p.draft_message}</p></div>
          )}
          {rec.status === "pending" && canAct && (
            <>
              <Textarea placeholder="Optional feedback — helps future suggestions" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide.mutate("accept")} disabled={decide.isPending}>Approve & create task</Button>
                <Button size="sm" variant="ghost" onClick={() => decide.mutate("dismiss")} disabled={decide.isPending}>Dismiss</Button>
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">{rec.ai_runs?.model} · {rec.ai_runs?.prompt_version} · {new Date(rec.created_at).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
