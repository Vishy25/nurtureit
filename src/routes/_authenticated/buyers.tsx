import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { queueOp, isOffline, useOfflineQueue } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated/buyers")({
  head: () => ({
    meta: [
      { title: "Buyers & matching — SalesOS" },
      { name: "description", content: "Buyer requirements, property matches, shortlists, site visits and offers." },
      { property: "og:title", content: "Buyers & matching — SalesOS" },
      { property: "og:description", content: "Buyer requirements, shortlists, site visits and offers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyersPage,
});

const inputCls = "rounded-md border bg-background px-3 py-2 text-sm";
const label = (s: string) => s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase());
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const num = (v: string) => (v.trim() === "" ? null : Number(v));

type Property = {
  id: string; title: string; location: string | null; property_type: string;
  bedrooms: number | null; price: number | null; currency: string; status: string;
};

function BuyersPage() {
  const { ops: offlineOps } = useOfflineQueue();
  const { currentTenant, role } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.tenantId;
  const canWrite = role !== "analyst";
  const [contactId, setContactId] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-min", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, full_name").eq("tenant_id", tenantId!).order("full_name").limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("tenant_id", tenantId!).limit(500);
      if (error) throw error;
      return data as Property[];
    },
  });
  const buyerKey = ["buyer", tenantId, contactId];
  const { data: buyer } = useQuery({
    queryKey: buyerKey,
    enabled: !!tenantId && !!contactId,
    queryFn: async () => {
      const [p, s, v, o] = await Promise.all([
        supabase.from("buyer_preferences").select("*").eq("contact_id", contactId).maybeSingle(),
        supabase.from("shortlists").select("*").eq("contact_id", contactId).order("created_at"),
        supabase.from("site_visits").select("*").eq("contact_id", contactId).order("scheduled_at"),
        supabase.from("offers").select("*").eq("contact_id", contactId).order("created_at"),
      ]);
      const err = p.error ?? s.error ?? v.error ?? o.error;
      if (err) throw err;
      return { prefs: p.data, shortlist: s.data ?? [], visits: v.data ?? [], offers: o.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: buyerKey });
  const onError = (e: Error) => toast.error(e.message);
  const propName = (id: string) => properties.find((p) => p.id === id)?.title ?? "Property";

  type PrefForm = { budget_min: string; budget_max: string; locations: string; property_types: string; min_bedrooms: string };
  const [prefDraft, setPrefDraft] = useState<PrefForm | null>(null);
  const prefs = prefDraft ?? {
    budget_min: buyer?.prefs?.budget_min?.toString() ?? "",
    budget_max: buyer?.prefs?.budget_max?.toString() ?? "",
    locations: buyer?.prefs?.locations.join(", ") ?? "",
    property_types: buyer?.prefs?.property_types.join(", ") ?? "",
    min_bedrooms: buyer?.prefs?.min_bedrooms?.toString() ?? "",
  };
  const savePrefs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("buyer_preferences").upsert(
        {
          ...(buyer?.prefs ? { id: buyer.prefs.id } : {}),
          tenant_id: tenantId!, contact_id: contactId,
          budget_min: num(prefs.budget_min), budget_max: num(prefs.budget_max),
          locations: list(prefs.locations), property_types: list(prefs.property_types).map((t) => t.toLowerCase()),
          min_bedrooms: num(prefs.min_bedrooms), created_by: buyer?.prefs?.created_by ?? user!.id,
        },
        { onConflict: "contact_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => { setPrefDraft(null); toast.success("Requirements saved"); void refresh(); },
    onError,
  });

  // Transparent rule-based matching: every criterion is shown so the result is explainable.
  const p = buyer?.prefs;
  const matches = p
    ? properties
        .filter((x) => x.status === "available")
        .map((x) => {
          const reasons: string[] = [];
          let score = 0, checks = 0;
          const check = (active: boolean, ok: boolean, why: string) => {
            if (!active) return;
            checks++;
            if (ok) { score++; reasons.push(why); }
          };
          check(p.budget_max != null || p.budget_min != null, x.price != null && (p.budget_max == null || x.price <= p.budget_max) && (p.budget_min == null || x.price >= p.budget_min), "within budget");
          check(p.locations.length > 0, !!x.location && p.locations.some((l) => x.location!.toLowerCase().includes(l.toLowerCase())), "preferred location");
          check(p.property_types.length > 0, p.property_types.includes(x.property_type), "preferred type");
          check(p.min_bedrooms != null, x.bedrooms != null && x.bedrooms >= (p.min_bedrooms ?? 0), "enough bedrooms");
          return { x, score, checks, reasons };
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];

  const shortlistAdd = useMutation({
    mutationFn: async (propertyId: string) => {
      const { error } = await supabase.from("shortlists").insert({ tenant_id: tenantId!, contact_id: contactId, property_id: propertyId, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => void refresh(), onError,
  });
  const update = useMutation({
    mutationFn: async ({ table, id, patch }: { table: "shortlists" | "site_visits" | "offers"; id: string; patch: Record<string, string | null> }) => {
      if (table === "site_visits" && isOffline()) { queueOp({ table, op: "update", target_id: id, row: patch }); return "queued"; }
      const { error } = await supabase.from(table).update(patch as never).eq("id", id);
      if (error) throw error;
      return "saved";
    },
    onSuccess: (r) => { if (r === "queued") toast.info("Offline — visit update saved on this device and will sync automatically."); void refresh(); }, onError,
  });

  const [visit, setVisit] = useState({ property_id: "", scheduled_at: "" });
  const addVisit = useMutation({
    mutationFn: async () => {
      const row = { tenant_id: tenantId!, contact_id: contactId, property_id: visit.property_id, scheduled_at: new Date(visit.scheduled_at).toISOString(), created_by: user!.id };
      if (isOffline()) { queueOp({ table: "site_visits", op: "insert", row }); return "queued"; }
      const { error } = await supabase.from("site_visits").insert(row);
      if (error) throw error;
      return "saved";
    },
    onSuccess: (r) => { if (r === "queued") toast.info("Offline — visit saved on this device and will sync automatically."); setVisit({ property_id: "", scheduled_at: "" }); void refresh(); }, onError,
  });
  const [offer, setOffer] = useState({ property_id: "", amount: "" });
  const addOffer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("offers").insert({ tenant_id: tenantId!, contact_id: contactId, property_id: offer.property_id, amount: Number(offer.amount), currency: currentTenant?.defaultCurrency ?? "USD", created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setOffer({ property_id: "", amount: "" }); void refresh(); }, onError,
  });

  const shortlisted = new Set(buyer?.shortlist.map((s) => s.property_id));
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>
      {children}
    </section>
  );

  return (
    <>
      <PageHeader title="Buyers and matching" description="Capture what a buyer wants, match available properties, and track shortlists, visits and offers." />
      {offlineOps.some((o) => o.table === "site_visits") && <div className="mb-4 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">{offlineOps.filter((o) => o.table === "site_visits").length} site-visit change(s) waiting to sync.</div>}
      <select className={`${inputCls} mb-6 w-full max-w-md`} value={contactId} onChange={(e) => { setContactId(e.target.value); setPrefDraft(null); }}>
        <option value="">Choose a buyer (contact)…</option>
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </select>

      {!contactId ? (
        <p className="text-sm text-muted-foreground">Pick a contact to see their requirements and matches.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Requirements">
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["budget_min", "Min budget"], ["budget_max", "Max budget"],
                ["locations", "Locations, comma separated"], ["property_types", "Types (apartment, villa…)"],
                ["min_bedrooms", "Min bedrooms"],
              ] as const).map(([k, ph]) => (
                <input key={k} className={inputCls} placeholder={ph} disabled={!canWrite} value={prefs[k]} onChange={(e) => setPrefDraft({ ...prefs, [k]: e.target.value })} />
              ))}
              {canWrite && <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={savePrefs.isPending} onClick={() => savePrefs.mutate()}>Save requirements</button>}
            </div>
          </Section>

          <Section title="Matching available properties">
            {!p && <p className="text-sm text-muted-foreground">Save requirements to see matches.</p>}
            {p && matches.length === 0 && <p className="text-sm text-muted-foreground">No available property meets any requirement.</p>}
            <ul className="divide-y">
              {matches.slice(0, 10).map(({ x, score, checks, reasons }) => (
                <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{x.title} <span className="text-xs text-muted-foreground">· {score}/{checks} criteria</span></p>
                    <p className="text-xs text-muted-foreground">Matches: {reasons.join(", ")}</p>
                  </div>
                  {canWrite && (shortlisted.has(x.id)
                    ? <span className="text-xs text-muted-foreground">Shortlisted</span>
                    : <button className="text-xs font-medium text-primary hover:underline" onClick={() => shortlistAdd.mutate(x.id)}>Shortlist</button>)}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Shortlist">
            {buyer?.shortlist.length === 0 && <p className="text-sm text-muted-foreground">Nothing shortlisted yet.</p>}
            <ul className="divide-y">
              {buyer?.shortlist.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  {propName(s.property_id)}
                  <select className="rounded border bg-background px-2 py-1 text-xs" disabled={!canWrite} value={s.status} onChange={(e) => update.mutate({ table: "shortlists", id: s.id, patch: { status: e.target.value } })}>
                    {["suggested", "interested", "not_interested"].map((o) => <option key={o} value={o}>{label(o)}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Site visits">
            {canWrite && (
              <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (visit.property_id && visit.scheduled_at) addVisit.mutate(); }}>
                <PropertySelect value={visit.property_id} onChange={(v) => setVisit({ ...visit, property_id: v })} properties={properties} />
                <input type="datetime-local" className={inputCls} value={visit.scheduled_at} onChange={(e) => setVisit({ ...visit, scheduled_at: e.target.value })} />
                <button className="rounded-md border px-3 py-2 text-sm">Schedule</button>
              </form>
            )}
            <ul className="divide-y">
              {buyer?.visits.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="flex-1">{propName(v.property_id)} · {new Date(v.scheduled_at).toLocaleString()}</span>
                  <select className="rounded border bg-background px-2 py-1 text-xs" disabled={!canWrite} value={v.status} onChange={(e) => update.mutate({ table: "site_visits", id: v.id, patch: { status: e.target.value } })}>
                    {["scheduled", "completed", "no_show", "cancelled"].map((o) => <option key={o} value={o}>{label(o)}</option>)}
                  </select>
                  <input className="w-full rounded border bg-background px-2 py-1 text-xs" placeholder="Outcome notes" disabled={!canWrite} defaultValue={v.outcome ?? ""} onBlur={(e) => e.target.value !== (v.outcome ?? "") && update.mutate({ table: "site_visits", id: v.id, patch: { outcome: e.target.value || null } })} />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Offers">
            {canWrite && (
              <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (offer.property_id && offer.amount) addOffer.mutate(); }}>
                <PropertySelect value={offer.property_id} onChange={(v) => setOffer({ ...offer, property_id: v })} properties={properties} />
                <input type="number" min="0" className={inputCls} placeholder="Amount" value={offer.amount} onChange={(e) => setOffer({ ...offer, amount: e.target.value })} />
                <button className="rounded-md border px-3 py-2 text-sm">Record offer</button>
              </form>
            )}
            <ul className="divide-y">
              {buyer?.offers.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{propName(o.property_id)} · {o.currency} {Number(o.amount).toLocaleString()}</span>
                  <select className="rounded border bg-background px-2 py-1 text-xs" disabled={!canWrite} value={o.status} onChange={(e) => update.mutate({ table: "offers", id: o.id, patch: { status: e.target.value } })}>
                    {["submitted", "countered", "accepted", "rejected", "withdrawn"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </>
  );
}

function PropertySelect({ value, onChange, properties }: { value: string; onChange: (v: string) => void; properties: Property[] }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Property…</option>
      {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
  );
}
