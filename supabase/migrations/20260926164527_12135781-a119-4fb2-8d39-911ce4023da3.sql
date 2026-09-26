CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  project text,
  location text,
  property_type text NOT NULL DEFAULT 'apartment',
  area_sqft numeric,
  bedrooms integer,
  price numeric,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'available',
  amenities text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_tenant_idx ON public.properties(tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view properties" ON public.properties FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "managers add properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator']::app_role[]) AND created_by = auth.uid());
CREATE POLICY "managers edit properties" ON public.properties FOR UPDATE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator']::app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator']::app_role[]));
CREATE POLICY "admins delete properties" ON public.properties FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();