import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(500);
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

  const filtered = leads.filter((l) => {
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
          canCreate && tenantId && user ? (
            <Dialog open={open} onOpenChange={setOpen}>
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
            </Dialog>
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
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
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No leads yet.
                </td>
              </tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{l.full_name}</div>
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
      </div>
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
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
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
    if (error) return toast.error(error.message);
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
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add lead"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
