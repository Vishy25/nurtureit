import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { getTemplate } from "@/lib/industry-templates";
import { useWorkspaceConfig } from "@/lib/workspace-config";
import { ROLE_LABELS } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesOS" },
      { name: "description", content: "Role-based view of leads, conversions, pipeline stages, tasks and property activity." },
      { property: "og:title", content: "Dashboard — SalesOS" },
      { property: "og:description", content: "Track leads, conversions, pipeline, tasks and property activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const STAGES = ["qualification", "discovery", "shortlist", "site_visit", "negotiation", "closing", "closed_won"] as const;
const DAY = 86400_000;

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: d.toLocaleString(undefined, { month: "short" }) });
  }
  return out;
}

function DashboardPage() {
  const { currentTenant, role } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.tenantId ?? "";
  const tpl = getTemplate(currentTenant?.industry);
  const { data: cfg } = useWorkspaceConfig(tenantId || undefined, currentTenant?.industry);
  const stageLabels = cfg?.stageLabels ?? tpl.stages;
  const cur = currentTenant?.defaultCurrency ?? "USD";
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  const isRep = role === "sales_rep";
  const isLeader = role === "tenant_admin" || role === "sales_manager";
  const isExec = role === "tenant_admin" || role === "analyst";
  const showProperties = currentTenant?.industry === "real_estate";

  const { data } = useQuery({
    queryKey: ["dashboard", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const sb = supabase as any;
      const [leads, opps, tasks, props, visits, offers, members] = await Promise.all([
        sb.from("leads").select("id, status, source, owner_id, created_at, updated_at").eq("tenant_id", tenantId).limit(2000),
        sb.from("opportunities").select("id, stage, state, value, owner_id, expected_close, updated_at").eq("tenant_id", tenantId).limit(2000),
        sb.from("tasks").select("id, status, due_at, assignee_id, completed_at").eq("tenant_id", tenantId).limit(2000),
        sb.from("properties").select("id, status").eq("tenant_id", tenantId).limit(2000),
        sb.from("site_visits").select("id, status, scheduled_at").eq("tenant_id", tenantId).limit(2000),
        sb.from("offers").select("id, status, amount, created_at").eq("tenant_id", tenantId).limit(2000),
        sb.from("memberships").select("user_id, profiles(full_name, email)").eq("tenant_id", tenantId).eq("status", "active"),
      ]);
      const L: any[] = leads.data ?? [], O: any[] = opps.data ?? [], T: any[] = tasks.data ?? [];
      const P: any[] = props.data ?? [], V: any[] = visits.data ?? [], F: any[] = offers.data ?? [], M: any[] = members.data ?? [];
      const now = Date.now(), nowIso = new Date().toISOString(), weekAgo = new Date(now - 7 * DAY).toISOString();
      const open = O.filter((o) => o.state === "open");
      const won = O.filter((o) => o.state === "won");
      const lost = O.filter((o) => o.state === "lost");
      const openTasks = T.filter((t) => t.status === "open");
      const months = lastMonths(6);
      const byMonth = months.map((m) => ({
        month: m.label,
        leads: L.filter((l) => monthKey(new Date(l.created_at)) === m.key).length,
        converted: L.filter((l) => l.status === "converted" && monthKey(new Date(l.updated_at)) === m.key).length,
        won: won.filter((o) => monthKey(new Date(o.updated_at)) === m.key).reduce((s, o) => s + Number(o.value ?? 0), 0),
      }));
      const statusCounts = ["new", "accepted", "nurturing", "converted", "disqualified"].map((s) => ({ status: s, n: L.filter((l) => l.status === s).length }));
      const name = (id: string | null) => {
        const m = M.find((x) => x.user_id === id);
        return m?.profiles?.full_name || m?.profiles?.email || (id ? "Former member" : "Unassigned");
      };
      const ownerIds = Array.from(new Set([...L.map((l) => l.owner_id), ...O.map((o) => o.owner_id), ...openTasks.map((t) => t.assignee_id)].filter(Boolean)));
      const team = ownerIds.map((id) => ({
        id, name: name(id),
        leads: L.filter((l) => l.owner_id === id).length,
        converted: L.filter((l) => l.owner_id === id && l.status === "converted").length,
        openDeals: open.filter((o) => o.owner_id === id).length,
        wonValue: won.filter((o) => o.owner_id === id).reduce((s, o) => s + Number(o.value ?? 0), 0),
        overdue: openTasks.filter((t) => t.assignee_id === id && t.due_at && t.due_at < nowIso).length,
      })).sort((a, b) => b.wonValue - a.wonValue || b.converted - a.converted);
      const in90 = new Date(now + 90 * DAY).toISOString().slice(0, 10);
      return {
        totalLeads: L.length,
        newLeads: L.filter((l) => l.created_at >= weekAgo).length,
        unassigned: L.filter((l) => !l.owner_id && l.status === "new").length,
        converted: L.filter((l) => l.status === "converted").length,
        leadToDeal: L.length ? Math.round((L.filter((l) => l.status === "converted").length / L.length) * 100) : 0,
        winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
        pipeline: open.reduce((s, o) => s + Number(o.value ?? 0), 0),
        weighted: open.reduce((s, o) => s + Number(o.value ?? 0) * ((STAGES.indexOf(o.stage) + 1) / 7), 0),
        forecast90: open.filter((o) => o.expected_close && o.expected_close <= in90).reduce((s, o) => s + Number(o.value ?? 0) * ((STAGES.indexOf(o.stage) + 1) / 7), 0),
        wonValue: won.reduce((s, o) => s + Number(o.value ?? 0), 0),
        stages: STAGES.slice(0, 6).map((s) => ({ stage: s, n: open.filter((o) => o.stage === s).length, value: open.filter((o) => o.stage === s).reduce((a, o) => a + Number(o.value ?? 0), 0) })),
        tasks: {
          open: openTasks.length,
          overdue: openTasks.filter((t) => t.due_at && t.due_at < nowIso).length,
          dueToday: openTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) === nowIso.slice(0, 10)).length,
          doneWeek: T.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= weekAgo).length,
          mine: openTasks.filter((t) => t.assignee_id === user?.id).length,
        },
        properties: {
          available: P.filter((p) => p.status === "available").length,
          reserved: P.filter((p) => p.status === "reserved").length,
          sold: P.filter((p) => p.status === "sold").length,
          visitsUpcoming: V.filter((v) => v.status === "scheduled" && v.scheduled_at >= nowIso).length,
          visitsDone30: V.filter((v) => v.status === "completed" && v.scheduled_at >= new Date(now - 30 * DAY).toISOString()).length,
          offersOpen: F.filter((f) => f.status === "pending" || f.status === "submitted" || f.status === "countered").length,
          offersAccepted: F.filter((f) => f.status === "accepted").length,
        },
        byMonth, statusCounts, team,
        bySource: Object.entries(L.reduce((a: Record<string, number>, l) => ((a[l.source] = (a[l.source] ?? 0) + 1), a), {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6) as [string, number][],
      };
    },
  });

  const kpis = [
    { label: isRep ? "My new leads (7 days)" : "New leads (7 days)", value: data?.newLeads ?? "—", link: "/leads" },
    ...(isLeader ? [{ label: "Waiting for an owner", value: data?.unassigned ?? "—", link: "/leads" }] : []),
    { label: "Lead → deal conversion", value: data ? `${data.leadToDeal}%` : "—" },
    { label: "Win rate", value: data ? `${data.winRate}%` : "—" },
    { label: "Open pipeline", value: data ? fmt(data.pipeline) : "—", link: "/pipeline" },
    { label: "Weighted pipeline", value: data ? fmt(data.weighted) : "—" },
    ...(isExec || isLeader ? [{ label: "90-day forecast", value: data ? fmt(data.forecast90) : "—" }] : []),
    { label: "Won value", value: data ? fmt(data.wonValue) : "—" },
    { label: "Overdue tasks", value: data?.tasks.overdue ?? "—", link: "/tasks" },
  ];
  const maxStage = Math.max(1, ...(data?.stages.map((s) => s.n) ?? [1]));
  const scopeNote = isRep ? "Showing your own leads, deals and tasks." : role ? `${ROLE_LABELS[role]} view · whole workspace.` : "";

  return (
    <>
      <PageHeader title={currentTenant?.name ?? "Dashboard"} description={`${tpl.label} workspace · ${scopeNote}`} actions={currentTenant?.isDemo ? <Badge variant="secondary">Sample data</Badge> : null} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Leads and conversions (6 months)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis allowDecimals={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Bar dataKey="leads" name="New leads" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="converted" name="Converted" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Open deals by stage</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.stages ?? []).map((s, i) => (
              <div key={s.stage} className="flex items-center gap-2 text-sm">
                <span className="w-36 truncate">{stageLabels[i]}</span>
                <div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(s.n / maxStage) * 100}%` }} /></div>
                <span className="w-6 text-right">{s.n}</span>
                <span className="hidden w-24 text-right text-xs text-muted-foreground sm:inline">{fmt(s.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Leads by status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 text-center">
            {(data?.statusCounts ?? []).map((s) => (
              <div key={s.status} className="rounded-md border p-2">
                <p className="font-display text-xl font-semibold">{s.n}</p>
                <p className="text-xs capitalize text-muted-foreground">{s.status}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">{isRep ? "My tasks" : "Tasks"}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[["Open", data?.tasks.open], ["Due today", data?.tasks.dueToday], ["Overdue", data?.tasks.overdue], ["Done this week", data?.tasks.doneWeek]].map(([l, v]) => (
              <div key={l as string} className="rounded-md border p-2">
                <p className={`font-display text-xl font-semibold ${l === "Overdue" && Number(v) > 0 ? "text-destructive" : ""}`}>{v ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        {showProperties && (
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Property activity</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[["Available", data?.properties.available], ["Reserved", data?.properties.reserved], ["Sold", data?.properties.sold], ["Upcoming visits", data?.properties.visitsUpcoming],
                ["Visits done (30 days)", data?.properties.visitsDone30], ["Open offers", data?.properties.offersOpen], ["Accepted offers", data?.properties.offersAccepted]].map(([l, v]) => (
                <div key={l as string} className="rounded-md border p-2">
                  <p className="font-display text-xl font-semibold">{v ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{l}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Leads by source</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data?.bySource.map(([s, n]) => <div key={s} className="flex justify-between"><span>{s}</span><span>{n}</span></div>)}
            {!data?.bySource.length && <p className="text-muted-foreground">No leads yet.</p>}
          </CardContent>
        </Card>
        {(isExec || isLeader) && (
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Won value by month</CardTitle></CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.byMonth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--color-muted-foreground)" tickFormatter={(v) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                  <Bar dataKey="won" name="Won" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {isLeader && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Team performance</CardTitle>
            <CardDescription>By owner. Sorted by won value.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2">Person</th><th>Leads</th><th>Converted</th><th>Open deals</th><th>Won value</th><th>Overdue tasks</th></tr>
              </thead>
              <tbody>
                {(data?.team ?? []).map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2">{t.name}</td><td>{t.leads}</td><td>{t.converted}</td><td>{t.openDeals}</td><td>{fmt(t.wonValue)}</td>
                    <td className={t.overdue ? "text-destructive" : ""}>{t.overdue}</td>
                  </tr>
                ))}
                {!data?.team.length && <tr><td colSpan={6} className="py-3 text-muted-foreground">No assigned records yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Definitions: conversion = converted leads ÷ all leads. Win rate = won ÷ (won + lost). Weighted pipeline = deal value × stage position ÷ 7.
        90-day forecast = weighted value of open deals expected to close within 90 days. You see only the records your role allows.
      </p>
    </>
  );
}
