import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Browser-local queue for activity notes written while offline. Each entry keeps a
// client-generated id so a retried sync never inserts the same note twice.
export type QueuedNote = {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  organization_id: string | null;
  kind: string;
  summary: string;
  occurred_at: string;
  created_by: string;
};

const KEY = "salesos.offlineNotes";
const EVT = "salesos-offline-queue";

function read(): QueuedNote[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(q: QueuedNote[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new Event(EVT));
}

export function queueNote(n: Omit<QueuedNote, "id" | "occurred_at">) {
  write([...read(), { ...n, id: crypto.randomUUID(), occurred_at: new Date().toISOString() }]);
}

let syncing = false;
export async function syncNotes(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let done = 0;
  try {
    for (const n of read()) {
      // upsert on primary key: safe to repeat if a previous attempt succeeded silently
      const { error } = await supabase.from("activities").upsert(n, { onConflict: "id", ignoreDuplicates: true });
      if (error) break;
      write(read().filter((x) => x.id !== n.id));
      done++;
    }
  } finally { syncing = false; }
  return done;
}

// Generic queue for task and site-visit changes made offline. Inserts carry a
// client-generated id (upsert ignores repeats); updates are idempotent patches.
export type QueuedOp = {
  id: string;
  table: "tasks" | "site_visits";
  op: "insert" | "update";
  target_id?: string;
  row: Record<string, unknown>;
  queued_at: string;
};
const OPS_KEY = "salesos.offlineOps";

function readOps(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(OPS_KEY) || "[]"); } catch { return []; }
}
function writeOps(q: QueuedOp[]) {
  localStorage.setItem(OPS_KEY, JSON.stringify(q));
  window.dispatchEvent(new Event(EVT));
}
export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
export function queueOp(o: Omit<QueuedOp, "id" | "queued_at">) {
  const id = crypto.randomUUID();
  const row = o.op === "insert" ? { id, ...o.row } : o.row;
  writeOps([...readOps(), { ...o, row, id, queued_at: new Date().toISOString() }]);
}

let syncingOps = false;
export async function syncOps(): Promise<number> {
  if (syncingOps || !navigator.onLine) return 0;
  syncingOps = true;
  let done = 0;
  try {
    for (const o of readOps()) {
      const q = supabase.from(o.table);
      const { error } = o.op === "insert"
        ? await q.upsert(o.row as never, { onConflict: "id", ignoreDuplicates: true })
        : await q.update(o.row as never).eq("id", o.target_id!);
      if (error) {
        // permanent rejection (e.g. permissions): drop it so the queue doesn't stall
        if (error.code && error.code !== "PGRST301" && !/fetch|network/i.test(error.message)) {
          writeOps(readOps().filter((x) => x.id !== o.id));
          continue;
        }
        break;
      }
      writeOps(readOps().filter((x) => x.id !== o.id));
      done++;
    }
  } finally { syncingOps = false; }
  return done;
}

export function useOfflineQueue() {
  const [pending, setPending] = useState<QueuedNote[]>([]);
  const [ops, setOps] = useState<QueuedOp[]>([]);
  const [online, setOnline] = useState(true);
  const refresh = useCallback(() => { setPending(read()); setOps(readOps()); }, []);
  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);
    if (navigator.onLine) { void syncNotes(); void syncOps(); }
    const on = () => { setOnline(true); void syncNotes(); void syncOps(); };
    const off = () => setOnline(false);
    window.addEventListener(EVT, refresh);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener(EVT, refresh); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [refresh]);
  return { pending, ops, online };
}
