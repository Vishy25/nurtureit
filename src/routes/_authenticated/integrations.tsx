import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { can } from "@/lib/permissions";
import { createIntakeKey, reprocessIntakeEvent } from "@/lib/intake.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — SalesOS" },
      { name: "description", content: "Lead intake keys, incoming event log and failed-event review queue." },
      { property: "og:title", content: "Integrations — SalesOS" },
      { property: "og:description", content: "Lead intake keys and event log." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { currentTenant, role } = useTenant();
  const tenantId = currentTenant?.tenantId ?? "";
  const isAdmin = can(role, "integrations.manage");
  const canSeeEvents = role === "tenant_admin" || role === "sales_manager" || role === "ops_coordinator";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "failed">("all");
  const createKey = useServerFn(createIntakeKey);
  const reprocess = useServerFn(reprocessIntakeEvent);

  const { data: keys = [] } = useQuery({
    queryKey: ["intake-keys", tenantId],
    enabled: !!tenantId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("intake_credentials").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["intake-events", tenantId, filter],
    enabled: !!tenantId && canSeeEvents,
    queryFn: async () => {
      let q = supabase.from("intake_events").select("*").eq("tenant_id", tenantId).order("received_at", { ascending: false }).limit(100);
      if (filter === "failed") q = q.eq("status", "failed");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: () => createKey({ data: { tenantId, name } }),
    onSuccess: (r) => { setNewKey(r.key); setName(""); qc.invalidateQueries({ queryKey: ["intake-keys"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intake_credentials").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Key revoked"); qc.invalidateQueries({ queryKey: ["intake-keys"] }); },
  });
  const retry = useMutation({
    mutationFn: (eventId: string) => reprocess({ data: { eventId } }),
    onSuccess: (r) => { r.status === "failed" ? toast.error(r.error ?? "Still failing") : toast.success(`Event ${r.status}`); qc.invalidateQueries({ queryKey: ["intake-events"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/intake/v1/leads` : "/api/public/intake/v1/leads";

  return (
    <>
      <PageHeader title="Integrations" description="Send leads in from websites, portals and partners. New leads wait for a manager to assign them." />
      {isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-display text-lg">Intake keys</CardTitle>
            <CardDescription>Each source gets its own key. Revoke a key to cut off that source immediately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Source name, e.g. Website form" value={name} onChange={(e) => setName(e.target.value)} />
              <Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>Create key</Button>
            </div>
            {newKey && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Copy this key now — it won't be shown again.</p>
                <code className="mt-1 block break-all">{newKey}</code>
              </div>
            )}
            <div className="divide-y rounded-md border">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <div className="font-medium">{k.name} <span className="text-muted-foreground">{k.key_prefix}…</span></div>
                    <div className="text-xs text-muted-foreground">Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={k.status === "active" ? "default" : "secondary"}>{k.status}</Badge>
                    {k.status === "active" && <Button size="sm" variant="outline" onClick={() => revoke.mutate(k.id)}>Revoke</Button>}
                  </div>
                </div>
              ))}
              {!keys.length && <p className="p-3 text-sm text-muted-foreground">No keys yet.</p>}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">How to send a lead</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{`POST ${endpoint}
Authorization: Bearer sos_...
Idempotency-Key: <unique id per lead>
X-Timestamp: <unix seconds>
Content-Type: application/json

{"full_name":"Jane Doe","email":"jane@example.com","phone":"+1 555 0100",
 "source":"website","message":"Looking for...","budget":500000,"timeline":"this month"}`}</pre>
              <p className="mt-2 text-muted-foreground">Limits: 60 requests per minute per key; repeated Idempotency-Key returns the original result.</p>
            </details>
          </CardContent>
        </Card>
      )}
      {canSeeEvents ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg">Incoming events</CardTitle>
              <CardDescription>Every request received, with its outcome.</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
              <Button size="sm" variant={filter === "failed" ? "default" : "outline"} onClick={() => setFilter("failed")}>Needs review</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-md border">
              {events.map((e) => (
                <div key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{String((e.payload as Record<string, unknown>)?.["full_name"] ?? "Unnamed")}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.received_at).toLocaleString()} · attempts {e.attempts} · ref {e.correlation_id.slice(0, 8)}</div>
                    {e.error && <div className="mt-1 text-xs text-destructive">{e.error}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.status === "failed" ? "destructive" : e.status === "processed" ? "default" : "secondary"}>{e.status}</Badge>
                    {e.status === "failed" && <Button size="sm" variant="outline" onClick={() => retry.mutate(e.id)}>Retry</Button>}
                  </div>
                </div>
              ))}
              {!events.length && <p className="p-3 text-sm text-muted-foreground">No events yet.</p>}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Your role doesn't include intake management.</p>
      )}
    </>
  );
}
