import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks & calendar — SalesOS" },
      { name: "description", content: "Follow-ups, reminders, site visits and appointments." },
      { property: "og:title", content: "Tasks & calendar — SalesOS" },
      { property: "og:description", content: "Follow-ups, reminders and appointments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

const KINDS = ["follow_up", "call", "email", "meeting", "site_visit", "other"] as const;
type Filter = "mine" | "overdue" | "open" | "done";

function label(k: string) {
  return k.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

function TasksPage() {
  const { currentTenant, role } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.tenantId;
  const [filter, setFilter] = useState<Filter>("open");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("follow_up");
  const [due, setDue] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, kind, due_at, status, assignee_id, created_by, notes")
        .eq("tenant_id", tenantId!)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["task-templates", tenantId],
    enabled: !!tenantId,
    queryFn: async () => (await supabase.from("task_templates").select("id, title, kind, due_days").eq("tenant_id", tenantId!).order("title")).data ?? [],
  });
  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title); setKind(t.kind);
    const d = new Date(Date.now() + t.due_days * 86400000);
    setDue(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", tenantId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        tenant_id: tenantId!,
        title: title.trim(),
        kind,
        due_at: due ? new Date(due).toISOString() : null,
        assignee_id: user?.id ?? null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDue("");
      toast.success("Task added");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();
  const visible = tasks.filter((t) => {
    if (filter === "done") return t.status === "done";
    if (t.status !== "open") return false;
    if (filter === "mine") return t.assignee_id === user?.id;
    if (filter === "overdue") return !!t.due_at && new Date(t.due_at).getTime() < now;
    return true;
  });
  const overdueCount = tasks.filter(
    (t) => t.status === "open" && t.due_at && new Date(t.due_at).getTime() < now,
  ).length;
  const canCreate = role !== "analyst";

  return (
    <>
      <PageHeader
        title="Tasks and calendar"
        description="Follow-ups, reminders, site visits and appointments for you and your team."
      />
      {canCreate && (
        <form
          className="mb-6 flex flex-wrap gap-2 rounded-lg border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          {templates.length > 0 && (
            <select aria-label="Use a template" className="rounded-md border bg-background px-3 py-2 text-sm" value="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Use a template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
          <input
            className="min-w-60 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{label(k)}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={!title.trim() || create.isPending}
          >
            Add task
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(["open", "mine", "overdue", "done"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {f === "mine" ? "Assigned to me" : label(f)}
            {f === "overdue" && overdueCount > 0 ? ` (${overdueCount})` : ""}
          </button>
        ))}
      </div>

      <div className="divide-y rounded-lg border bg-card">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && visible.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No tasks here.</p>
        )}
        {visible.map((t) => {
          const overdue = t.status === "open" && t.due_at && new Date(t.due_at).getTime() < now;
          return (
            <div key={t.id} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={t.status === "done"}
                onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.checked ? "done" : "open" })}
                aria-label={`Mark ${t.title} done`}
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {label(t.kind)}
                  {t.due_at && (
                    <span className={overdue ? " font-medium text-destructive" : ""}>
                      {" · "}
                      {overdue ? "Overdue · " : "Due "}
                      {new Date(t.due_at).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              {t.status === "open" && (
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setStatus.mutate({ id: t.id, status: "cancelled" })}
                >
                  Cancel
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
