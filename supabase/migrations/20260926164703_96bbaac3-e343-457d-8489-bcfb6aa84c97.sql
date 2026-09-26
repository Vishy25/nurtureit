CREATE TABLE public.buyer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  budget_min numeric, budget_max numeric,
  locations text[] NOT NULL DEFAULT '{}',
  property_types text[] NOT NULL DEFAULT '{}',
  min_bedrooms integer,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id)
);
CREATE TABLE public.shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'suggested',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, property_id)
);
CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  outcome text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'submitted',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['buyer_preferences','shortlists','site_visits','offers'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(tenant_id, contact_id)', t || '_tenant_idx', t);
    EXECUTE format('CREATE POLICY "members view" ON public.%I FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id))', t);
    EXECUTE format($p$CREATE POLICY "sellers add" ON public.%I FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]))$p$, t);
    EXECUTE format($p$CREATE POLICY "creator or manager edits" ON public.%I FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id) AND (created_by = auth.uid() OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator']::app_role[]))) WITH CHECK (public.is_tenant_member(tenant_id))$p$, t);
    EXECUTE format($p$CREATE POLICY "creator or admin deletes" ON public.%I FOR DELETE TO authenticated USING (public.is_tenant_member(tenant_id) AND (created_by = auth.uid() OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])))$p$, t);
  END LOOP;
END $$;
CREATE TRIGGER trg_buyer_prefs_updated BEFORE UPDATE ON public.buyer_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();