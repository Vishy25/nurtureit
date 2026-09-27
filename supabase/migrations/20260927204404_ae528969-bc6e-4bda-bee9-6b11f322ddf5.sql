CREATE TABLE public.config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  industry text,
  stage_labels jsonb,
  scoring_config jsonb,
  custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);
GRANT SELECT, INSERT ON public.config_versions TO authenticated;
GRANT ALL ON public.config_versions TO service_role;
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view config versions" ON public.config_versions FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "admins save config versions" ON public.config_versions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE TABLE public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message text NOT NULL CHECK (char_length(message) <= 1000),
  stack text CHECK (stack IS NULL OR char_length(stack) <= 4000),
  page text CHECK (page IS NULL OR char_length(page) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.app_errors(tenant_id, created_at DESC);
GRANT SELECT, INSERT ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users report own errors" ON public.app_errors FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (tenant_id IS NULL OR public.is_tenant_member(tenant_id)));
CREATE POLICY "admins view workspace errors" ON public.app_errors FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));