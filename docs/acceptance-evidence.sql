-- Milestone 4 acceptance evidence. Run as database owner. Everything is rolled back at the end.
DO $$
DECLARE u uuid; a uuid; b uuid; d uuid; r text := ''; n int; msg text;
BEGIN
  SELECT id INTO u FROM public.profiles ORDER BY created_at LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  a := public.seed_demo_tenant('Acceptance A');
  b := public.seed_demo_tenant('Acceptance B');
  INSERT INTO public.ai_memory(tenant_id, kind, content, source, confidence, created_by) VALUES (b, 'approved_knowledge', 'B secret', 'test', 1, u);
  RESET ROLE;
  DELETE FROM public.memberships WHERE tenant_id = b AND user_id = u;
  UPDATE public.memberships SET role = 'sales_rep' WHERE tenant_id = a AND user_id = u;
  SET LOCAL ROLE authenticated;

  -- 1. Tenant memory isolation
  SELECT count(*) INTO n FROM public.ai_memory WHERE tenant_id = b;
  r := format('1 memory of B visible=%s', n);
  BEGIN INSERT INTO public.ai_memory(tenant_id, kind, content, source, confidence, created_by) VALUES (b, 'preference', 'x', 'test', 1, u); r := r || ' insert=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN r := r || ' insert=blocked'; END;

  -- 2. Unauthorized release: non-admin cannot change agent release settings
  BEGIN INSERT INTO public.ai_agent_settings(tenant_id, agent, release_stage, prompt_version) VALUES (a, 'lead_qualification', 'shadow', 'lead-qual-v2'); r := r || ' | 2 rep release=ALLOWED';
  EXCEPTION WHEN OTHERS THEN r := r || ' | 2 rep release=blocked'; END;

  -- 3. Stage skipping and direct stage edits blocked
  SELECT id INTO d FROM public.opportunities WHERE tenant_id = a LIMIT 1;
  BEGIN PERFORM public.move_opportunity(d, 'negotiation', 'open'); r := r || ' | 3 skip=ALLOWED';
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; r := r || ' | 3 skip=blocked'; END;
  BEGIN UPDATE public.opportunities SET stage = 'closing' WHERE id = d; r := r || ' direct-edit=ALLOWED';
  EXCEPTION WHEN OTHERS THEN r := r || ' direct-edit=blocked'; END;

  -- 4. Notifications cannot be forged
  BEGIN INSERT INTO public.notifications(tenant_id, user_id, kind, title) VALUES (a, u, 'x', 'forged'); r := r || ' | 4 forge=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN r := r || ' | 4 forge=blocked'; END;

  RESET ROLE;
  UPDATE public.memberships SET role = 'tenant_admin' WHERE tenant_id = a AND user_id = u;
  SET LOCAL ROLE authenticated;

  -- 5. Release gate: pilot without approved evaluation is refused
  INSERT INTO public.ai_agent_settings(tenant_id, agent, release_stage, prompt_version) VALUES (a, 'lead_qualification', 'shadow', 'lead-qual-v2');
  BEGIN UPDATE public.ai_agent_settings SET release_stage = 'pilot' WHERE tenant_id = a AND agent = 'lead_qualification'; r := r || ' | 5 ungated pilot=ALLOWED';
  EXCEPTION WHEN OTHERS THEN r := r || ' | 5 ungated pilot=blocked'; END;

  -- 6. Release then rollback with an approved evaluation
  INSERT INTO public.ai_evaluations(tenant_id, agent, prompt_version, model, results, status, pass_rate, created_by)
  VALUES (a, 'lead_qualification', 'lead-qual-v2', 'test', '[]', 'approved', 1, u);
  UPDATE public.ai_agent_settings SET release_stage = 'live' WHERE tenant_id = a AND agent = 'lead_qualification';
  UPDATE public.ai_agent_settings SET release_stage = 'shadow' WHERE tenant_id = a AND agent = 'lead_qualification';
  SELECT count(*) INTO n FROM public.ai_agent_settings WHERE tenant_id = a AND release_stage = 'shadow';
  r := r || format(' | 6 live-then-rollback ok=%s', n = 1);

  -- 7. Emergency stop flag is writable by admin
  UPDATE public.tenants SET ai_paused = true WHERE id = a; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || format(' | 7 emergency stop set=%s', n = 1);

  RESET ROLE;
  RAISE EXCEPTION 'RESULT %', r;
END $$;
