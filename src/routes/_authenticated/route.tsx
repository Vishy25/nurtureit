import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { AppShell } from "@/components/app-shell";
import { CreateWorkspaceCard } from "@/components/create-workspace-card";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const { memberships, loading: tenantsLoading } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) return <FullScreenLoader />;
  if (tenantsLoading) return <FullScreenLoader />;

  if (memberships.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">Set up your first workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You are not a member of any workspace yet. Create one, or ask an administrator to invite
            you.
          </p>
        </div>
        <CreateWorkspaceCard />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
