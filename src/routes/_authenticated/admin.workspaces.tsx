import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { CreateWorkspaceCard } from "@/components/create-workspace-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/workspaces")({
  head: () => ({
    meta: [
      { title: "Workspaces — SalesOS" },
      { name: "description", content: "Switch between businesses, create a workspace, or accept an invitation." },
      { property: "og:title", content: "Workspaces — SalesOS" },
      { property: "og:description", content: "Switch, create or join a workspace." },
    ],
  }),
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const { memberships, currentTenant, switchTenant, refresh } = useTenant();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_invitation", { _token: token.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setToken("");
    refresh();
    if (typeof data === "string") switchTenant(data);
    toast.success("Invitation accepted. You now have access to that workspace.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Your workspaces</CardTitle>
          <CardDescription>
            You can belong to several businesses with a different role in each.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.map((m) => (
            <div
              key={m.tenantId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[m.role]} · {m.industry.replace("_", " ")}
                </p>
              </div>
              {m.isDemo && <Badge variant="secondary">Sample data</Badge>}
              {currentTenant?.tenantId === m.tenantId ? (
                <Badge>Current</Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={() => switchTenant(m.tenantId)}>
                  Switch
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const a = await supabase.rpc("seed_demo_tenant" as never, { _name: "Demo Harbour Realty" } as never);
              const b = await supabase.rpc("seed_demo_tenant" as never, { _name: "Demo Summit Estates" } as never);
              setBusy(false);
              const err = a.error ?? b.error;
              if (err) return void toast.error(err.message);
              refresh();
              toast.success("Two sample workspaces created with synthetic data.");
            }}
          >
            Create two sample workspaces
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateWorkspaceCard compact />
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Join with an invitation code</CardTitle>
            <CardDescription>
              The code must have been issued to the email address on your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={accept}>
              <div className="space-y-2">
                <Label htmlFor="token">Invitation code</Label>
                <Input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Accept invitation
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
