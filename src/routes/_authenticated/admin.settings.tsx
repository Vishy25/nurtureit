import { AiControls } from "@/components/ai-controls";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { INDUSTRY_TEMPLATES, AUTONOMY_LEVELS, getTemplate } from "@/lib/industry-templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Workspace settings — SalesOS" },
      { name: "description", content: "Choose your industry template and AI autonomy level." },
      { property: "og:title", content: "Workspace settings — SalesOS" },
      { property: "og:description", content: "Industry template and AI autonomy." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { currentTenant, role } = useTenant();
  const qc = useQueryClient();
  const [industry, setIndustry] = useState("real_estate");
  const [autonomy, setAutonomy] = useState("suggest");
  useEffect(() => {
    if (currentTenant) { setIndustry(currentTenant.industry); setAutonomy(currentTenant.aiAutonomy); }
  }, [currentTenant]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update({ industry, ai_autonomy: autonomy }).eq("id", currentTenant!.tenantId);
      if (error) throw error;
      await supabase.from("audit_events").insert({ tenant_id: currentTenant!.tenantId, action: "tenant.settings_changed", entity_type: "tenant", entity_id: currentTenant!.tenantId, metadata: { industry, ai_autonomy: autonomy } });
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["memberships"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "tenant_admin") return <p className="text-sm text-muted-foreground">Only workspace administrators can change settings.</p>;
  const t = getTemplate(industry);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Industry template</CardTitle>
          <CardDescription>Changes names of menus and pipeline stages. Your data is not changed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INDUSTRY_TEMPLATES.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Stages: {t.stages.join(" → ")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">AI autonomy</CardTitle>
          <CardDescription>How much the assistant may do without a person approving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {AUTONOMY_LEVELS.map((a) => (
            <Label key={a.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal">
              <input type="radio" name="autonomy" className="mt-1" checked={autonomy === a.id} onChange={() => setAutonomy(a.id)} />
              <span><span className="font-medium">{a.label}</span><br /><span className="text-xs text-muted-foreground">{a.description}</span></span>
            </Label>
          ))}
        </CardContent>
      </Card>
      <div className="md:col-span-2"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Button></div>
      <div className="md:col-span-2"><AiControls tenantId={currentTenant!.tenantId} /></div>
    </div>
  );
}
