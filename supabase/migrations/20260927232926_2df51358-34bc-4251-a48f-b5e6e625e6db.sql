CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Move security-definer helpers out of the API-exposed schema (RLS policies follow automatically)
ALTER FUNCTION public.is_platform_admin() SET SCHEMA private;
ALTER FUNCTION public.is_tenant_member(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_tenant_role(uuid, app_role[]) SET SCHEMA private;
ALTER FUNCTION public.shares_tenant_with(uuid) SET SCHEMA private;
ALTER FUNCTION public.create_tenant(text, text, boolean) SET SCHEMA private;
ALTER FUNCTION public.accept_invitation(text) SET SCHEMA private;
ALTER FUNCTION public.move_opportunity(uuid, opp_stage, opp_state, text, date) SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.is_tenant_member(_tenant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid() AND m.status = 'active')
  OR private.is_platform_admin();
$$;
CREATE OR REPLACE FUNCTION private.has_tenant_role(_tenant_id uuid, _roles app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role = ANY(_roles))
  OR private.is_platform_admin();
$$;
CREATE OR REPLACE FUNCTION private.shares_tenant_with(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships a JOIN public.memberships b ON a.tenant_id = b.tenant_id
    WHERE a.user_id = auth.uid() AND b.user_id = _user_id)
  OR private.is_platform_admin();
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- Thin invoker wrappers keep the app's existing calls working; all checks live in the private functions
CREATE FUNCTION public.has_tenant_role(_tenant_id uuid, _roles app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT private.has_tenant_role(_tenant_id, _roles) $$;
CREATE FUNCTION public.create_tenant(_name text, _industry text DEFAULT 'real_estate', _is_demo boolean DEFAULT false) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT private.create_tenant(_name, _industry, _is_demo) $$;
CREATE FUNCTION public.accept_invitation(_token text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT private.accept_invitation(_token) $$;
CREATE FUNCTION public.move_opportunity(_id uuid, _to_stage opp_stage, _to_state opp_state, _reason text DEFAULT NULL, _follow_up date DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT private.move_opportunity(_id, _to_stage, _to_state, _reason, _follow_up) $$;

REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, app_role[]), public.create_tenant(text, text, boolean),
  public.accept_invitation(text), public.move_opportunity(uuid, opp_stage, opp_state, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]), public.create_tenant(text, text, boolean),
  public.accept_invitation(text), public.move_opportunity(uuid, opp_stage, opp_state, text, date) TO authenticated, service_role;