import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncNotes, useOfflineQueue } from "@/lib/offline-queue";
import { Badge } from "@/components/ui/badge";

// Sends uncaught browser errors to app_errors (max 20 per page load) so admins can see them in Monitoring.
export function ErrorReporter({ tenantId }: { tenantId: string | null }) {
  useEffect(() => {
    let sent = 0;
    const seen = new Set<string>();
    const report = (message: string, stack?: string) => {
      if (sent >= 20 || !message || seen.has(message)) return;
      seen.add(message); sent++;
      void supabase.from("app_errors").insert({ tenant_id: tenantId, message: message.slice(0, 1000), stack: stack?.slice(0, 4000) ?? null, page: location.pathname.slice(0, 500) });
    };
    const onErr = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRej = (e: PromiseRejectionEvent) => report(String(e.reason?.message ?? e.reason), e.reason?.stack);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, [tenantId]);
  return null;
}

export function OfflineBadge() {
  const { pending, online } = useOfflineQueue();
  useEffect(() => { if (online && pending.length) void syncNotes(); }, [online, pending.length]);
  if (online && pending.length === 0) return null;
  return (
    <Badge variant={online ? "secondary" : "destructive"}>
      {online ? `Syncing ${pending.length} note${pending.length === 1 ? "" : "s"}…` : `Offline${pending.length ? ` · ${pending.length} to sync` : ""}`}
    </Badge>
  );
}
