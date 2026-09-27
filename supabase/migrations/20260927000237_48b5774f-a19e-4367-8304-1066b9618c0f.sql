-- Workspace configuration
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stage_labels text[];
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS scoring_config jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.custom_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity text NOT NULL DEFAULT 'lead' CHECK (entity IN ('lead')),
  field_key text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','select','boolean')),
  options text[] NOT NULL DEFAULT '{}',
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity, field_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_defs TO authenticated;
GRANT ALL ON public.custom_field_defs TO service_role;
ALTER TABLE public.custom_field_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfd_select ON public.custom_field_defs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY cfd_write ON public.custom_field_defs FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));

-- AI agent release settings per workspace
CREATE TABLE public.ai_agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  release_stage text NOT NULL DEFAULT 'shadow' CHECK (release_stage IN ('shadow','pilot','live')),
  prompt_version text NOT NULL,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent)
);
GRANT SELECT, INSERT, UPDATE ON public.ai_agent_settings TO authenticated;
GRANT ALL ON public.ai_agent_settings TO service_role;
ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY aas_select ON public.ai_agent_settings FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY aas_insert ON public.ai_agent_settings FOR INSERT TO authenticated WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));
CREATE POLICY aas_update ON public.ai_agent_settings FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));

CREATE TABLE public.ai_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  pass_rate numeric,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_evaluations TO authenticated;
GRANT ALL ON public.ai_evaluations TO service_role;
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY aev_select ON public.ai_evaluations FOR SELECT TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[]));
CREATE POLICY aev_insert ON public.ai_evaluations FOR INSERT TO authenticated WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));
CREATE POLICY aev_update ON public.ai_evaluations FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));

-- Promotion beyond shadow needs an approved evaluation for the same prompt version
CREATE OR REPLACE FUNCTION public.guard_ai_release() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.release_stage IN ('pilot','live') AND NOT EXISTS (
    SELECT 1 FROM ai_evaluations e WHERE e.tenant_id = NEW.tenant_id AND e.agent = NEW.agent
      AND e.prompt_version = NEW.prompt_version AND e.status = 'approved') THEN
    RAISE EXCEPTION 'An approved evaluation for % is required before release', NEW.prompt_version;
  END IF;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER ai_release_guard BEFORE INSERT OR UPDATE ON public.ai_agent_settings FOR EACH ROW EXECUTE FUNCTION public.guard_ai_release();

-- Tenant-isolated AI memory
CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('verified_fact','interaction','approved_knowledge','preference','hypothesis')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  confidence numeric NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  expires_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memory TO authenticated;
GRANT ALL ON public.ai_memory TO service_role;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY aim_select ON public.ai_memory FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY aim_insert ON public.ai_memory FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::public.app_role[])
  AND (kind NOT IN ('approved_knowledge') OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[])));
CREATE POLICY aim_update ON public.ai_memory FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[]))
  WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY aim_delete ON public.ai_memory FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[]));
CREATE INDEX ai_memory_tenant ON public.ai_memory(tenant_id, kind);
CREATE INDEX ai_memory_lead ON public.ai_memory(lead_id);

ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- Suggestions notify the lead owner, or whoever requested it when unowned; link opens the lead
CREATE OR REPLACE FUNCTION public.notify_ai_rec() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _name text; _by uuid;
BEGIN
  SELECT owner_id, full_name INTO _owner, _name FROM leads WHERE id = NEW.lead_id;
  SELECT created_by INTO _by FROM ai_runs WHERE id = NEW.run_id;
  INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
  VALUES (NEW.tenant_id, COALESCE(_owner, _by), 'ai_suggestion', 'New AI suggestion to review', _name, '/leads?lead=' || NEW.lead_id::text);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_ai_rec() FROM PUBLIC, anon, authenticated;