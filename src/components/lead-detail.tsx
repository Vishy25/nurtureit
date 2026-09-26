import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Attachments } from "@/components/attachments";
import { AiLeadAssistant } from "@/components/ai-lead-assistant";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function LeadDetail({
  lead,
  tenantId,
  canEdit,
  canAssign,
  onClose,
}: {
  lead: Lead | null;
  tenantId: string;
  canEdit: boolean;
  canAssign: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ score: "", notes: "", next_action: "", next_action_at: "", owner_id: "", tags: "" });
  const [convert, setConvert] = useState({ open: false, name: "", value: "", close: "" });

  useEffect(() => {
    if (!lead) return;
    setForm({
      score: lead.score?.toString() ?? "",
      notes: lead.notes ?? "",
      next_action: lead.next_action ?? "",
      next_action_at: lead.next_action_at ? lead.next_action_at.slice(0, 10) : "",
      owner_id: lead.owner_id ?? "",
      tags: lead.tags.join(", "),
    });
    setConvert({ open: false, name: lead.full_name, value: "", close: "" });
  }, [lead]);

  const { data: members = [] } = useQuery({
    queryKey: ["members-lite", tenantId],
    enabled: canAssign,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id, profiles(full_name, email)")
        .eq("tenant_id", tenantId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const score = form.score === "" ? null : Number(form.score);
      if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) throw new Error("Score must be 0–100");
      const patch: Database["public"]["Tables"]["leads"]["Update"] = {
        score,
        notes: form.notes.trim() || null,
        next_action: form.next_action.trim() || null,
        next_action_at: form.next_action_at ? new Date(form.next_action_at).toISOString() : null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (canAssign && form.owner_id) patch.owner_id = form.owner_id;
      const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      void qc.invalidateQueries({ queryKey: ["leads", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doConvert = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const args: { _lead_id: string; _deal_name: string; _value?: number; _expected_close?: string } = {
        _lead_id: lead.id,
        _deal_name: convert.name,
      };
      if (convert.value) args._value = Number(convert.value);
      if (convert.close) args._expected_close = convert.close;
      const { error } = await supabase.rpc("convert_lead", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead converted to contact and deal");
      void qc.invalidateQueries({ queryKey: ["leads", tenantId] });
      onClose();
      void navigate({ to: "/pipeline" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertible = lead && lead.status !== "converted" && lead.status !== "disqualified";

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.full_name}</SheetTitle>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize">{lead.status}</Badge>
                <span>{lead.email ?? "—"}</span>
                <span>{lead.phone ?? ""}</span>
                <span className="capitalize">Source: {lead.source}</span>
              </div>
            </SheetHeader>

            <form
              className="mt-6 space-y-4 px-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <fieldset disabled={!canEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Score (0–100)</Label>
                    <Input type="number" min={0} max={100} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Owner</Label>
                    {canAssign ? (
                      <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="pt-2 text-sm text-muted-foreground">Only managers can reassign</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Qualification notes</Label>
                  <Textarea rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Budget, timeline, needs, decision makers…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Next action</Label>
                    <Input value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Due</Label>
                    <Input type="date" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Tags (comma separated)</Label>
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                </div>
                {canEdit && <Button type="submit" disabled={save.isPending}>Save changes</Button>}
              </fieldset>
            </form>

            {canEdit && convertible && (
              <div className="mx-4 mt-8 space-y-3 rounded-lg border border-border p-4">
                <h3 className="font-medium">Convert to deal</h3>
                <p className="text-sm text-muted-foreground">Creates a contact and an opportunity in Qualification, and marks this lead converted.</p>
                {!convert.open ? (
                  <Button variant="secondary" onClick={() => setConvert({ ...convert, open: true })}>Convert lead</Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Deal name</Label>
                      <Input value={convert.name} onChange={(e) => setConvert({ ...convert, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Value</Label>
                        <Input type="number" min={0} value={convert.value} onChange={(e) => setConvert({ ...convert, value: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected close</Label>
                        <Input type="date" value={convert.close} onChange={(e) => setConvert({ ...convert, close: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => doConvert.mutate()} disabled={doConvert.isPending}>Confirm conversion</Button>
                      <Button variant="ghost" onClick={() => setConvert({ ...convert, open: false })}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 border-t pt-4">
              <AiLeadAssistant leadId={lead.id} tenantId={tenantId} canAct={canEdit} />
            </div>
            <div className="mt-6 border-t pt-4">
              <Attachments tenantId={tenantId} entityType="lead" entityId={lead.id} canUpload={canEdit} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
