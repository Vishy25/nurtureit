import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/monitoring")({
  head: () => ({
    meta: [
      { title: "Monitoring — SalesOS" },
      { name: "description", content: "Workspace health: app errors, AI runs, incoming leads and automations." },
      { property: "og:title", content: "Monitoring — SalesOS" },
      { property: "og:description", content: "Errors, job status and integration health for your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonitoringPage,
});

const since = () => new Date(Date.now() - 7 * 86400000).toISOString();

function MonitoringPage() {
  const { currentTenant, role } = useTenant();
  const tenantId = currentTenant?.tenantId;
  const { data } = useQuery({
    queryKey: ["monitoring", tenantId],
    enabled: !!tenantId && role === "tenant_admin",
    refetchInterval: 60000,
    queryFn: async () => {
      const t = tenantId!;
      const s = since();
      const [errors, ai, intake, autos] = await Promise.all([
        supabase.from("app_errors").select("id, message, page, created_at").eq("tenant_id", t).gte("created_at", s).order("created_at", { ascending: false }).limit(50),
        supabase.from("ai_runs").select("status, model, duration_ms, error, created_at").eq("tenant_id", t).gte("created_at", s).limit(1000),
        supabase.from("intake_events").select("status, error, received_at").eq("tenant_id", t).gte("received_at", s).limit(1000),
        (supabase as any).from("automation_runs").select("status, created_at").eq("tenant_id", t).gte("created_at", s).limit(1000),
      ]);
      return { errors: errors.data ?? [], ai: ai.data ?? [], intake: intake.data ?? [], autos: (autos.data ?? []) as { status: string }[] };
    },
  });
  if (role !== "tenant_admin") return <p className="text-sm text-muted-foreground">Only workspace administrators can view monitoring.</p>;
  const count = (rows: { status: string }[] | undefined) => {
    const m: Record<string, number> = {};
    (rows ?? []).forEach((r) => (m[r.status] = (m[r.status] ?? 0) + 1));
    return m;
  };
  const aiDur = (data?.ai ?? []).filter((r) => r.duration_ms).map((r) => r.duration_ms!);
  const avg = aiDur.length ? Math.round(aiDur.reduce((a, b) => a + b, 0) / aiDur.length) : null;
  const cards = [
    { title: "AI runs", desc: avg ? `Average ${(avg / 1000).toFixed(1)}s per run` : "Suggestions and evaluations", m: count(data?.ai), bad: ["failed", "blocked"] },
    { title: "Incoming leads", desc: "Events received through your lead intake link", m: count(data?.intake), bad: ["failed", "rejected"] },
    { title: "Automations", desc: "Rule runs", m: count(data?.autos), bad: ["failed", "error"] },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Last 7 days. Refreshes every minute.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader><CardTitle className="font-display text-lg">{c.title}</CardTitle><CardDescription>{c.desc}</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.keys(c.m).length === 0 && <span className="text-sm text-muted-foreground">No activity</span>}
              {Object.entries(c.m).map(([k, v]) => (
                <Badge key={k} variant={c.bad.includes(k) ? "destructive" : "secondary"} className="capitalize">{k.replace(/_/g, " ")}: {v}</Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">App errors</CardTitle><CardDescription>Unexpected problems people in this workspace ran into.</CardDescription></CardHeader>
        <CardContent>
          {(data?.errors ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No errors reported. 🎉</p> : (
            <ul className="divide-y divide-border text-sm">
              {data!.errors.map((e) => (
                <li key={e.id} className="py-2">
                  <div className="font-medium">{e.message}</div>
                  <div className="text-xs text-muted-foreground">{e.page} · {new Date(e.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
