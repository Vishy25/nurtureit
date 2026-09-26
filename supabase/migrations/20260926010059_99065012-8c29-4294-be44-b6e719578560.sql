CREATE TYPE public.lead_status AS ENUM ('new','accepted','nurturing','disqualified','converted');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'manual',
  status public.lead_status NOT NULL DEFAULT 'new',
  score integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  owner_id uuid,
  tags text[] NOT NULL DEFAULT '{}',
  next_action text,
  next_action_at timestamptz,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_tenant_created_idx ON public.leads (tenant_id, created_at DESC);
CREATE INDEX leads_tenant_owner_idx ON public.leads (tenant_id, owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING (
  public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator','analyst']::public.app_role[])
  OR (public.is_tenant_member(tenant_id) AND (owner_id = auth.uid() OR created_by = auth.uid()))
);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::public.app_role[])
);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING (
  public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[])
  OR (public.has_tenant_role(tenant_id, ARRAY['sales_rep','ops_coordinator']::public.app_role[]) AND (owner_id = auth.uid() OR created_by = auth.uid()))
) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING (
  public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
);

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();