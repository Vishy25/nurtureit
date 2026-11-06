CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE private.crm_wake_tokens (hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
REVOKE ALL ON private.crm_wake_tokens FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.crm_wake_tokens TO service_role;
CREATE FUNCTION public.crm_consume_wake(_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE ok boolean; BEGIN DELETE FROM private.crm_wake_tokens WHERE hash=_hash AND expires_at>now() RETURNING true INTO ok; RETURN coalesce(ok,false); END $$;
REVOKE ALL ON FUNCTION public.crm_consume_wake(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_consume_wake(text) TO service_role;
CREATE FUNCTION private.crm_wake() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE token text; BEGIN
DELETE FROM private.crm_wake_tokens WHERE expires_at<now();
IF NOT EXISTS(SELECT 1 FROM public.crm_deliveries WHERE status IN ('pending','sending') AND attempts<8) THEN RETURN; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO private.crm_wake_tokens(hash,expires_at) VALUES(encode(extensions.digest(token,'sha256'),'hex'),now()+interval '5 minutes');
 PERFORM net.http_post(url:='https://nurtureit.lovable.app/api/public/crm/dispatch',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION private.crm_wake() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.crm_enqueue_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.crm_wake_tokens WHERE expires_at>now()) THEN PERFORM private.crm_wake(); END IF;
 RETURN NULL; END $$;
REVOKE ALL ON FUNCTION private.crm_enqueue_wake() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_enqueue_wake AFTER INSERT ON public.crm_deliveries FOR EACH STATEMENT EXECUTE FUNCTION private.crm_enqueue_wake();