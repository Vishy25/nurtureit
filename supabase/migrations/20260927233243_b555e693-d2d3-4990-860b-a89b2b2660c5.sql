CREATE OR REPLACE FUNCTION private.my_tenants(_roles app_role[] DEFAULT NULL)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.tenant_id FROM public.memberships m
  WHERE m.user_id = auth.uid() AND m.status = 'active' AND (_roles IS NULL OR m.role = ANY(_roles))
  UNION
  SELECT t.id FROM public.tenants t WHERE private.is_platform_admin();
$$;
REVOKE ALL ON FUNCTION private.my_tenants(app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.my_tenants(app_role[]) TO authenticated, service_role;

-- Rewrite per-row membership checks into a set evaluated once per query
DO $$
DECLARE p record; q text; c text; stmt text;
BEGIN
  FOR p IN SELECT * FROM pg_policies WHERE schemaname = 'public'
    AND (coalesce(qual,'') ~ 'private\.(has_tenant_role|is_tenant_member)\(' OR coalesce(with_check,'') ~ 'private\.(has_tenant_role|is_tenant_member)\(')
  LOOP
    q := p.qual; c := p.with_check;
    q := regexp_replace(q, 'private\.has_tenant_role\(([A-Za-z_.]+), (ARRAY\[[^\]]*\])\)', '(\1 IN (SELECT private.my_tenants(\2)))', 'g');
    q := regexp_replace(q, 'private\.is_tenant_member\(([A-Za-z_.]+)\)', '(\1 IN (SELECT private.my_tenants()))', 'g');
    c := regexp_replace(c, 'private\.has_tenant_role\(([A-Za-z_.]+), (ARRAY\[[^\]]*\])\)', '(\1 IN (SELECT private.my_tenants(\2)))', 'g');
    c := regexp_replace(c, 'private\.is_tenant_member\(([A-Za-z_.]+)\)', '(\1 IN (SELECT private.my_tenants()))', 'g');
    stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF q IS NOT NULL THEN stmt := stmt || ' USING (' || q || ')'; END IF;
    IF c IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || c || ')'; END IF;
    EXECUTE stmt;
  END LOOP;
END $$;