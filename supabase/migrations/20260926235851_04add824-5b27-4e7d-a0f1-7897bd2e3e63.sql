CREATE OR REPLACE FUNCTION public.notify_lead_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
    VALUES (NEW.tenant_id, NEW.owner_id, 'lead_assigned', 'Lead assigned to you', NEW.full_name, '/leads');
  END IF;
  -- Leads created by the intake service (no signed-in user) alert admins and managers
  IF TG_OP = 'INSERT' AND NEW.owner_id IS NULL AND auth.uid() IS NULL THEN
    INSERT INTO notifications(tenant_id, user_id, kind, title, body, link)
    SELECT NEW.tenant_id, m.user_id, 'lead_incoming', 'New incoming lead needs an owner', NEW.full_name, '/leads'
    FROM memberships m WHERE m.tenant_id = NEW.tenant_id AND m.status = 'active' AND m.role IN ('tenant_admin','sales_manager');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_lead_events() FROM PUBLIC, anon, authenticated;