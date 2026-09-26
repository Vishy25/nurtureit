CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'follow_up',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  assignee_id uuid,
  notes text,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_status_chk CHECK (status IN ('open','done','cancelled')),
  CONSTRAINT tasks_kind_chk CHECK (kind IN ('follow_up','call','email','meeting','site_visit','other'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX tasks_tenant_due_idx ON public.tasks(tenant_id, status, due_at);

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (
  public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator','analyst']::app_role[])
  OR (public.is_tenant_member(tenant_id) AND (assignee_id = auth.uid() OR created_by = auth.uid())));
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (
  public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator']::app_role[])
  OR (public.has_tenant_role(tenant_id, ARRAY['sales_rep']::app_role[]) AND (assignee_id = auth.uid() OR created_by = auth.uid())))
  WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (
  public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]) OR created_by = auth.uid());

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();