import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { useWorkspaceConfig, cleanCustomValues } from "@/lib/workspace-config";
import { scoreLead } from "@/lib/scoring";
import { CustomFieldInputs } from "@/components/custom-field-inputs";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { LeadDetail } from "@/components/lead-detail";
import { ExportImport, BulkBar, duplicateIds, useMembers } from "@/components/leads-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — SalesOS" },
      { name: "description", content: "Qualified lead intake, scoring, assignment and follow-up in SalesOS." },
      { property: "og:title", content: "Leads — SalesOS" },
      { property: "og:description", content: "Qualified lead intake, scoring and follow-up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s) => z.object({ lead: z.string().uuid().optional() }).parse({ lead: typeof s["lead"] === "string" ? s["lead"] : undefined }),
  component: LeadsPage,
});

const STATUSES = ["new", "accepted", "nurturing", "disqualified", "converted"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  accepted: "Accepted",
  nurturing: "Nurturing",
  disqualified: "Disqualified",
  converted: "Converted",
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function LeadsPage() {
  const { currentTenant, allows } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.tenantId;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState(false);
  const canCreate = allows("records.edit.own");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { lead: leadParam } = Route.useSearch();
  useEffect(() => { if (leadParam) setSelectedId(leadParam); }, [leadParam]);

  const [pageLimit, setPageLimit] = useState(200);
  const { data: leadPage, isLoading } = useQuery({
    queryKey: ["leads", tenantId, pageLimit],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return { rows: [], total: 0 };
      const { data, error, count } = await supabase
        .from("leads")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(0, pageLimit - 1);
      if (error) throw error;
      return { rows: data, total: count ?? data.length };
    },
  });
  const leads = leadPage?.rows ?? [];
  const totalLeads = leadPage?.total ?? 0;
  const { data: selectedLead } = useQuery({
    queryKey: ["leads", tenantId, "detail", selectedId],
    enabled: Boolean(tenantId && selectedId),
    queryFn: async () => {
      if (!tenantId || !selectedId) return null;
      const { data, error } = await supabase.from("leads").select("*").eq("tenant_id", tenantId).eq("id", selectedId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", tenantId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: members = [] } = useMembers(tenantId);
  const dups = useMemo(() => duplicateIds(leads), [leads]);
  const [dupOnly, setDupOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const viewKey = `salesos.leadViews.${tenantId}`;
  const [views, setViews] = useState<{ name: string; search: string; status: string; dupOnly: boolean }[]>([]);
  useEffect(() => {
    if (!tenantId) return;
    try { setViews(JSON.parse(localStorage.getItem(viewKey) || "[]")); } catch { setViews([]); }
  }, [tenantId, viewKey]);
  function saveView() {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const next = [...views.filter((v) => v.name !== name.trim()), { name: name.trim(), search, status: statusFilter, dupOnly }];
    setViews(next);
    localStorage.setItem(viewKey, JSON.stringify(next));
    toast.success("View saved");
  }
  const bulk = useMutation({
    mutationFn: async (patch: { owner_id?: string; status?: Status }) => {
      const { error } = await supabase.from("leads").update(patch).in("id", [...selected]);
      if (error) throw error;
    },
    onSuccess: () => { setSelected(new Set()); toast.success("Leads updated"); void qc.invalidateQueries({ queryKey: ["leads", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = leads.filter((l) => {
    if (dupOnly && !dups.has(l.id)) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [l.full_name, l.email, l.phone, l.source, ...l.tags].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry with its source, status, score, owner and next action."
        actions={
          tenantId && user ? (
            <div className="flex flex-wrap gap-2">
            <ExportImport rows={filtered} tenantId={tenantId} userId={user.id} canImport={canCreate}
              onImported={() => void qc.invalidateQueries({ queryKey: ["leads", tenantId] })} />
            {canCreate && <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 size-4" /> New lead
                </Button>
              </DialogTrigger>
              <NewLeadDialog
                tenantId={tenantId}
                userId={user.id}
                onDone={() => {
                  setOpen(false);
                  void qc.invalidateQueries({ queryKey: ["leads", tenantId] });
                }}
              />
            </Dialog>}
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, email, phone, source, tag"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | Status)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={dupOnly ? "default" : "outline"} onClick={() => setDupOnly(!dupOnly)}>
          Possible duplicates ({dups.size})
        </Button>
        {views.length > 0 && (
          <Select value="" onValueChange={(n) => { const v = views.find((x) => x.name === n); if (v) { setSearch(v.search); setStatusFilter(v.status as "all" | Status); setDupOnly(v.dupOnly); } }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Saved views" /></SelectTrigger>
            <SelectContent>{views.map((v) => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Button variant="ghost" onClick={saveView}>Save view</Button>
      </div>

      {canCreate && (
        <BulkBar count={selected.size} members={members} canAssign={allows("records.assign")} statuses={STATUSES}
          onAssign={(id) => bulk.mutate({ owner_id: id })} onStatus={(s) => bulk.mutate({ status: s as Status })}
          onClear={() => setSelected(new Set())} />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 px-4 py-3">
                <input type="checkbox" aria-label="Select all" checked={filtered.length > 0 && filtered.every((l) => selected.has(l.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())} />
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3">Age</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No leads yet.
                </td>
              </tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <input type="checkbox" aria-label={`Select ${l.full_name}`} checked={selected.has(l.id)}
                    onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setSelectedId(l.id)} className="font-medium text-primary hover:underline">{l.full_name}</button>
                  {dups.has(l.id) && <Badge variant="destructive" className="ml-2 text-[10px]">Possible duplicate</Badge>}
                  <div className="text-xs text-muted-foreground">{l.email ?? l.phone ?? "—"}</div>
                  {l.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{l.source}</td>
                <td className="px-4 py-3">
                  <Select
                    value={l.status}
                    onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as Status })}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">{l.score ?? "—"}</td>
                <td className="px-4 py-3">
                  {l.next_action ?? <span className="text-muted-foreground">None</span>}
                  {l.next_action_at && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(l.next_action_at).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{daysSince(l.created_at)}d</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>Showing {leads.length} of {totalLeads} leads</span>
          {leads.length < totalLeads && (
            <Button size="sm" variant="outline" onClick={() => setPageLimit((n) => n + 200)}>Load more</Button>
          )}
        </div>
      </div>
      {tenantId && (
        <LeadDetail
          lead={selectedLead ?? leads.find((l) => l.id === selectedId) ?? null}
          tenantId={tenantId}
          canEdit={canCreate}
          canAssign={allows("records.assign")}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function NewLeadDialog({
  tenantId,
  userId,
  onDone,
}: {
  tenantId: string;
  userId: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    source: "manual",
    tags: "",
    next_action: "",
    next_action_at: "",
  });
  const [saving, setSaving] = useState(false);
  const { currentTenant } = useTenant();
  const { data: cfg } = useWorkspaceConfig(tenantId, currentTenant?.industry);
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error("Name is required"); return; }
    let custom_fields: Record<string, unknown> = {};
    try { custom_fields = cleanCustomValues(cfg?.fields ?? [], custom); } catch (err) { toast.error((err as Error).message); return; }
    const s = scoreLead({ full_name: form.full_name, email: form.email, phone: form.phone, source: form.source }, cfg?.scoring);
    setSaving(true);
    const { error } = await (supabase as any).from("leads").insert({
      custom_fields,
      score: s.total,
      tenant_id: tenantId,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      source: form.source.trim() || "manual",
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      next_action: form.next_action.trim() || null,
      next_action_at: form.next_action_at ? new Date(form.next_action_at).toISOString() : null,
      owner_id: userId,
      created_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead added");
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New lead</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label>Full name</Label>
          <Input value={form.full_name} onChange={set("full_name")} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Source</Label>
            <Input value={form.source} onChange={set("source")} />
          </div>
          <div className="space-y-1">
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags} onChange={set("tags")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Next action</Label>
            <Input value={form.next_action} onChange={set("next_action")} />
          </div>
          <div className="space-y-1">
            <Label>Due</Label>
            <Input type="date" value={form.next_action_at} onChange={set("next_action_at")} />
          </div>
        </div>
        <CustomFieldInputs fields={cfg?.fields ?? []} values={custom} onChange={setCustom} />
        <p className="text-xs text-muted-foreground">The score is calculated from your workspace's scoring rules.</p>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add lead"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
