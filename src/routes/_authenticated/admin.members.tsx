import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2 } from "lucide-react";

const ROLES = Object.keys(ROLE_LABELS) as AppRole[];

export const Route = createFileRoute("/_authenticated/admin/members")({
  head: () => ({
    meta: [
      { title: "People & roles — SalesOS" },
      { name: "description", content: "Invite colleagues, set roles and deactivate access in your workspace." },
      { property: "og:title", content: "People & roles — SalesOS" },
      { property: "og:description", content: "Invite colleagues and manage roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { currentTenant, allows } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.tenantId;
  const canManage = allows("members.manage");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales_rep");

  const members = useQuery({
    queryKey: ["members", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id, role, status, created_at, profiles(full_name, email)")
        .eq("tenant_id", tenantId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invites = useQuery({
    queryKey: ["invitations", tenantId],
    enabled: !!tenantId && canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, token, expires_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("invitations")
        .insert({ tenant_id: tenantId!, email: email.trim().toLowerCase(), role, invited_by: user!.id });
      if (error) throw error;
      await supabase.from("audit_events").insert({
        tenant_id: tenantId!,
        actor_id: user!.id,
        action: "invitation.created",
        entity_type: "invitation",
        metadata: { email: email.trim().toLowerCase(), role },
      });
    },
    onSuccess: () => {
      setEmail("");
      toast.success("Invitation created. Share the invitation code with them.");
      void qc.invalidateQueries({ queryKey: ["invitations", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMember = useMutation({
    mutationFn: async (patch: {
      id: string;
      role?: AppRole | undefined;
      status?: "active" | "deactivated" | undefined;
    }) => {
      const changes: { role?: AppRole; status?: "active" | "deactivated" } = {};
      if (patch.role) changes.role = patch.role;
      if (patch.status) changes.status = patch.status;
      const { error } = await supabase.from("memberships").update(changes).eq("id", patch.id);
      if (error) throw error;
      await supabase.from("audit_events").insert({
        tenant_id: tenantId!,
        actor_id: user!.id,
        action: patch.status ? "membership.status_changed" : "membership.role_changed",
        entity_type: "membership",
        entity_id: patch.id,
        metadata: patch,
      });
    },
    onSuccess: () => {
      toast.success("Membership updated.");
      void qc.invalidateQueries({ queryKey: ["members", tenantId] });
      void qc.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Invite someone</CardTitle>
            <CardDescription>
              Invitations are tied to the email address you enter and expire after 14 days. The
              person accepts with the invitation code from the Workspaces tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="w-56 space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send invitation
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">People in this workspace</CardTitle>
        </CardHeader>
        <CardContent>
          {members.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : members.error ? (
            <p className="text-sm text-destructive">Could not load people in this workspace.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members.data ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.profiles?.email ?? "—"}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) => updateMember.mutate({ id: m.id, role: v as AppRole })}
                        >
                          <SelectTrigger className="w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        ROLE_LABELS[m.role as AppRole]
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "secondary" : "outline"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={m.user_id === user?.id}
                          onClick={() =>
                            updateMember.mutate({
                              id: m.id,
                              status: m.status === "active" ? "deactivated" : "active",
                            })
                          }
                        >
                          {m.status === "active" ? "Deactivate" : "Reactivate"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Invitations</CardTitle>
            <CardDescription>
              Automatic invitation emails are not connected yet, so share the code directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (invites.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No invitations yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invitation code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invites.data ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{ROLE_LABELS[i.role as AppRole]}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{i.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(i.token);
                            toast.success("Invitation code copied.");
                          }}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
