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

export function useOfflineQueue() {
  const [pending, setPending] = useState<QueuedNote[]>([]);
  const [online, setOnline] = useState(true);
  const refresh = useCallback(() => setPending(read()), []);
  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void syncNotes(); };
    const off = () => setOnline(false);
    window.addEventListener(EVT, refresh);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener(EVT, refresh); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [refresh]);
  return { pending, online };
}
