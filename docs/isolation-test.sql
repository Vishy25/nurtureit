-- Two-workspace isolation test. Run as database owner. Everything is rolled back at the end.
DO $$
DECLARE u uuid; a uuid; b uuid; r text := '';
  n_leads int; n_contacts int; n_tasks int; n_deals int; n_tenant int; n_upd int; blocked text := 'no';
BEGIN
  SELECT id INTO u FROM auth.users ORDER BY created_at LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  a := public.seed_demo_tenant('Isolation Test A');
  b := public.seed_demo_tenant('Isolation Test B');
  RESET ROLE;
  DELETE FROM public.memberships WHERE tenant_id = b AND user_id = u;  -- user now belongs only to A
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_leads FROM public.leads WHERE tenant_id = a;
  SELECT count(*) INTO n_contacts FROM public.contacts WHERE tenant_id = a;
  SELECT count(*) INTO n_tasks FROM public.tasks WHERE tenant_id = a;
  r := format('A visible: leads=%s contacts=%s tasks=%s', n_leads, n_contacts, n_tasks);
  SELECT count(*) INTO n_leads FROM public.leads WHERE tenant_id = b;
  SELECT count(*) INTO n_contacts FROM public.contacts WHERE tenant_id = b;
  SELECT count(*) INTO n_tasks FROM public.tasks WHERE tenant_id = b;
  SELECT count(*) INTO n_deals FROM public.opportunities WHERE tenant_id = b;
  SELECT count(*) INTO n_tenant FROM public.tenants WHERE id = b;
  UPDATE public.leads SET notes = 'x' WHERE tenant_id = b; GET DIAGNOSTICS n_upd = ROW_COUNT;
  BEGIN
    INSERT INTO public.leads(tenant_id, full_name, created_by) VALUES (b, 'Intruder', u);
  EXCEPTION WHEN insufficient_privilege THEN blocked := 'yes';
  END;
  r := r || format(' | B visible: leads=%s contacts=%s tasks=%s deals=%s tenant=%s | B updated=%s | B insert blocked=%s',
    n_leads, n_contacts, n_tasks, n_deals, n_tenant, n_upd, blocked);
  RESET ROLE;
  RAISE EXCEPTION 'RESULT %', r;  -- rolls everything back
END $$;
