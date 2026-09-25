import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export const INDUSTRIES = [
  { value: "real_estate", label: "Real estate (complete template)" },
  { value: "software_sales", label: "Software sales (configuration proof)" },
] as const;

export function CreateWorkspaceCard({ compact = false }: { compact?: boolean }) {
  const { refresh, switchTenant } = useTenant();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<string>("real_estate");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_tenant", {
      _name: name,
      _industry: industry,
      _is_demo: false,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    refresh();
    if (typeof data === "string") switchTenant(data);
    toast.success("Workspace created. You are its administrator.");
  }

  return (
    <Card className={compact ? "" : "mx-auto w-full max-w-lg shadow-[var(--shadow-panel)]"}>
      <CardHeader>
        <CardTitle className="font-display">Create a workspace</CardTitle>
        <CardDescription>
          A workspace is one business or business unit. Its records are never visible to another
          workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Business name</Label>
            <Input
              id="ws-name"
              required
              value={name}
              placeholder="Harbour Realty"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-industry">Industry template</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id="ws-industry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create workspace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
