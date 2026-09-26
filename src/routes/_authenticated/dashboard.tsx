import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { getTemplate } from "@/lib/industry-templates";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesOS" },
      { name: "description", content: "Pipeline value, new leads, overdue follow-ups and conversion at a glance." },
      { property: "og:title", content: "Dashboard — SalesOS" },
      { property: "og:description", content: "Your SalesOS workspace overview." },
    ],
  }),
  component: DashboardPage,
});

const STAGES = ["qualification", "discovery", "shortlist", "site_visit", "negotiation", "closing", "closed_won"] as const;

function DashboardPage() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.tenantId ?? "";
  const tpl = getTemplate(currentTenant?.industry);
  const cur = currentTenant?.defaultCurrency ?? "USD";
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

  const { data } = useQuery({
    queryKey: ["dashboard", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [leads, opps, tasks] = await Promise.all([
        supabase.from("leads").select("id, status, source, owner_id, created_at").eq("tenant_id", tenantId).limit(1000),
        supabase.from("opportunities").select("id, stage, state, value").eq("tenant_id", tenantId).limit(1000),
        supabase.from("tasks").select("id, status, due_at").eq("tenant_id", tenantId).eq("status", "open").limit(1000),
      ]);
      const L = leads.data ?? [], O = opps.data ?? [], T = tasks.data ?? [];
      const open = O.filter((o) => o.state === "open");
      const won = O.filter((o) => o.state === "won");
      const closed = O.filter((o) => o.state === "won" || o.state === "lost");
      const bySource: Record<string, number> = {};
      L.forEach((l) => { bySource[l.source] = (bySource[l.source] ?? 0) + 1; });
      return {
        newLeads: L.filter((l) => l.created_at >= weekAgo).length,
        unassigned: L.filter((l) => !l.owner_id && l.status === "new").length,
        leadToDeal: L.length ? Math.round((L.filter((l) => l.status === "converted").length / L.length) * 100) : 0,
        winRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
        pipeline: open.reduce((s, o) => s + Number(o.value ?? 0), 0),
        weighted: open.reduce((s, o) => s + Number(o.value ?? 0) * ((STAGES.indexOf(o.stage as (typeof STAGES)[number]) + 1) / 7), 0),
        wonValue: won.reduce((s, o) => s + Number(o.value ?? 0), 0),
        overdue: T.filter((t) => t.due_at && t.due_at < new Date().toISOString()).length,
        stageCounts: STAGES.map((s) => open.filter((o) => o.stage === s).length),
        bySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 6),
      };
    },
  });

  const kpis = [
    { label: "New leads (7 days)", value: data?.newLeads ?? "—" },
    { label: "Waiting for assignment", value: data?.unassigned ?? "—", link: "/leads" },
    { label: "Overdue follow-ups", value: data?.overdue ?? "—", link: "/tasks" },
    { label: "Open pipeline", value: data ? fmt(data.pipeline) : "—" },
    { label: "Weighted pipeline", value: data ? fmt(data.weighted) : "—" },
    { label: "Won value", value: data ? fmt(data.wonValue) : "—" },
    { label: "Lead → deal", value: data ? `${data.leadToDeal}%` : "—" },
    { label: "Win rate", value: data ? `${data.winRate}%` : "—" },
  ];
  const maxStage = Math.max(1, ...(data?.stageCounts ?? [1]));

  return (
    <>
      <PageHeader title={currentTenant?.name ?? "Dashboard"} description={`${tpl.label} workspace`} actions={currentTenant?.isDemo ? <Badge variant="secondary">Sample data</Badge> : null} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-1"><CardDescription>{k.label}</CardDescription></CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="font-display text-2xl font-semibold">{k.value}</span>
              {k.link && <Button asChild size="sm" variant="ghost"><Link to={k.link}>Open</Link></Button>}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Open deals by stage</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tpl.stages.slice(0, 6).map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-sm">
                <span className="w-40 truncate">{s}</span>
                <div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${((data?.stageCounts[i] ?? 0) / maxStage) * 100}%` }} /></div>
                <span className="w-6 text-right">{data?.stageCounts[i] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Leads by source</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data?.bySource.map(([s, n]) => <div key={s} className="flex justify-between"><span>{s}</span><span>{n}</span></div>)}
            {!data?.bySource.length && <p className="text-muted-foreground">No leads yet.</p>}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Weighted pipeline = deal value × stage position ÷ 7. Win rate = won ÷ (won + lost). You see only the records your role allows.</p>
    </>
  );
}
