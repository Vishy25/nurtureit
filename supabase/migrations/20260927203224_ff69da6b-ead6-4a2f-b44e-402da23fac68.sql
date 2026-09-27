ALTER TABLE public.automation_rules DROP CONSTRAINT automation_rules_action_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_action_check CHECK (action IN ('create_task','notify_managers','assign_least_loaded'));

CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'follow_up',
  due_days integer NOT NULL DEFAULT 1 CHECK (due_days BETWEEN 0 AND 365),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view task templates" ON public.task_templates FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "managers manage task templates" ON public.task_templates FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]));

CREATE OR REPLACE FUNCTION public.run_automations(_tenant uuid, _event text, _entity uuid, _event_key text, _ctx jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.automation_rules; _ok boolean; _title text; _due int; _lead uuid; _opp uuid; _contact uuid; _assignee uuid;
BEGIN
  IF coalesce(current_setting('salesos.in_automation', true), '') = 'on' THEN RETURN; END IF;
  PERFORM set_config('salesos.in_automation', 'on', true);
  FOR r IN SELECT * FROM automation_rules WHERE tenant_id = _tenant AND trigger_event = _event AND enabled ORDER BY (action = 'assign_least_loaded') DESC, created_at LOOP
    BEGIN
      _ok := true;
      IF r.condition ? 'source' AND r.condition->>'source' <> coalesce(_ctx->>'source','') THEN _ok := false; END IF;
      IF r.condition ? 'min_score' AND coalesce((_ctx->>'score')::int, 0) < (r.condition->>'min_score')::int THEN _ok := false; END IF;
      IF r.condition ? 'to_stage' AND r.condition->>'to_stage' <> coalesce(_ctx->>'to_stage','') THEN _ok := false; END IF;
      IF NOT _ok THEN CONTINUE; END IF;
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
      ELSIF r.action = 'assign_least_loaded' AND _event = 'lead.created' AND nullif(_ctx->>'owner_id','') IS NULL THEN
        SELECT m.user_id INTO _assignee FROM memberships m
        LEFT JOIN leads l ON l.tenant_id = _tenant AND l.owner_id = m.user_id AND l.status IN ('new','accepted','nurturing')
        WHERE m.tenant_id = _tenant AND m.status = 'active' AND m.role = 'sales_rep'
        GROUP BY m.user_id ORDER BY count(l.id), min(m.created_at) LIMIT 1;
        IF _assignee IS NOT NULL THEN
          UPDATE leads SET owner_id = _assignee WHERE id = _entity;
          _ctx := _ctx || jsonb_build_object('owner_id', _assignee);
          INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
          VALUES (_tenant, _assignee, 'lead_assigned', 'Lead assigned to you', _ctx->>'name', '/leads');
        ELSE
          UPDATE automation_runs SET status = 'skipped', detail = 'No active sales representatives' WHERE rule_id = r.id AND entity_id = _entity AND event_key = _event_key;
          CONTINUE;
        END IF;
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