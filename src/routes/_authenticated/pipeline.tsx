import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";
import { useWorkspaceConfig } from "@/lib/workspace-config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — SalesOS" },
      { name: "description", content: "The seven-stage opportunity pipeline with server-enforced transition rules." },
      { property: "og:title", content: "Pipeline — SalesOS" },
      { property: "og:description", content: "Seven-stage opportunity pipeline with transition rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

const STAGES = ["qualification", "discovery", "shortlist", "site_visit", "negotiation", "closing", "closed_won"] as const;
type Stage = (typeof STAGES)[number];
type State = "open" | "on_hold" | "nurturing" | "won" | "lost";
const DEFAULT_STAGE_LABEL: Record<Stage, string> = {
  qualification: "Qualification confirmed",
  discovery: "Needs discovery completed",
  shortlist: "Property shortlist agreed",
  site_visit: "Site visit and evaluation",
  negotiation: "Offer and negotiation",
  closing: "Contract and closing preparation",
  closed_won: "Closed won",
};
const StageLabels = createContext<Record<Stage, string>>(DEFAULT_STAGE_LABEL);
const STATE_LABEL: Record<State, string> = { open: "Open", on_hold: "On hold", nurturing: "Nurturing", won: "Won", lost: "Lost" };

function money(v: number | null, cur: string) {
  return v == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function PipelinePage() {
  const { currentTenant, allows } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.tenantId;
  const [openId, setOpenId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const { data: cfg } = useWorkspaceConfig(tenantId, currentTenant?.industry);
  const STAGE_LABEL = cfg ? (Object.fromEntries(STAGES.map((s, i) => [s, cfg.stageLabels[i] ?? DEFAULT_STAGE_LABEL[s]])) as Record<Stage, string>) : DEFAULT_STAGE_LABEL;
  const { data: deals = [] } = useQuery({
    queryKey: ["opportunities", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*, contacts(full_name), organizations(name)").eq("tenant_id", tenantId!).order("updated_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const visible = deals.filter((d) => showClosed || d.state !== "lost");
  const selected = deals.find((d) => d.id === openId);

  return (
    <StageLabels.Provider value={STAGE_LABEL}>
      <PageHeader
        title="Pipeline"
        description="Deals move one stage at a time. Losing a deal needs a reason; on-hold and nurturing need a follow-up date."
        actions={allows("records.edit.own") && tenantId && user && currentTenant?.role !== "ops_coordinator" ? (
          <NewDealButton tenantId={tenantId} userId={user.id} currency={currentTenant.defaultCurrency} />
        ) : null}
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show lost deals
      </label>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((s) => {
          const col = visible.filter((d) => d.stage === s);
          const total = col.reduce((a, d) => a + Number(d.value ?? 0), 0);
          return (
            <div key={s} className="w-64 shrink-0 rounded-lg border border-border bg-secondary/40 p-2">
              <div className="mb-2 px-1">
                <p className="text-xs font-semibold text-accent">{STAGE_LABEL[s]}</p>
                <p className="text-xs text-muted-foreground">{col.length} · {money(total, currentTenant?.defaultCurrency ?? "USD")}</p>
              </div>
              <div className="space-y-2">
                {col.map((d) => (
                  <button key={d.id} onClick={() => setOpenId(d.id)} className="w-full rounded-md border border-border bg-card p-3 text-left text-sm hover:border-accent">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.contacts?.full_name ?? d.organizations?.name ?? "No contact"}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs">{money(d.value, d.currency)}</span>
                      {d.state !== "open" && <Badge variant={d.state === "lost" ? "destructive" : "secondary"}>{STATE_LABEL[d.state as State]}</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && tenantId && <DealDetail deal={selected} tenantId={tenantId} />}
        </SheetContent>
      </Sheet>
    </StageLabels.Provider>
  );
}

type Deal = { id: string; name: string; stage: string; state: string; value: number | null; currency: string; lost_reason: string | null; follow_up_at: string | null; expected_close: string | null };

function DealDetail({ deal, tenantId }: { deal: Deal; tenantId: string }) {
  const qc = useQueryClient();
  const STAGE_LABEL = useContext(StageLabels);
  const stage = deal.stage as Stage;
  const idx = STAGES.indexOf(stage);
  const [action, setAction] = useState<"lost" | "on_hold" | "nurturing" | null>(null);
  const [reason, setReason] = useState("");
  const [followUp, setFollowUp] = useState("");
  const history = useQuery({
    queryKey: ["opp-history", deal.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunity_stage_history").select("*").eq("opportunity_id", deal.id).order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const move = useMutation({
    mutationFn: async (args: { to_stage: Stage; to_state: State }) => {
      const { error } = await supabase.rpc("move_opportunity", {
        _id: deal.id, _to_stage: args.to_stage, _to_state: args.to_state,
        ...(reason.trim() ? { _reason: reason.trim() } : {}),
        ...(followUp ? { _follow_up: followUp } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal updated");
      setAction(null); setReason(""); setFollowUp("");
      void qc.invalidateQueries({ queryKey: ["opportunities", tenantId] });
      void qc.invalidateQueries({ queryKey: ["opp-history", deal.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const closed = deal.state === "won" || deal.state === "lost";
  const paused = deal.state === "on_hold" || deal.state === "nurturing";

  return (
    <>
      <SheetHeader><SheetTitle>{deal.name}</SheetTitle></SheetHeader>
      <div className="mt-4 space-y-5 px-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Stage</p>{STAGE_LABEL[stage]}</div>
          <div><p className="text-xs text-muted-foreground">Status</p>{STATE_LABEL[deal.state as State]}</div>
          <div><p className="text-xs text-muted-foreground">Value</p>{money(deal.value, deal.currency)}</div>
          <div><p className="text-xs text-muted-foreground">Expected close</p>{deal.expected_close ?? "—"}</div>
          {deal.follow_up_at && <div><p className="text-xs text-muted-foreground">Follow up</p>{deal.follow_up_at}</div>}
          {deal.lost_reason && <div className="col-span-2"><p className="text-xs text-muted-foreground">Lost reason</p>{deal.lost_reason}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          {!closed && !paused && idx < STAGES.length - 1 && (
            <Button size="sm" disabled={move.isPending} onClick={() => move.mutate({ to_stage: STAGES[idx + 1]!, to_state: "open" })}>
              Advance to {STAGE_LABEL[STAGES[idx + 1]!]}
            </Button>
          )}
          {!closed && !paused && idx > 0 && stage !== "closed_won" && (
            <Button size="sm" variant="outline" disabled={move.isPending} onClick={() => move.mutate({ to_stage: STAGES[idx - 1]!, to_state: "open" })}>Move back</Button>
          )}
          {(paused || closed) && (
            <Button size="sm" variant="outline" disabled={move.isPending} onClick={() => move.mutate({ to_stage: stage === "closed_won" ? "closing" : stage, to_state: "open" })}>Reopen</Button>
          )}
          {!closed && !paused && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setAction("on_hold")}>On hold</Button>
              <Button size="sm" variant="secondary" onClick={() => setAction("nurturing")}>Nurture</Button>
              <Button size="sm" variant="destructive" onClick={() => setAction("lost")}>Close lost</Button>
            </>
          )}
        </div>

        {action && (
          <form className="space-y-2 rounded-md border border-border p-3" onSubmit={(e) => { e.preventDefault(); move.mutate({ to_stage: stage, to_state: action }); }}>
            {action === "lost" ? (
              <div className="space-y-1"><Label>Reason for losing</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
            ) : (
              <>
                <div className="space-y-1"><Label>Follow-up date</Label><Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} required /></div>
                <div className="space-y-1"><Label>Note (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              </>
            )}
            <div className="flex gap-2"><Button size="sm" type="submit" disabled={move.isPending}>Confirm</Button><Button size="sm" type="button" variant="ghost" onClick={() => setAction(null)}>Cancel</Button></div>
          </form>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">Stage history</p>
          <ol className="space-y-2 text-sm">
            {history.data?.map((h) => (
              <li key={h.id} className="rounded-md border border-border p-2">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{new Date(h.changed_at).toLocaleString()}</span><span>{STATE_LABEL[h.to_state as State]}</span></div>
                <p>{h.from_stage ? `${STAGE_LABEL[h.from_stage as Stage]} → ` : "Created in "}{STAGE_LABEL[h.to_stage as Stage]}</p>
                {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

function NewDealButton({ tenantId, userId, currency }: { tenantId: string; userId: string; currency: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", contact_id: "none", value: "", expected_close: "" });
  const contacts = useQuery({
    queryKey: ["contacts-min", tenantId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, full_name, organization_id").eq("tenant_id", tenantId).order("full_name").limit(500);
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const c = contacts.data?.find((x) => x.id === f.contact_id);
      const { error } = await supabase.from("opportunities").insert({
        tenant_id: tenantId, name: f.name.trim(), contact_id: c?.id ?? null, organization_id: c?.organization_id ?? null,
        value: f.value ? Number(f.value) : null, currency, expected_close: f.expected_close || null, owner_id: userId, created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deal created"); setOpen(false); setF({ name: "", contact_id: "none", value: "", expected_close: "" }); void qc.invalidateQueries({ queryKey: ["opportunities", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 size-4" /> New deal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New deal</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) save.mutate(); }}>
          <div className="space-y-1"><Label>Deal name</Label><Input value={f.name} required onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Contact</Label>
            <Select value={f.contact_id} onValueChange={(v) => setF({ ...f, contact_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem>{contacts.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Value ({currency})</Label><Input type="number" min="0" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
            <div className="space-y-1"><Label>Expected close</Label><Input type="date" value={f.expected_close} onChange={(e) => setF({ ...f, expected_close: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={save.isPending}>Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
