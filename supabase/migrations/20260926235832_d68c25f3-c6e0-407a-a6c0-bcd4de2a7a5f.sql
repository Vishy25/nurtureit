CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_tenant_member(tenant_id));
CREATE POLICY notif_update ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_delete ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX notif_user ON public.notifications(user_id, tenant_id, created_at DESC);

-- Internal trigger helpers: not callable directly
CREATE OR REPLACE FUNCTION public.notify_lead_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
    VALUES (NEW.tenant_id, NEW.owner_id, 'lead_assigned', 'Lead assigned to you', NEW.full_name, '/leads');
  END IF;
  IF TG_OP = 'INSERT' AND NEW.owner_id IS NULL AND NEW.source LIKE 'api%' THEN
    INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
    SELECT NEW.tenant_id, m.user_id, 'lead_incoming', 'New incoming lead needs an owner', NEW.full_name, '/leads'
    FROM memberships m WHERE m.tenant_id = NEW.tenant_id AND m.status = 'active' AND m.role IN ('tenant_admin','sales_manager');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_lead_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER leads_notify AFTER INSERT OR UPDATE OF owner_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.notify_lead_events();

CREATE OR REPLACE FUNCTION public.notify_task_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
    VALUES (NEW.tenant_id, NEW.assignee_id, 'task_assigned', 'Task assigned to you', NEW.title, '/tasks');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_task_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_notify AFTER INSERT OR UPDATE OF assignee_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_events();

CREATE OR REPLACE FUNCTION public.notify_ai_rec() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _name text;
BEGIN
  SELECT owner_id, full_name INTO _owner, _name FROM leads WHERE id = NEW.lead_id;
  IF _owner IS NOT NULL AND _owner IS DISTINCT FROM auth.uid() THEN
    INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
    VALUES (NEW.tenant_id, _owner, 'ai_suggestion', 'New AI suggestion to review', _name, '/leads');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_ai_rec() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ai_rec_notify AFTER INSERT ON public.ai_recommendations FOR EACH ROW EXECUTE FUNCTION public.notify_ai_rec();