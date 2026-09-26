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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts & organizations — SalesOS" },
      { name: "description", content: "People and organizations with a unified activity history." },
      { property: "og:title", content: "Contacts & organizations — SalesOS" },
      { property: "og:description", content: "People and organizations with a unified history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

const KINDS = ["note", "call", "email", "message", "meeting", "visit"] as const;

function useOrgs(tenantId?: string) {
  return useQuery({
    queryKey: ["organizations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("tenant_id", tenantId!).order("name").limit(500);
      if (error) throw error;
      return data;
    },
  });
}

function ContactsPage() {
  const { currentTenant, allows } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.tenantId;
  const canEdit = allows("records.edit.own");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ type: "contact" | "org"; id: string; name: string } | null>(null);
  const orgs = useOrgs(tenantId);
  const contacts = useQuery({
    queryKey: ["contacts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, organizations(name)").eq("tenant_id", tenantId!).order("full_name").limit(500);
      if (error) throw error;
      return data;
    },
  });
  const q = search.trim().toLowerCase();
  const match = (...v: (string | null | undefined)[]) => !q || v.some((x) => x?.toLowerCase().includes(q));

  return (
    <>
      <PageHeader
        title="Contacts and organizations"
        description="People, the organizations they belong to, their communication preferences and full history."
        actions={canEdit && tenantId && user ? (
          <div className="flex gap-2">
            <NewOrgButton tenantId={tenantId} userId={user.id} />
            <NewContactButton tenantId={tenantId} userId={user.id} orgs={orgs.data ?? []} />
          </div>
        ) : null}
      />
      <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts ({contacts.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="orgs">Organizations ({orgs.data?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Preferred channel</th><th className="px-4 py-3">Consent</th></tr>
              </thead>
              <tbody>
                {contacts.data?.filter((c) => match(c.full_name, c.email, c.phone, c.organizations?.name)).map((c) => (
                  <tr key={c.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/50" onClick={() => setSelected({ type: "contact", id: c.id, name: c.full_name })}>
                    <td className="px-4 py-3"><div className="font-medium">{c.full_name}</div><div className="text-xs text-muted-foreground">{c.title ?? c.email ?? c.phone ?? "—"}</div></td>
                    <td className="px-4 py-3">{c.organizations?.name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{c.preferred_channel}</td>
                    <td className="px-4 py-3">{c.marketing_consent ? <Badge variant="secondary">Opted in{c.consent_source ? ` · ${c.consent_source}` : ""}</Badge> : <span className="text-muted-foreground">No</span>}</td>
                  </tr>
                ))}
                {contacts.data?.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No contacts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="orgs">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Industry</th><th className="px-4 py-3">Contacts</th></tr>
              </thead>
              <tbody>
                {orgs.data?.filter((o) => match(o.name, o.industry, o.website)).map((o) => (
                  <tr key={o.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/50" onClick={() => setSelected({ type: "org", id: o.id, name: o.name })}>
                    <td className="px-4 py-3"><div className="font-medium">{o.name}</div><div className="text-xs text-muted-foreground">{o.website ?? o.phone ?? ""}</div></td>
                    <td className="px-4 py-3">{o.industry ?? "—"}</td>
                    <td className="px-4 py-3">{contacts.data?.filter((c) => c.organization_id === o.id).length ?? 0}</td>
                  </tr>
                ))}
                {orgs.data?.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No organizations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && tenantId && user && (
            <>
              <SheetHeader><SheetTitle>{selected.name}</SheetTitle></SheetHeader>
              <Timeline tenantId={tenantId} userId={user.id} target={selected} canEdit={canEdit} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Timeline({ tenantId, userId, target, canEdit }: { tenantId: string; userId: string; target: { type: "contact" | "org"; id: string }; canEdit: boolean }) {
  const qc = useQueryClient();
  const col = target.type === "contact" ? "contact_id" : "organization_id";
  const key = ["activities", col, target.id];
  const [kind, setKind] = useState<(typeof KINDS)[number]>("note");
  const [summary, setSummary] = useState("");
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let query = supabase.from("activities").select("*").eq("tenant_id", tenantId).order("occurred_at", { ascending: false }).limit(200);
      if (target.type === "contact") query = query.eq("contact_id", target.id);
      else {
        const { data: cs } = await supabase.from("contacts").select("id").eq("organization_id", target.id);
        const ids = (cs ?? []).map((c) => c.id);
        query = ids.length
          ? query.or(`organization_id.eq.${target.id},contact_id.in.(${ids.join(",")})`)
          : query.eq("organization_id", target.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("activities").insert({ tenant_id: tenantId, [col]: target.id, kind, summary: summary.trim(), created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => { setSummary(""); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-4 px-4">
      {canEdit && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (summary.trim()) add.mutate(); }}>
          <div className="flex gap-2">
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="submit" disabled={add.isPending}>Log</Button>
          </div>
          <Textarea placeholder="What happened?" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </form>
      )}
      <ol className="space-y-3">
        {data.map((a) => (
          <li key={a.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{a.kind}</Badge>
              <span>{new Date(a.occurred_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm">{a.summary}</p>
          </li>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
      </ol>
    </div>
  );
}

function NewOrgButton({ tenantId, userId }: { tenantId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", industry: "", website: "", phone: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations").insert({ tenant_id: tenantId, name: f.name.trim(), industry: f.industry || null, website: f.website || null, phone: f.phone || null, owner_id: userId, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Organization added"); setOpen(false); setF({ name: "", industry: "", website: "", phone: "" }); void qc.invalidateQueries({ queryKey: ["organizations", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 size-4" /> Organization</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New organization</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) save.mutate(); }}>
          {(["name", "industry", "website", "phone"] as const).map((k) => (
            <div key={k} className="space-y-1"><Label className="capitalize">{k}</Label><Input value={f[k]} required={k === "name"} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          <DialogFooter><Button type="submit" disabled={save.isPending}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewContactButton({ tenantId, userId, orgs }: { tenantId: string; userId: string; orgs: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = { full_name: "", email: "", phone: "", title: "", organization_id: "none", preferred_channel: "email", marketing_consent: "no", consent_source: "" };
  const [f, setF] = useState(empty);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").insert({
        tenant_id: tenantId, full_name: f.full_name.trim(), email: f.email || null, phone: f.phone || null, title: f.title || null,
        organization_id: f.organization_id === "none" ? null : f.organization_id, preferred_channel: f.preferred_channel,
        marketing_consent: f.marketing_consent === "yes", consent_source: f.consent_source || null, owner_id: userId, created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contact added"); setOpen(false); setF(empty); void qc.invalidateQueries({ queryKey: ["contacts", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const inp = (k: "full_name" | "email" | "phone" | "title" | "consent_source", label: string) => (
    <div className="space-y-1"><Label>{label}</Label><Input value={f[k]} required={k === "full_name"} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 size-4" /> Contact</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.full_name.trim()) save.mutate(); }}>
          {inp("full_name", "Full name")}
          <div className="grid grid-cols-2 gap-3">{inp("email", "Email")}{inp("phone", "Phone")}</div>
          <div className="grid grid-cols-2 gap-3">
            {inp("title", "Title")}
            <div className="space-y-1"><Label>Organization</Label>
              <Select value={f.organization_id} onValueChange={(v) => setF({ ...f, organization_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Channel</Label>
              <Select value={f.preferred_channel} onValueChange={(v) => setF({ ...f, preferred_channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["email", "phone", "sms", "whatsapp"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Marketing consent</Label>
              <Select value={f.marketing_consent} onValueChange={(v) => setF({ ...f, marketing_consent: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent>
              </Select>
            </div>
            {inp("consent_source", "Consent source")}
          </div>
          <DialogFooter><Button type="submit" disabled={save.isPending}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
