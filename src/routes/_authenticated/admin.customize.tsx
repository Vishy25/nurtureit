import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useWorkspaceConfig } from "@/lib/workspace-config";
import { getTemplate } from "@/lib/industry-templates";
import { ConfigVersions } from "@/components/config-versions";
import { DEFAULT_SCORING, scoreLead, type ScoringConfig } from "@/lib/scoring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/customize")({
  head: () => ({
    meta: [
      { title: "Customize workspace — SalesOS" },
      { name: "description", content: "Configure pipeline stage names, lead scoring rules and custom lead fields." },
      { property: "og:title", content: "Customize workspace — SalesOS" },
      { property: "og:description", content: "Stage names, scoring rules and custom fields per workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomizePage,
});

const WEIGHT_LABELS: Record<keyof ScoringConfig["weights"], string> = {
  name: "Full name", email: "Email", phone: "Phone", detail: "Enquiry detail", budget: "Budget", timeline: "Timeline", source: "Source fit",
};

function CustomizePage() {
  const { currentTenant, role } = useTenant();
  if (!currentTenant) return null;
  if (role !== "tenant_admin") return <p className="text-sm text-muted-foreground">Only workspace administrators can customize the workspace.</p>;
  return (
    <div className="space-y-4">
      <StageLabels tenantId={currentTenant.tenantId} industry={currentTenant.industry} />
      <Scoring tenantId={currentTenant.tenantId} industry={currentTenant.industry} />
      <CustomFields tenantId={currentTenant.tenantId} industry={currentTenant.industry} />
      <CustomFields tenantId={currentTenant.tenantId} industry={currentTenant.industry} entity="contact" />
      <ConfigVersions tenantId={currentTenant.tenantId} industry={currentTenant.industry} />
    </div>
  );
}

function useSaveTenant(tenantId: string, what: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await (supabase as any).from("tenants").update(patch).eq("id", tenantId);
      if (error) throw error;
      await supabase.from("audit_events").insert({ tenant_id: tenantId, action: `tenant.${what}_changed`, entity_type: "tenant", entity_id: tenantId, metadata: patch as any });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["workspace-config", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function StageLabels({ tenantId, industry }: { tenantId: string; industry: string }) {
  const { data } = useWorkspaceConfig(tenantId, industry);
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => { if (data) setLabels(data.stageLabels); }, [data]);
  const save = useSaveTenant(tenantId, "stage_labels");
  const tpl = getTemplate(industry);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Pipeline stage names</CardTitle>
        <CardDescription>Rename the seven pipeline stages for this workspace. Deals keep their place — only the names change. Starts from the {tpl.label} template.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {labels.map((l, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stage {i + 1}{i === 6 ? " (won)" : ""}</Label>
              <Input value={l} maxLength={40} onChange={(e) => setLabels(labels.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button disabled={save.isPending || labels.some((l) => !l.trim())} onClick={() => save.mutate({ stage_labels: labels.map((l) => l.trim()) })}>Save stage names</Button>
          <Button variant="outline" onClick={() => save.mutate({ stage_labels: null })}>Reset to template</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Scoring({ tenantId, industry }: { tenantId: string; industry: string }) {
  const { data } = useWorkspaceConfig(tenantId, industry);
  const [cfg, setCfg] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [newSource, setNewSource] = useState("");
  useEffect(() => { if (data) setCfg(data.scoring); }, [data]);
  const save = useSaveTenant(tenantId, "scoring");
  const sample = scoreLead({ full_name: "Sample Buyer", email: "a@b.com", phone: "123456", source: "website", message: "Looking for a 3 bedroom home within the next month, budget ready." }, cfg);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Lead scoring rules</CardTitle>
        <CardDescription>How many points each factor is worth. Scores are scaled to 0–100. Used for new leads, incoming leads and “Recalculate score”.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {(Object.keys(WEIGHT_LABELS) as (keyof ScoringConfig["weights"])[]).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{WEIGHT_LABELS[k]}</Label>
              <Input type="number" min={0} max={100} value={cfg.weights[k]} onChange={(e) => setCfg({ ...cfg, weights: { ...cfg.weights, [k]: Math.max(0, Number(e.target.value) || 0) } })} />
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">“Hot” from score</Label><Input type="number" value={cfg.hot} onChange={(e) => setCfg({ ...cfg, hot: Number(e.target.value) || 0 })} /></div>
          <div className="space-y-1"><Label className="text-xs">“Warm” from score</Label><Input type="number" value={cfg.warm} onChange={(e) => setCfg({ ...cfg, warm: Number(e.target.value) || 0 })} /></div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Source quality (0–25)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(cfg.sources).map(([s, v]) => (
              <div key={s} className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
                <span>{s}</span>
                <Input type="number" className="h-7 w-16" min={0} max={25} value={v} onChange={(e) => setCfg({ ...cfg, sources: { ...cfg.sources, [s]: Math.max(0, Math.min(25, Number(e.target.value) || 0)) } })} />
              </div>
            ))}
            <Input className="h-8 w-36" placeholder="Add source" value={newSource} onChange={(e) => setNewSource(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!newSource.trim()} onClick={() => { setCfg({ ...cfg, sources: { ...cfg.sources, [newSource.trim().toLowerCase()]: 12 } }); setNewSource(""); }}>Add</Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Example: a complete website enquiry scores <Badge variant="outline">{sample.total} · {sample.category}</Badge></div>
        <div className="flex gap-2">
          <Button disabled={save.isPending || cfg.warm >= cfg.hot} onClick={() => save.mutate({ scoring_config: cfg })}>Save scoring rules</Button>
          <Button variant="outline" onClick={() => save.mutate({ scoring_config: null })}>Reset to default</Button>
          {cfg.warm >= cfg.hot && <span className="text-xs text-destructive">“Warm” must be below “Hot”.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomFields({ tenantId, industry, entity = "lead" }: { tenantId: string; industry: string; entity?: "lead" | "contact" }) {
  const qc = useQueryClient();
  const { data } = useWorkspaceConfig(tenantId, industry);
  const fields = (entity === "lead" ? data?.fields : data?.contactFields) ?? [];
  const [f, setF] = useState({ label: "", field_type: "text", options: "", required: false });
  const add = useMutation({
    mutationFn: async () => {
      const key = f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1").slice(0, 40);
      if (!key) throw new Error("Enter a label");
      const options = f.field_type === "select" ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : [];
      if (f.field_type === "select" && options.length < 2) throw new Error("Add at least two options, separated by commas");
      const { error } = await (supabase as any).from("custom_field_defs").insert({ tenant_id: tenantId, entity, field_key: key, label: f.label.trim(), field_type: f.field_type, options, required: f.required, position: fields.length });
      if (error) throw new Error(error.code === "23505" ? "A field with that name already exists" : error.message);
    },
    onSuccess: () => { setF({ label: "", field_type: "text", options: "", required: false }); qc.invalidateQueries({ queryKey: ["workspace-config", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("custom_field_defs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-config", tenantId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Custom {entity} fields</CardTitle>
        <CardDescription>{entity === "lead" ? "Extra fields shown on the new-lead form and in each lead's panel." : "Extra fields shown on the new-contact form and in each contact's panel."} Removing a field hides it; values already saved are kept.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y rounded border text-sm">
          {fields.length === 0 && <p className="p-3 text-muted-foreground">No custom fields yet.</p>}
          {fields.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2 p-2">
              <span className="font-medium">{x.label}</span>
              <Badge variant="outline">{x.field_type}</Badge>
              {x.required && <Badge variant="secondary">required</Badge>}
              {x.options.length > 0 && <span className="text-xs text-muted-foreground">{x.options.join(", ")}</span>}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove.mutate(x.id)}>Remove</Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Budget range" /></div>
          <div className="space-y-1"><Label className="text-xs">Type</Label>
            <Select value={f.field_type} onValueChange={(v) => setF({ ...f, field_type: v })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{["text", "number", "date", "select", "boolean"].map((t) => <SelectItem key={t} value={t}>{t === "boolean" ? "yes / no" : t === "select" ? "choice list" : t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {f.field_type === "select" && <div className="space-y-1"><Label className="text-xs">Options (comma separated)</Label><Input value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></div>}
          <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Required</label>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !f.label.trim()}>Add field</Button>
        </div>
      </CardContent>
    </Card>
  );
}
