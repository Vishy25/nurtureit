CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event text NOT NULL CHECK (trigger_event IN ('lead.created','opportunity.stage_changed','opportunity.lost')),
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action text NOT NULL CHECK (action IN ('create_task','notify_managers')),
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view rules" ON public.automation_rules FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "admins manage rules" ON public.automation_rules FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]));

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  event_key text NOT NULL,
  status text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, entity_id, event_key)
);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view automation runs" ON public.automation_runs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE INDEX idx_automation_runs_tenant ON public.automation_runs(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.run_automations(_tenant uuid, _event text, _entity uuid, _event_key text, _ctx jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.automation_rules; _ok boolean; _title text; _due int; _lead uuid; _opp uuid; _contact uuid;
BEGIN
  -- loop prevention: automations never trigger from inside another automation
  IF coalesce(current_setting('salesos.in_automation', true), '') = 'on' THEN RETURN; END IF;
  PERFORM set_config('salesos.in_automation', 'on', true);
  FOR r IN SELECT * FROM automation_rules WHERE tenant_id = _tenant AND trigger_event = _event AND enabled LOOP
    BEGIN
      _ok := true;
      IF r.condition ? 'source' AND r.condition->>'source' <> coalesce(_ctx->>'source','') THEN _ok := false; END IF;
      IF r.condition ? 'min_score' AND coalesce((_ctx->>'score')::int, 0) < (r.condition->>'min_score')::int THEN _ok := false; END IF;
      IF r.condition ? 'to_stage' AND r.condition->>'to_stage' <> coalesce(_ctx->>'to_stage','') THEN _ok := false; END IF;
      IF NOT _ok THEN CONTINUE; END IF;
      -- idempotency: one run per rule/entity/event
      INSERT INTO automation_runs(tenant_id, rule_id, entity_id, event_key, status)
      VALUES (_tenant, r.id, _entity, _event_key, 'running') ON CONFLICT DO NOTHING;
      IF NOT FOUND THEN CONTINUE; END IF;
      _title := coalesce(nullif(r.action_config->>'title',''), r.name) || ' — ' || coalesce(_ctx->>'name','');
      IF r.action = 'create_task' THEN
        _due := coalesce((r.action_config->>'due_days')::int, 1);
        _lead := CASE WHEN _event = 'lead.created' THEN _entity END;
        _opp := CASE WHEN _event <> 'lead.created' THEN _entity END;
        _contact := nullif(_ctx->>'contact_id','')::uuid;
        INSERT INTO tasks(tenant_id, title, kind, due_at, status, lead_id, opportunity_id, contact_id, assignee_id, created_by)
        VALUES (_tenant, _title, coalesce(r.action_config->>'kind','follow_up'), now() + make_interval(days => _due), 'open',
                _lead, _opp, _contact, nullif(_ctx->>'owner_id','')::uuid, r.created_by);
      ELSIF r.action = 'notify_managers' THEN
        INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
        SELECT _tenant, m.user_id, 'automation', r.name, _ctx->>'name', CASE WHEN _event = 'lead.created' THEN '/leads' ELSE '/pipeline' END
        FROM memberships m WHERE m.tenant_id = _tenant AND m.status = 'active' AND m.role IN ('tenant_admin','sales_manager');
      END IF;
      UPDATE automation_runs SET status = 'succeeded' WHERE rule_id = r.id AND entity_id = _entity AND event_key = _event_key;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO automation_runs(tenant_id, rule_id, entity_id, event_key, status, detail)
      VALUES (_tenant, r.id, _entity, _event_key, 'failed', SQLERRM)
      ON CONFLICT (rule_id, entity_id, event_key) DO UPDATE SET status = 'failed', detail = EXCLUDED.detail;
    END;
  END LOOP;
  PERFORM set_config('salesos.in_automation', 'off', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.run_automations(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_lead_automations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM run_automations(NEW.tenant_id, 'lead.created', NEW.id, 'created',
    jsonb_build_object('name', NEW.full_name, 'source', NEW.source, 'score', NEW.score, 'owner_id', NEW.owner_id));
  RETURN NEW;
END $$;
CREATE TRIGGER lead_automations AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.trg_lead_automations();

CREATE OR REPLACE FUNCTION public.trg_opp_automations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.state = 'lost' AND OLD.state IS DISTINCT FROM 'lost' THEN
    PERFORM run_automations(NEW.tenant_id, 'opportunity.lost', NEW.id, 'lost:' || now()::text,
      jsonb_build_object('name', NEW.name, 'owner_id', NEW.owner_id, 'contact_id', NEW.contact_id));
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM run_automations(NEW.tenant_id, 'opportunity.stage_changed', NEW.id, 'stage:' || NEW.stage::text,
      jsonb_build_object('name', NEW.name, 'to_stage', NEW.stage::text, 'owner_id', NEW.owner_id, 'contact_id', NEW.contact_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opp_automations AFTER UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.trg_opp_automations();