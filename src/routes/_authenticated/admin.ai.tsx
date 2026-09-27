import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { AGENTS, RELEASE_STAGES, MEMORY_KINDS, EVAL_PASS_THRESHOLD, type ReleaseStage } from "@/lib/ai-registry";
import { runEvaluation } from "@/lib/ai-assistant.functions";
import { AiControls } from "@/components/ai-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  head: () => ({
    meta: [
      { title: "AI assistant — SalesOS" },
      { name: "description", content: "AI agent registry, evaluations, release stages and workspace memory." },
      { property: "og:title", content: "AI assistant — SalesOS" },
      { property: "og:description", content: "Govern AI agents: evaluate, approve, release and manage memory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiAdminPage,
});

function AiAdminPage() {
  const { currentTenant, role } = useTenant();
  if (!currentTenant) return null;
  const isAdmin = role === "tenant_admin";
  if (!isAdmin && role !== "sales_manager") return <p className="text-sm text-muted-foreground">Only admins and managers can view AI governance.</p>;
  return (
    <div className="space-y-4">
      <Registry tenantId={currentTenant.tenantId} isAdmin={isAdmin} isDemo={currentTenant.isDemo} />
      <Evaluations tenantId={currentTenant.tenantId} isAdmin={isAdmin} />
      <Memory tenantId={currentTenant.tenantId} />
      {isAdmin && <AiControls tenantId={currentTenant.tenantId} />}
    </div>
  );
}

function Registry({ tenantId, isAdmin, isDemo }: { tenantId: string; isAdmin: boolean; isDemo: boolean }) {
  const qc = useQueryClient();
  const sb = supabase as any;
  const { data: settings = [] } = useQuery({
    queryKey: ["ai-agent-settings", tenantId],
    queryFn: async () => (await sb.from("ai_agent_settings").select("agent, enabled, release_stage, prompt_version").eq("tenant_id", tenantId)).data ?? [],
  });
  const save = useMutation({
    mutationFn: async (p: { agent: string; prompt_version: string; release_stage?: ReleaseStage; enabled?: boolean }) => {
      const cur = settings.find((s: any) => s.agent === p.agent);
      const row = { tenant_id: tenantId, agent: p.agent, prompt_version: p.prompt_version, release_stage: p.release_stage ?? cur?.release_stage ?? "shadow", enabled: p.enabled ?? cur?.enabled ?? true };
      const { error } = await sb.from("ai_agent_settings").upsert(row, { onConflict: "tenant_id,agent" });
      if (error) throw error;
      await supabase.from("audit_events").insert({ tenant_id: tenantId, action: "ai.agent_settings_changed", entity_type: "tenant", entity_id: tenantId, metadata: row });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["ai-agent-settings", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Agent registry</CardTitle>
        <CardDescription>Each assistant starts in Testing. Run an evaluation, review it, and approve it before releasing to real leads.{isDemo && " Sample-data workspaces can use assistants while in Testing."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {AGENTS.map((a) => {
          const s = settings.find((x: any) => x.agent === a.id);
          const stage: ReleaseStage = s && s.prompt_version === a.promptVersion ? s.release_stage : "shadow";
          const planned = a.availability === "planned";
          return (
            <div key={a.id} className="space-y-2 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <Badge variant="outline">{a.promptVersion}</Badge>
                {planned ? <Badge variant="secondary">Planned</Badge> : <Badge>{RELEASE_STAGES.find((r) => r.id === stage)!.label}</Badge>}
                {s && !s.enabled && <Badge variant="destructive">Disabled</Badge>}
              </div>
              <p className="text-muted-foreground">{a.objective}</p>
              <div className="grid gap-2 text-xs md:grid-cols-3">
                <div><p className="font-medium">May do</p><ul className="ml-4 list-disc">{a.allowedActions.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><p className="font-medium">Needs a person to approve</p><ul className="ml-4 list-disc">{a.requiresApproval.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><p className="font-medium">Can see</p><p>{a.readScope}</p><p className="mt-1 text-muted-foreground">{a.model}</p></div>
              </div>
              {isAdmin && !planned && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={stage} onValueChange={(v) => save.mutate({ agent: a.id, prompt_version: a.promptVersion, release_stage: v as ReleaseStage })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{RELEASE_STAGES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => save.mutate({ agent: a.id, prompt_version: a.promptVersion, enabled: !(s?.enabled ?? true) })}>
                    {(s?.enabled ?? true) ? "Disable" : "Enable"}
                  </Button>
                  <span className="text-xs text-muted-foreground">{RELEASE_STAGES.find((r) => r.id === stage)!.description}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

type EvalResult = { lead_id: string; lead_name: string; output?: any; error?: string; baseline: string; agrees_with_rules?: boolean; rating: "good" | "bad" | null };

function Evaluations({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const sb = supabase as any;
  const run = useServerFn(runEvaluation);
  const [open, setOpen] = useState<string | null>(null);
  const key = ["ai-evals", tenantId];
  const { data: evals = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await sb.from("ai_evaluations").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  const start = useMutation({
    mutationFn: () => run({ data: { tenantId, sampleSize: 5 } }),
    onSuccess: (r) => { toast.success("Evaluation ready for review"); setOpen(r.evaluationId); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async (p: { id: string; results?: EvalResult[]; status?: string; pass_rate?: number }) => {
      const patch: any = {};
      if (p.results) patch.results = p.results;
      if (p.status) { patch.status = p.status; patch.reviewed_at = new Date().toISOString(); patch.reviewed_by = (await supabase.auth.getUser()).data.user?.id; patch.pass_rate = p.pass_rate; }
      const { error } = await sb.from("ai_evaluations").update(patch).eq("id", p.id);
      if (error) throw error;
      if (p.status) await supabase.from("audit_events").insert({ tenant_id: tenantId, action: `ai.evaluation_${p.status}`, entity_type: "tenant", entity_id: tenantId, metadata: { evaluation_id: p.id, pass_rate: p.pass_rate } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="font-display text-lg">Evaluations</CardTitle>
          <CardDescription>Runs the assistant on your 5 newest leads in the background. Nothing is created and nobody is notified. Rate each answer; at least {Math.round(EVAL_PASS_THRESHOLD * 100)}% must be good to approve.</CardDescription>
        </div>
        {isAdmin && <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? "Running… (up to a minute)" : "Run evaluation"}</Button>}
      </CardHeader>
      <CardContent className="space-y-2">
        {evals.length === 0 && <p className="text-sm text-muted-foreground">No evaluations yet.</p>}
        {evals.map((ev: any) => {
          const results: EvalResult[] = ev.results ?? [];
          const rated = results.filter((r) => r.rating);
          const good = results.filter((r) => r.rating === "good").length;
          const rate = results.length ? good / results.length : 0;
          const agree = results.filter((r) => r.agrees_with_rules).length;
          const expanded = open === ev.id;
          return (
            <div key={ev.id} className="rounded-md border p-3 text-sm">
              <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(expanded ? null : ev.id)}>
                <Badge variant={ev.status === "approved" ? "default" : ev.status === "rejected" ? "destructive" : "secondary"}>{ev.status.replace("_", " ")}</Badge>
                <span>{ev.prompt_version}</span>
                <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
                <span className="ml-auto text-xs text-muted-foreground">{rated.length}/{results.length} rated · {good} good · agrees with rules {agree}/{results.length}</span>
              </button>
              {expanded && (
                <div className="mt-3 space-y-2">
                  {results.map((r, i) => (
                    <div key={r.lead_id + i} className="rounded bg-muted p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.lead_name}</span>
                        {r.output && <Badge variant="outline">AI: {r.output.qualification}</Badge>}
                        <Badge variant="outline">Rules: {r.baseline}</Badge>
                        {isAdmin && ev.status === "pending_review" && r.output && (
                          <span className="ml-auto flex gap-1">
                            {(["good", "bad"] as const).map((g) => (
                              <Button key={g} size="sm" variant={r.rating === g ? "default" : "outline"} className="h-6 px-2 text-xs"
                                onClick={() => update.mutate({ id: ev.id, results: results.map((x, j) => (j === i ? { ...x, rating: g } : x)) })}>
                                {g === "good" ? "Good" : "Bad"}
                              </Button>
                            ))}
                          </span>
                        )}
                        {ev.status !== "pending_review" && r.rating && <Badge variant="secondary" className="ml-auto">{r.rating}</Badge>}
                      </div>
                      {r.error ? <p className="text-destructive">{r.error}</p> : (
                        <>
                          <p className="mt-1">{r.output.summary}</p>
                          <p className="mt-1"><span className="font-medium">Next step:</span> {r.output.next_action.title}</p>
                        </>
                      )}
                    </div>
                  ))}
                  {isAdmin && ev.status === "pending_review" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" disabled={rated.length < results.length || rate < EVAL_PASS_THRESHOLD || update.isPending}
                        onClick={() => update.mutate({ id: ev.id, status: "approved", pass_rate: rate })}>Approve for release</Button>
                      <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: ev.id, status: "rejected", pass_rate: rate })}>Reject</Button>
                      <span className="text-xs text-muted-foreground">
                        {rated.length < results.length ? "Rate every answer first." : rate < EVAL_PASS_THRESHOLD ? `Only ${Math.round(rate * 100)}% good — below the release bar.` : `${Math.round(rate * 100)}% good.`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Memory({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const sb = supabase as any;
  const [kind, setKind] = useState("approved_knowledge");
  const [content, setContent] = useState("");
  const [expires, setExpires] = useState("");
  const [filter, setFilter] = useState("all");
  const key = ["ai-memory", tenantId];
  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await sb.from("ai_memory").select("id, kind, content, lead_id, source, confidence, expires_at, created_at, leads(full_name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("ai_memory").insert({ tenant_id: tenantId, kind, content: content.trim(), expires_at: expires ? new Date(expires).toISOString() : null });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); setExpires(""); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const edit = useMutation({
    mutationFn: async (p: { id: string; content?: string; delete?: boolean }) => {
      const q = sb.from("ai_memory");
      const { error } = p.delete ? await q.delete().eq("id", p.id) : await q.update({ content: p.content }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const shown = items.filter((m: any) => filter === "all" || m.kind === filter);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Workspace memory</CardTitle>
        <CardDescription>What the assistant knows about this workspace. It never sees another workspace's memory. Inspect, correct or delete anything.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{MEMORY_KINDS.filter((k) => k.id !== "hypothesis").map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="min-w-64 flex-1" placeholder="e.g. We never offer discounts above 5%" value={content} onChange={(e) => setContent(e.target.value)} />
          <Input type="date" className="w-40" value={expires} onChange={(e) => setExpires(e.target.value)} title="Expires (optional)" />
          <Button onClick={() => add.mutate()} disabled={!content.trim() || add.isPending}>Add</Button>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All kinds</SelectItem>{MEMORY_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="max-h-96 divide-y overflow-auto rounded border text-sm">
          {shown.length === 0 && <p className="p-3 text-muted-foreground">Nothing stored yet.</p>}
          {shown.map((m: any) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 p-2">
              <Badge variant="outline">{MEMORY_KINDS.find((k) => k.id === m.kind)?.label}</Badge>
              <span className="min-w-48 flex-1">{m.content}</span>
              <span className="text-xs text-muted-foreground">
                {m.leads?.full_name ? `Lead: ${m.leads.full_name} · ` : ""}{m.source} · {Math.round(m.confidence * 100)}%{m.expires_at ? ` · expires ${new Date(m.expires_at).toLocaleDateString()}` : ""}
              </span>
              <Button size="sm" variant="ghost" onClick={() => { const v = window.prompt("Correct this memory", m.content); if (v?.trim()) edit.mutate({ id: m.id, content: v.trim() }); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => edit.mutate({ id: m.id, delete: true })}>Delete</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
