import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit history — SalesOS" },
      { name: "description", content: "Who changed what, and when, inside your workspace." },
      { property: "og:title", content: "Audit history — SalesOS" },
      { property: "og:description", content: "Who changed what, and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { currentTenant, allows } = useTenant();
  const tenantId = currentTenant?.tenantId;

  const events = useQuery({
    queryKey: ["audit", tenantId],
    enabled: !!tenantId && allows("audit.view"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, action, entity_type, entity_id, metadata, created_at, profiles:actor_id(full_name, email)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (!allows("audit.view")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Not available for your role</CardTitle>
          <CardDescription>
            Audit history is visible to workspace administrators and sales managers.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Recent activity</CardTitle>
        <CardDescription>The latest 100 recorded events in this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (events.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events.data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {e.profiles?.full_name ?? e.profiles?.email ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{e.action}</TableCell>
                  <TableCell className="text-muted-foreground">{e.entity_type ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
