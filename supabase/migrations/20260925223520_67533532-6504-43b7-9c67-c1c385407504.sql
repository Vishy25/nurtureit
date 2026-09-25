
CREATE TYPE public.app_role AS ENUM ('tenant_admin','sales_manager','sales_rep','ops_coordinator','analyst');
CREATE TYPE public.membership_status AS ENUM ('active','invited','deactivated');

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  industry text NOT NULL DEFAULT 'real_estate',
  status text NOT NULL DEFAULT 'active',
  is_demo boolean NOT NULL DEFAULT false,
  default_currency text NOT NULL DEFAULT 'USD',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'sales_rep',
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_tenant ON public.memberships(tenant_id);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_tenant ON public.teams(tenant_id);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX idx_team_members_tenant ON public.team_members(tenant_id);

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'sales_rep',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_tenant ON public.invitations(tenant_id);
CREATE INDEX idx_invitations_email ON public.invitations(lower(email));

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_created ON public.audit_events(tenant_id, created_at DESC);

-- helper functions (security definer, bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
  ) OR public.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid()
      AND m.status = 'active' AND m.role = ANY(_roles)
  ) OR public.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION public.shares_tenant_with(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON a.tenant_id = b.tenant_id
    WHERE a.user_id = auth.uid() AND b.user_id = _user_id
  ) OR public.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- create a tenant and make the caller its admin
CREATE OR REPLACE FUNCTION public.create_tenant(_name text, _industry text DEFAULT 'real_estate', _is_demo boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _slug text; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  _slug := regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g') || '-' || substr(encode(gen_random_bytes(3),'hex'),1,6);
  INSERT INTO public.tenants(name, slug, industry, is_demo, created_by)
  VALUES (trim(_name), _slug, coalesce(_industry,'real_estate'), coalesce(_is_demo,false), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.memberships(tenant_id, user_id, role, status) VALUES (_id, _uid, 'tenant_admin', 'active');
  INSERT INTO public.audit_events(tenant_id, actor_id, action, entity_type, entity_id)
  VALUES (_id, _uid, 'tenant.created', 'tenant', _id);
  RETURN _id;
END; $$;

-- accept an invitation by token (tenant derived server-side, never from client input)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.invitations; _uid uuid := auth.uid(); _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO _email FROM public.profiles WHERE id = _uid;
  SELECT * INTO _inv FROM public.invitations WHERE token = _token AND status = 'pending' AND expires_at > now();
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
  IF _email IS NULL OR lower(_email) <> lower(_inv.email) THEN RAISE EXCEPTION 'Invitation was issued to a different email address'; END IF;
  INSERT INTO public.memberships(tenant_id, user_id, role, status)
  VALUES (_inv.tenant_id, _uid, _inv.role, 'active')
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active';
  UPDATE public.invitations SET status = 'accepted' WHERE id = _inv.id;
  INSERT INTO public.audit_events(tenant_id, actor_id, action, entity_type, entity_id)
  VALUES (_inv.tenant_id, _uid, 'invitation.accepted', 'invitation', _inv.id);
  RETURN _inv.tenant_id;
END; $$;

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.tenants, public.profiles, public.memberships, public.teams, public.team_members, public.invitations, public.audit_events, public.platform_admins TO service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated USING (public.is_tenant_member(id));
CREATE POLICY tenants_update ON public.tenants FOR UPDATE TO authenticated USING (public.has_tenant_role(id, ARRAY['tenant_admin']::public.app_role[])) WITH CHECK (public.has_tenant_role(id, ARRAY['tenant_admin']::public.app_role[]));

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.shares_tenant_with(id));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_tenant_member(tenant_id));
CREATE POLICY memberships_insert ON public.memberships FOR INSERT TO authenticated WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));
CREATE POLICY memberships_update ON public.memberships FOR UPDATE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));
CREATE POLICY memberships_delete ON public.memberships FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));

CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY teams_write ON public.teams FOR ALL TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[]));

CREATE POLICY team_members_select ON public.team_members FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY team_members_write ON public.team_members FOR ALL TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[]));

CREATE POLICY invitations_select ON public.invitations FOR SELECT TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));
CREATE POLICY invitations_write ON public.invitations FOR ALL TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[]));

CREATE POLICY audit_select ON public.audit_events FOR SELECT TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::public.app_role[]));
CREATE POLICY audit_insert ON public.audit_events FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id) AND actor_id = auth.uid());

CREATE POLICY platform_admins_select ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
