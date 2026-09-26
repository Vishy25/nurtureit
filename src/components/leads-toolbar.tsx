import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Lead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  score: number | null;
  tags: string[];
  next_action: string | null;
  created_at: string;
};

const COLS = ["full_name", "email", "phone", "source", "status", "score", "tags", "next_action", "created_at"] as const;

function esc(v: unknown) {
  const s = v == null ? "" : Array.isArray(v) ? v.join(";") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Lead[]) {
  return [COLS.join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\n");
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export function duplicateIds(leads: Lead[]) {
  const seen = new Map<string, string[]>();
  for (const l of leads) {
    for (const key of [l.email?.toLowerCase().trim(), l.phone?.replace(/\D/g, "")]) {
      if (!key || key.length < 5) continue;
      seen.set(key, [...(seen.get(key) ?? []), l.id]);
    }
  }
  const dup = new Set<string>();
  for (const ids of seen.values()) if (ids.length > 1) ids.forEach((id) => dup.add(id));
  return dup;
}

export function useMembers(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["members", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id, profiles(full_name, email)")
        .eq("tenant_id", tenantId!)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });
}

export function ExportImport({
  rows,
  tenantId,
  userId,
  canImport,
  onImported,
}: {
  rows: Lead[];
  tenantId: string;
  userId: string;
  canImport: boolean;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCsv(file: File) {
    const parsed = parseCsv(await file.text());
    const valid = parsed.filter((r) => (r.full_name || r.name)?.trim());
    if (valid.length === 0) { toast.error("No rows with a full_name column found"); return; }
    if (valid.length > 1000) { toast.error("Import up to 1000 rows at a time"); return; }
    const payload = valid.map((r) => {
      const score = r.score ? Number(r.score) : null;
      return {
        tenant_id: tenantId,
        full_name: (r.full_name || r.name).slice(0, 200),
        email: r.email || null,
        phone: r.phone || null,
        source: r.source || "csv_import",
        score: score != null && !Number.isNaN(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
        tags: (r.tags || "").split(/[;|]/).map((t) => t.trim()).filter(Boolean),
        next_action: r.next_action || null,
        owner_id: userId,
        created_by: userId,
      };
    });
    const { error } = await supabase.from("leads").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${payload.length} leads (${parsed.length - valid.length} skipped)`);
    onImported();
  }

  return (
    <>
      <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
        <Download className="mr-1 size-4" /> Export
      </Button>
      {canImport && (
        <>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 size-4" /> Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importCsv(f);
            }}
          />
        </>
      )}
    </>
  );
}

export function BulkBar({
  count,
  members,
  canAssign,
  statuses,
  onAssign,
  onStatus,
  onClear,
}: {
  count: number;
  members: { user_id: string; profiles: { full_name: string | null; email: string | null } | null }[];
  canAssign: boolean;
  statuses: readonly string[];
  onAssign: (userId: string) => void;
  onStatus: (s: string) => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm">
      <span className="font-medium">{count} selected</span>
      {canAssign && (
        <Select onValueChange={onAssign}>
          <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Assign to…" /></SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select onValueChange={onStatus}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Set status…" /></SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
    </div>
  );
}
