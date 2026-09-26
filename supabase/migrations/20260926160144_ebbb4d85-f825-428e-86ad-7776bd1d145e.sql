CREATE OR REPLACE FUNCTION public.create_tenant(_name text, _industry text DEFAULT 'real_estate', _is_demo boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _slug text; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  PERFORM public.ensure_profile();
  _slug := regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g') || '-' || substr(encode(extensions.gen_random_bytes(3),'hex'),1,6);
  INSERT INTO public.tenants(name, slug, industry, is_demo, created_by)
  VALUES (trim(_name), _slug, coalesce(_industry,'real_estate'), coalesce(_is_demo,false), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.memberships(tenant_id, user_id, role, status) VALUES (_id, _uid, 'tenant_admin', 'active');
  INSERT INTO public.audit_events(tenant_id, actor_id, action, entity_type, entity_id)
  VALUES (_id, _uid, 'tenant.created', 'tenant', _id);
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.invitations; _uid uuid := auth.uid(); _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.ensure_profile();
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

ALTER TABLE public.invitations ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(18),'hex');