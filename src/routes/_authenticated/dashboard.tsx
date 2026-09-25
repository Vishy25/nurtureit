import { createFileRoute } from "@tanstack/react-router";
import { useTenant } from "@/lib/tenant-context";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, PERMISSION_MATRIX } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesOS" },
      { name: "description", content: "Your SalesOS workspace overview: pipeline health, intake and follow-up." },
      { property: "og:title", content: "Dashboard — SalesOS" },
      { property: "og:description", content: "Your SalesOS workspace overview." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { currentTenant, role } = useTenant();

  return (
    <>
      <PageHeader
        title={currentTenant ? currentTenant.name : "Dashboard"}
        description="Foundation is live: accounts, workspaces, roles and data isolation. Sales metrics arrive with the core workflow milestone."
        actions={currentTenant?.isDemo ? <Badge variant="secondary">Sample data</Badge> : null}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workspace</CardDescription>
            <CardTitle className="font-display text-lg">{currentTenant?.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Industry template: {currentTenant?.industry.replace("_", " ")} · Currency{" "}
            {currentTenant?.defaultCurrency}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your role</CardDescription>
            <CardTitle className="font-display text-lg">{role ? ROLE_LABELS[role] : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {role ? `${PERMISSION_MATRIX[role].length} permissions granted in this workspace.` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Data isolation</CardDescription>
            <CardTitle className="font-display text-lg">Enforced in the database</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every record carries a workspace identifier, checked by row-level security on every read
            and write.
          </CardContent>
        </Card>
      </div>

      <MilestonePlaceholder
        milestone="Milestone 2 · Core workflow"
        title="Sales metrics will appear here"
        bullets={[
          "Intake and qualified-lead rates by source",
          "Time to first contact and overdue follow-ups",
          "Lead-to-opportunity and opportunity-to-win conversion",
          "Open and weighted pipeline, expected and realized brokerage revenue",
        ]}
      />
    </>
  );
}
