import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Version = { id: string; version: number; label: string; industry: string | null; stage_labels: string[] | null; scoring_config: unknown; custom_fields: { field_key: string; entity: string }[]; created_at: string };

// Snapshots of stage names, scoring and custom fields. Stages are fixed positions,
// so restoring a version only renames them — deals always stay in the same stage.
export function ConfigVersions({ tenantId, industry }: { tenantId: string; industry: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const key = ["config-versions", tenantId];
  const { data: versions = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("config_versions").select("*").eq("tenant_id", tenantId).order("version", { ascending: false }).limit(50);
      if (error) throw error;
      return data as Version[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const [{ data: t, error: e1 }, { data: fields, error: e2 }] = await Promise.all([
        (supabase as any).from("tenants").select("stage_labels, scoring_config").eq("id", tenantId).single(),
        (supabase as any).from("custom_field_defs").select("entity, field_key, label, field_type, options, required, position").eq("tenant_id", tenantId),
      ]);
      if (e1 || e2) throw e1 ?? e2;
      const next = (versions[0]?.version ?? 0) + 1;
      const { error } = await (supabase as any).from("config_versions").insert({
        tenant_id: tenantId, version: next, label: label.trim() || `Version ${next}`, industry,
        stage_labels: t.stage_labels, scoring_config: t.scoring_config, custom_fields: fields ?? [],
      });
      if (error) throw error;
    },
    onSuccess: () => { setLabel(""); toast.success("Version saved"); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: async (v: Version) => {
      const { error } = await (supabase as any).from("tenants").update({ stage_labels: v.stage_labels, scoring_config: v.scoring_config }).eq("id", tenantId);
      if (error) throw error;
      // Re-add custom fields missing today; existing fields and saved values are never deleted.
      const { data: current } = await (supabase as any).from("custom_field_defs").select("entity, field_key").eq("tenant_id", tenantId);
      const have = new Set((current ?? []).map((f: { entity: string; field_key: string }) => `${f.entity}:${f.field_key}`));
      const missing = (v.custom_fields ?? []).filter((f) => !have.has(`${f.entity}:${f.field_key}`)).map((f) => ({ ...f, tenant_id: tenantId }));
      if (missing.length) {
        const { error: e2 } = await (supabase as any).from("custom_field_defs").insert(missing);
        if (e2) throw e2;
      }
      await supabase.from("audit_events").insert({ tenant_id: tenantId, action: "tenant.config_restored", entity_type: "tenant", entity_id: tenantId, metadata: { version: v.version } as any });
    },
    onSuccess: () => { toast.success("Version restored"); void qc.invalidateQueries({ queryKey: ["workspace-config", tenantId] }); void qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Saved versions</CardTitle>
        <CardDescription>Save the current stage names, scoring rules and custom fields, and go back to any saved version later. Restoring only renames stages — deals keep their place — and never deletes fields or their data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Version name (optional)" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button disabled={save.isPending} onClick={() => save.mutate()}>Save current version</Button>
        </div>
        <ul className="divide-y divide-border text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">v{v.version} · {v.label}</div>
                <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()} · {(v.custom_fields ?? []).length} custom fields{v.stage_labels ? ` · ${v.stage_labels.join(" → ")}` : " · template stage names"}</div>
              </div>
              <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => { if (confirm(`Restore v${v.version}?`)) restore.mutate(v); }}>Restore</Button>
            </li>
          ))}
          {versions.length === 0 && <li className="py-2 text-muted-foreground">No versions saved yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
