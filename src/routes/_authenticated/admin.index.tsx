import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Minus } from "lucide-react";
import { PERMISSION_MATRIX, ROLE_LABELS, type AppRole, type Permission } from "@/lib/permissions";
import { MilestonePlaceholder } from "@/components/page-header";

const ROLES = Object.keys(ROLE_LABELS) as AppRole[];

const PERMISSION_LABELS: Record<Permission, string> = {
  "records.view.own": "View own records",
  "records.view.team": "View team records",
  "records.view.tenant": "View all workspace records",
  "records.edit.own": "Edit own records",
  "records.edit.team": "Edit team records",
  "records.assign": "Assign owners",
  "records.delete": "Delete records",
  "pipeline.manage": "Manage pipeline & approvals",
  "operations.manage": "Manage appointments & closure tasks",
  "reports.view": "View reports",
  "data.export": "Export data",
  "config.manage": "Change configuration",
  "members.manage": "Manage people & roles",
  "integrations.manage": "Manage integrations",
  "audit.view": "View audit history",
};

const PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — SalesOS" },
      { name: "description", content: "Roles, permissions and workspace configuration in SalesOS." },
      { property: "og:title", content: "Administration — SalesOS" },
      { property: "og:description", content: "Roles, permissions and workspace configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Permission matrix</CardTitle>
          <CardDescription>
            The interface follows this matrix; the database enforces the same boundaries on every
            read and write, so these limits also apply to direct API calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Capability</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r} className="text-center text-xs">
                    {ROLE_LABELS[r]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((p) => (
                <TableRow key={p}>
                  <TableCell className="text-sm">{PERMISSION_LABELS[p]}</TableCell>
                  {ROLES.map((r) => (
                    <TableCell key={r} className="text-center">
                      {PERMISSION_MATRIX[r].includes(p) ? (
                        <Check className="mx-auto size-4 text-success" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground/50" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MilestonePlaceholder
        milestone="Milestone 5 · Configuration"
        title="Industry configuration tools"
        bullets={[
          "Industry templates, display terminology and typed custom fields",
          "Pipelines with stage requirements, checklists and probabilities",
          "Scoring rules, assignment policies and notification templates",
          "Template versioning with safe stage mapping on removal",
        ]}
      />
    </div>
  );
}
