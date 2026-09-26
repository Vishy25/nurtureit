ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_daily_run_limit integer NOT NULL DEFAULT 200;

CREATE TABLE public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  agent text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','blocked')),
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.ai_runs TO authenticated;
GRANT ALL ON public.ai_runs TO service_role;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_runs_select ON public.ai_runs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY ai_runs_insert ON public.ai_runs FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id) AND created_by = auth.uid());
CREATE POLICY ai_runs_update ON public.ai_runs FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id) AND created_by = auth.uid()) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE INDEX ai_runs_tenant_created ON public.ai_runs(tenant_id, created_at DESC);
CREATE INDEX ai_runs_lead ON public.ai_runs(lead_id);

CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ai_runs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','edited','dismissed')),
  feedback text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_rec_select ON public.ai_recommendations FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY ai_rec_insert ON public.ai_recommendations FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY ai_rec_update ON public.ai_recommendations FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::public.app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::public.app_role[]));
CREATE INDEX ai_rec_lead ON public.ai_recommendations(lead_id, created_at DESC);
CREATE INDEX ai_rec_tenant_status ON public.ai_recommendations(tenant_id, status);