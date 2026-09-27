CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON public.leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON public.leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_owner ON public.leads(tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON public.contacts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opps_tenant_stage ON public.opportunities(tenant_id, stage, state);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee_due ON public.tasks(tenant_id, assignee_id, due_at);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_occurred ON public.activities(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON public.audit_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_tenant_created ON public.ai_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_events_tenant_received ON public.intake_events(tenant_id, received_at DESC);

CREATE TABLE public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  revenue_target numeric NOT NULL DEFAULT 0,
  deals_target integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;
GRANT ALL ON public.sales_targets TO service_role;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view targets" ON public.sales_targets FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "managers write targets" ON public.sales_targets FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]));

CREATE TABLE public.forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  open_value numeric NOT NULL DEFAULT 0,
  weighted_value numeric NOT NULL DEFAULT 0,
  won_value_month numeric NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.forecast_snapshots TO authenticated;
GRANT ALL ON public.forecast_snapshots TO service_role;
ALTER TABLE public.forecast_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view snapshots" ON public.forecast_snapshots FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "managers take snapshots" ON public.forecast_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','analyst']::app_role[]));