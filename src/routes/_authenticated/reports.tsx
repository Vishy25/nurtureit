import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useWorkspaceConfig } from "@/lib/workspace-config";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & forecast — SalesOS" },
      { name: "description", content: "Monthly targets, weighted pipeline forecast, snapshots and metric definitions." },
      { property: "og:title", content: "Reports & forecast — SalesOS" },
      { property: "og:description", content: "Targets, weighted forecast and documented sales metrics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

/** Documented stage probabilities used for the weighted forecast. */
const STAGE_PROBABILITY: Record<string, number> = {
  qualification: 0.1, discovery: 0.2, shortlist: 0.35, site_visit: 0.5, negotiation: 0.7, closing: 0.9, closed_won: 1,
};
const STAGES = Object.keys(STAGE_PROBABILITY);

function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function ReportsPage() {
  const { currentTenant, role } = useTenant();
  const tenantId = currentTenant?.tenantId;
  const currency = currentTenant?.defaultCurrency ?? "USD";
  const config = useWorkspaceConfig();
  const qc = useQueryClient();
  const canSetTargets = role === "tenant_admin" || role === "sales_manager";
  const canSnapshot = canSetTargets || role === "analyst";
  const month = monthStart();
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const data = useQuery({
    queryKey: ["reports", tenantId, month],
    enabled: !!tenantId,
    queryFn: async () => {
      const [opps, target, snaps] = await Promise.all([
        supabase.from("opportunities").select("stage,state,value,currency,updated_at").eq("tenant_id", tenantId!).limit(5000),
        supabase.from("sales_targets").select("*").eq("tenant_id", tenantId!).eq("period_month", month).maybeSingle(),
        supabase.from("forecast_snapshots").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(10),
      ]);
      if (opps.error) throw opps.error;
      const rows = (opps.data ?? []).filter((o) => o.currency === currency);
      const skipped = (opps.data ?? []).length - rows.length;
      const open = rows.filter((o) => o.state === "open");
      const byStage = STAGES.map((s) => {
        const list = open.filter((o) => o.stage === s);
        const value = list.reduce((a, o) => a + Number(o.value ?? 0), 0);
        return { stage: s, count: list.length, value, weighted: value * STAGE_PROBABILITY[s]! };
      });
      const won = rows.filter((o) => o.state === "won" && o.updated_at >= month);
      return {
        byStage, skipped,
        openValue: byStage.reduce((a, s) => a + s.value, 0),
        weighted: byStage.reduce((a, s) => a + s.weighted, 0),
        openCount: open.length,
        wonValue: won.reduce((a, o) => a + Number(o.value ?? 0), 0),
        wonCount: won.length,
        target: target.data,
        snapshots: snaps.data ?? [],
      };
    },
  });

  const [rev, setRev] = useState("");
  const [deals, setDeals] = useState("");

  async function saveTarget() {
    const { error } = await supabase.from("sales_targets").upsert(
      { tenant_id: tenantId!, period_month: month, revenue_target: Number(rev || data.data?.target?.revenue_target || 0), deals_target: Number(deals || data.data?.target?.deals_target || 0) },
      { onConflict: "tenant_id,period_month" },
    );
    if (error) return toast.error(error.message);
    toast.success("Target saved");
    setRev(""); setDeals("");
    qc.invalidateQueries({ queryKey: ["reports"] });
  }

  async function snapshot() {
    const d = data.data!;
    const { error } = await supabase.from("forecast_snapshots").insert({
      tenant_id: tenantId!, open_value: d.openValue, weighted_value: d.weighted, won_value_month: d.wonValue, open_count: d.openCount,
    });
    if (error) return toast.error(error.message);
    toast.success("Forecast snapshot saved");
    qc.invalidateQueries({ queryKey: ["reports"] });
  }

  const d = data.data;
  const revTarget = Number(d?.target?.revenue_target ?? 0);
  const dealsTarget = Number(d?.target?.deals_target ?? 0);

  return (
    <>
      <PageHeader title="Reports & forecast" description={`Figures in ${currency}; deals in other currencies are excluded, not converted.`} />
      {!d ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>This month vs target</CardTitle><CardDescription>{month.slice(0, 7)}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm"><span>Won revenue</span><span>{fmt(d.wonValue)} / {fmt(revTarget)}</span></div>
                <Progress value={revTarget ? Math.min(100, (d.wonValue / revTarget) * 100) : 0} />
              </div>
              <div>
                <div className="flex justify-between text-sm"><span>Deals won</span><span>{d.wonCount} / {dealsTarget}</span></div>
                <Progress value={dealsTarget ? Math.min(100, (d.wonCount / dealsTarget) * 100) : 0} />
              </div>
              <p className="text-sm text-muted-foreground">Projected month-end (won + weighted open): {fmt(d.wonValue + d.weighted)}</p>
              {canSetTargets && (
                <div className="flex flex-wrap items-end gap-2">
                  <div><Label>Revenue target</Label><Input type="number" min={0} value={rev} placeholder={String(revTarget)} onChange={(e) => setRev(e.target.value)} className="w-36" /></div>
                  <div><Label>Deals target</Label><Input type="number" min={0} value={deals} placeholder={String(dealsTarget)} onChange={(e) => setDeals(e.target.value)} className="w-28" /></div>
                  <Button onClick={saveTarget}>Save target</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Weighted pipeline</CardTitle><CardDescription>{d.openCount} open deals · {fmt(d.openValue)} open · {fmt(d.weighted)} weighted</CardDescription></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th>Stage</th><th>Deals</th><th>Value</th><th>Prob.</th><th>Weighted</th></tr></thead>
                <tbody>
                  {d.byStage.map((s, i) => (
                    <tr key={s.stage} className="border-t"><td>{config.stageLabels?.[i] ?? s.stage}</td><td>{s.count}</td><td>{fmt(s.value)}</td><td>{Math.round(STAGE_PROBABILITY[s.stage]! * 100)}%</td><td>{fmt(s.weighted)}</td></tr>
                  ))}
                </tbody>
              </table>
              {d.skipped > 0 && <p className="mt-2 text-xs text-muted-foreground">{d.skipped} deal(s) in other currencies excluded.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle>Forecast snapshots</CardTitle><CardDescription>Point-in-time records to compare forecast drift.</CardDescription></div>
              {canSnapshot && <Button variant="outline" onClick={snapshot}>Take snapshot</Button>}
            </CardHeader>
            <CardContent>
              {d.snapshots.length === 0 ? <p className="text-sm text-muted-foreground">No snapshots yet.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th>Taken</th><th>Open</th><th>Weighted</th><th>Won (month)</th></tr></thead>
                  <tbody>{d.snapshots.map((s) => (
                    <tr key={s.id} className="border-t"><td>{new Date(s.created_at).toLocaleString()}</td><td>{fmt(Number(s.open_value))}</td><td>{fmt(Number(s.weighted_value))}</td><td>{fmt(Number(s.won_value_month))}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Metric definitions</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p><b className="text-foreground">Open value</b> — sum of value on deals in state "open".</p>
              <p><b className="text-foreground">Weighted value</b> — open value × fixed stage probability (table above).</p>
              <p><b className="text-foreground">Won revenue</b> — value of deals marked won with last update this calendar month (UTC).</p>
              <p><b className="text-foreground">Projected month-end</b> — won revenue + weighted value.</p>
              <p><b className="text-foreground">Currency</b> — only the workspace default currency is counted; no conversion.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
