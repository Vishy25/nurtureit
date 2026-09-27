import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  head: () => ({
    meta: [
      { title: "Automations — SalesOS" },
      { name: "description", content: "Trigger-condition-action rules with run history and loop prevention." },
      { property: "og:title", content: "Automations — SalesOS" },
      { property: "og:description", content: "When something happens, automatically create tasks or alert managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationsPage,
});

const TRIGGERS = [
  { id: "lead.created", label: "A new lead arrives" },
  { id: "opportunity.stage_changed", label: "A deal moves stage" },
  { id: "opportunity.lost", label: "A deal is lost" },
];
const ACTIONS = [
  { id: "create_task", label: "Create a follow-up task" },
  { id: "notify_managers", label: "Alert admins & managers" },
];
const STAGES = ["qualification", "discovery", "shortlist", "site_visit", "negotiation", "closing", "closed_won"];

function AutomationsPage() {
  const { currentTenant, role } = useTenant();
  const tenantId = currentTenant?.tenantId;
  const canEdit = role === "tenant_admin" || role === "sales_manager";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("lead.created");
  const [action, setAction] = useState("create_task");
  const [source, setSource] = useState("");
  const [minScore, setMinScore] = useState("");
  const [toStage, setToStage] = useState("any");
  const [title, setTitle] = useState("");
  const [dueDays, setDueDays] = useState("1");

  const data = useQuery({
    queryKey: ["automations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [rules, runs] = await Promise.all([
        supabase.from("automation_rules").select("*").eq("tenant_id", tenantId!).order("created_at"),
        supabase.from("automation_runs").select("*, automation_rules(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(50),
      ]);
      if (rules.error) throw rules.error;
      return { rules: rules.data ?? [], runs: runs.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["automations", tenantId] });

  async function create() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const condition: Record<string, unknown> = {};
    if (trigger === "lead.created" && source.trim()) condition["source"] = source.trim();
    if (trigger === "lead.created" && minScore) condition["min_score"] = Number(minScore);
    if (trigger === "opportunity.stage_changed" && toStage !== "any") condition["to_stage"] = toStage;
    const action_config = action === "create_task" ? { title: title.trim() || name.trim(), due_days: Number(dueDays || 1) } : {};
    const { error } = await supabase.from("automation_rules").insert({ tenant_id: tenantId!, name: name.trim(), trigger_event: trigger, condition: condition as never, action, action_config: action_config as never });
    if (error) { toast.error(error.message); return; }
    toast.success("Automation created");
    setName(""); setSource(""); setMinScore(""); setTitle("");
    refresh();
  }
  async function toggle(id: string, enabled: boolean) {
    const { error } = await supabase.from("automation_rules").update({ enabled }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("automation_rules").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }

  const label = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {canEdit && (
        <Card>
          <CardHeader><CardTitle>New automation</CardTitle><CardDescription>Each rule runs once per event and never triggers other automations.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Call hot website leads" /></div>
            <div><Label>When</Label>
              <Select value={trigger} onValueChange={setTrigger}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            {trigger === "lead.created" && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Only if source is</Label><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="any" /></div>
                <div><Label>Only if score ≥</Label><Input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="any" /></div>
              </div>
            )}
            {trigger === "opportunity.stage_changed" && (
              <div><Label>Only when moved to</Label>
                <Select value={toStage} onValueChange={setToStage}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="any">Any stage</SelectItem>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
            )}
            <div><Label>Then</Label>
              <Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select></div>
            {action === "create_task" && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Task title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call within 24h" /></div>
                <div><Label>Due in (days)</Label><Input type="number" min={0} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></div>
              </div>
            )}
            <Button onClick={create}>Create automation</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.data?.rules.length ? data.data.rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{label(TRIGGERS, r.trigger_event)} → {label(ACTIONS, r.action)}{Object.keys(r.condition as object).length ? ` · if ${JSON.stringify(r.condition)}` : ""}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r.id, v)} aria-label="Enabled" />
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
                </div>
              )}
            </div>
          )) : <p className="text-sm text-muted-foreground">No automations yet.</p>}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Run history</CardTitle><CardDescription>Latest 50 runs.</CardDescription></CardHeader>
        <CardContent>
          {data.data?.runs.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th>When</th><th>Rule</th><th>Event</th><th>Status</th><th>Detail</th></tr></thead>
              <tbody>{data.data.runs.map((r) => (
                <tr key={r.id} className="border-t"><td>{new Date(r.created_at).toLocaleString()}</td><td>{(r as { automation_rules?: { name: string } | null }).automation_rules?.name ?? "—"}</td><td>{r.event_key}</td>
                  <td><Badge variant={r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge></td><td className="text-xs text-muted-foreground">{r.detail ?? ""}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">No runs yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
