CREATE FUNCTION public.crm_wake_pending() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT private.crm_wake(); $$;
REVOKE ALL ON FUNCTION public.crm_wake_pending() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_wake_pending() TO service_role;
GRANT EXECUTE ON FUNCTION private.crm_wake() TO service_role;
CREATE FUNCTION private.crm_delivery_continue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='delivered' AND OLD.status IS DISTINCT FROM NEW.status THEN PERFORM private.crm_wake(); END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.crm_delivery_continue() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_delivery_continue AFTER UPDATE ON public.crm_deliveries FOR EACH ROW EXECUTE FUNCTION private.crm_delivery_continue();