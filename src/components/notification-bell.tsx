import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type N = { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export function NotificationBell({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const sb = supabase as any;
  const key = ["notifications", tenantId];

  const { data: items = [] } = useQuery({
    queryKey: key,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await sb.from("notifications").select("id, kind, title, body, link, read_at, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as N[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`notif-${tenantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `tenant_id=eq.${tenantId}` }, () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const unread = items.filter((n) => !n.read_at);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}>
          <Bell className="size-5" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => markRead.mutate(unread.map((n) => n.id))}>Mark all read</Button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">You're all caught up.</p>}
          {items.map((n) => (
            <button
              key={n.id}
              className={cn("block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted", !n.read_at && "bg-accent/40")}
              onClick={() => { markRead.mutate([n.id]); if (n.link?.startsWith("/")) router.history.push(n.link); }}
            >
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
              {n.kind === "ai_suggestion" && <p className="text-xs font-medium text-primary">Review suggestion →</p>}
              <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
