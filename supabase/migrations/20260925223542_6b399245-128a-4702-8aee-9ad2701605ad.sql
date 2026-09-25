
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_tenant_with(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_tenant(text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_tenant_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
