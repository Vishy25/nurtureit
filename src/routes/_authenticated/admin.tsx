import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/members", label: "People & roles" },
  { to: "/admin/workspaces", label: "Workspaces" },
  { to: "/admin/audit", label: "Audit history" },
  { to: "/admin/settings", label: "Workspace settings" },
  { to: "/admin/customize", label: "Customize" },
  { to: "/admin/ai", label: "AI assistant" },
] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <PageHeader
        title="Administration"
        description="Workspace membership, roles, configuration and audit history."
      />
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              pathname === t.to
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </>
  );
}
