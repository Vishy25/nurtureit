ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_autonomy text NOT NULL DEFAULT 'suggest';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL CHECK (size_bytes <= 10485760),
  content_type text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.attachments(tenant_id, entity_type, entity_id);
CREATE POLICY att_select ON public.attachments FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY att_insert ON public.attachments FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));
CREATE POLICY att_delete ON public.attachments FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "att objects read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'attachments' AND public.is_tenant_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "att objects write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'attachments' AND public.has_tenant_role(((storage.foldername(name))[1])::uuid, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));
CREATE POLICY "att objects delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'attachments' AND (owner = auth.uid() OR public.has_tenant_role(((storage.foldername(name))[1])::uuid, ARRAY['tenant_admin']::app_role[])));

CREATE TABLE public.intake_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.intake_credentials TO authenticated;
GRANT ALL ON public.intake_credentials TO service_role;
ALTER TABLE public.intake_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY ic_select ON public.intake_credentials FOR SELECT TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY ic_insert ON public.intake_credentials FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY ic_update ON public.intake_credentials FOR UPDATE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE TABLE public.intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credential_id uuid REFERENCES public.intake_credentials(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  error text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  attempts int NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ON public.intake_events(tenant_id, received_at DESC);
CREATE INDEX ON public.intake_events(credential_id, received_at DESC);
GRANT SELECT ON public.intake_events TO authenticated;
GRANT ALL ON public.intake_events TO service_role;
ALTER TABLE public.intake_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ie_select ON public.intake_events FOR SELECT TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator']::app_role[]));

CREATE TABLE public.lead_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score int NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'engine',
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_score_history(lead_id, created_at DESC);
GRANT SELECT, INSERT ON public.lead_score_history TO authenticated;
GRANT ALL ON public.lead_score_history TO service_role;
ALTER TABLE public.lead_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY lsh_select ON public.lead_score_history FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY lsh_insert ON public.lead_score_history FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));