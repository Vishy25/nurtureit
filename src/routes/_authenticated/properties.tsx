import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "Properties — SalesOS" },
      { name: "description", content: "Property and offering catalog with availability, pricing and amenities." },
      { property: "og:title", content: "Properties — SalesOS" },
      { property: "og:description", content: "Property and offering catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertiesPage,
});

const TYPES = ["apartment", "villa", "plot", "townhouse", "commercial", "other"];
const STATUSES = ["available", "reserved", "sold", "off_market"];
const label = (s: string) => s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase());
const inputCls = "rounded-md border bg-background px-3 py-2 text-sm";

function PropertiesPage() {
  const { currentTenant, role } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.tenantId;
  const canEdit = role === "tenant_admin" || role === "sales_manager" || role === "ops_coordinator";
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", project: "", location: "", property_type: "apartment", area_sqft: "", bedrooms: "", price: "", amenities: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["properties", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["properties", tenantId] });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").insert({
        tenant_id: tenantId!,
        title: form.title.trim(),
        project: form.project.trim() || null,
        location: form.location.trim() || null,
        property_type: form.property_type,
        area_sqft: num(form.area_sqft),
        bedrooms: num(form.bedrooms),
        price: num(form.price),
        currency: currentTenant?.defaultCurrency ?? "USD",
        amenities: form.amenities.split(",").map((a) => a.trim()).filter(Boolean),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ title: "", project: "", location: "", property_type: "apartment", area_sqft: "", bedrooms: "", price: "", amenities: "" });
      toast.success("Property added");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("properties").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const term = q.toLowerCase();
  const visible = rows.filter(
    (r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (!term || [r.title, r.project, r.location].some((f) => f?.toLowerCase().includes(term))),
  );
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Properties and offerings" description="The catalog behind shortlists, matching and deals." />
      {canEdit && (
        <form
          className="mb-6 grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.title.trim()) create.mutate();
          }}
        >
          <input className={`${inputCls} sm:col-span-2`} placeholder="Title (e.g. Unit 12B)" value={form.title} onChange={set("title")} />
          <input className={inputCls} placeholder="Project" value={form.project} onChange={set("project")} />
          <input className={inputCls} placeholder="Location" value={form.location} onChange={set("location")} />
          <select className={inputCls} value={form.property_type} onChange={set("property_type")}>
            {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
          <input className={inputCls} type="number" min="0" placeholder="Area (sq ft)" value={form.area_sqft} onChange={set("area_sqft")} />
          <input className={inputCls} type="number" min="0" placeholder="Bedrooms" value={form.bedrooms} onChange={set("bedrooms")} />
          <input className={inputCls} type="number" min="0" placeholder={`Price (${currentTenant?.defaultCurrency ?? "USD"})`} value={form.price} onChange={set("price")} />
          <input className={`${inputCls} sm:col-span-3`} placeholder="Amenities, comma separated" value={form.amenities} onChange={set("amenities")} />
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!form.title.trim() || create.isPending}>
            Add property
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} min-w-60 flex-1`} placeholder="Search title, project or location" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Property</th><th className="p-3">Type</th><th className="p-3">Area</th>
              <th className="p-3">Beds</th><th className="p-3">Price</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={6} className="p-4 text-muted-foreground">Loading…</td></tr>}
            {!isLoading && visible.length === 0 && <tr><td colSpan={6} className="p-4 text-muted-foreground">No properties yet.</td></tr>}
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="p-3">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{[r.project, r.location].filter(Boolean).join(" · ")}</p>
                  {r.amenities.length > 0 && <p className="text-xs text-muted-foreground">{r.amenities.join(", ")}</p>}
                </td>
                <td className="p-3">{label(r.property_type)}</td>
                <td className="p-3">{r.area_sqft ? `${Number(r.area_sqft).toLocaleString()} sq ft` : "—"}</td>
                <td className="p-3">{r.bedrooms ?? "—"}</td>
                <td className="p-3">{r.price != null ? `${r.currency} ${Number(r.price).toLocaleString()}` : "—"}</td>
                <td className="p-3">
                  {canEdit ? (
                    <select className="rounded border bg-background px-2 py-1 text-xs" value={r.status} onChange={(e) => setStatus.mutate({ id: r.id, status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  ) : label(r.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
