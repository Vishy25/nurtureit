
CREATE TYPE public.opp_stage AS ENUM ('qualification','discovery','shortlist','site_visit','negotiation','closing','closed_won');
CREATE TYPE public.opp_state AS ENUM ('open','on_hold','nurturing','won','lost');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text, website text, phone text, notes text,
  owner_id uuid, created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name text NOT NULL, email text, phone text, title text,
  preferred_channel text NOT NULL DEFAULT 'email',
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_source text, notes text,
  owner_id uuid, created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  stage public.opp_stage NOT NULL DEFAULT 'qualification',
  state public.opp_state NOT NULL DEFAULT 'open',
  value numeric(14,2), currency text NOT NULL DEFAULT 'USD',
  expected_close date, follow_up_at date, lost_reason text,
  owner_id uuid, created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.opportunity_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_stage public.opp_stage, to_stage public.opp_stage NOT NULL,
  from_state public.opp_state, to_state public.opp_state NOT NULL,
  reason text, changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note','call','email','message','meeting','visit')),
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.organizations(tenant_id);
CREATE INDEX ON public.contacts(tenant_id, organization_id);
CREATE INDEX ON public.opportunities(tenant_id, stage, state);
CREATE INDEX ON public.opportunity_stage_history(opportunity_id);
CREATE INDEX ON public.activities(tenant_id, contact_id);
CREATE INDEX ON public.activities(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.contacts, public.opportunities, public.activities TO authenticated;
GRANT SELECT ON public.opportunity_stage_history TO authenticated;
GRANT ALL ON public.organizations, public.contacts, public.opportunities, public.activities, public.opportunity_stage_history TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- organizations & contacts: shared tenant directory; writers = non-analysts
CREATE POLICY org_select ON public.organizations FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY org_insert ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));
CREATE POLICY org_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]) OR (public.has_tenant_role(tenant_id, ARRAY['sales_rep','ops_coordinator']::app_role[]) AND (owner_id = auth.uid() OR created_by = auth.uid())))
  WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY org_delete ON public.organizations FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY contacts_select ON public.contacts FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator','analyst']::app_role[]) OR (public.is_tenant_member(tenant_id) AND (owner_id = auth.uid() OR created_by = auth.uid())));
CREATE POLICY contacts_insert ON public.contacts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));
CREATE POLICY contacts_update ON public.contacts FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]) OR (public.has_tenant_role(tenant_id, ARRAY['sales_rep','ops_coordinator']::app_role[]) AND (owner_id = auth.uid() OR created_by = auth.uid())))
  WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY contacts_delete ON public.contacts FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY opp_select ON public.opportunities FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator','analyst']::app_role[]) OR (public.is_tenant_member(tenant_id) AND (owner_id = auth.uid() OR created_by = auth.uid())));
CREATE POLICY opp_insert ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND stage = 'qualification' AND state = 'open' AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep']::app_role[]));
CREATE POLICY opp_update ON public.opportunities FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]) OR (public.has_tenant_role(tenant_id, ARRAY['sales_rep']::app_role[]) AND (owner_id = auth.uid() OR created_by = auth.uid())))
  WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY opp_delete ON public.opportunities FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY osh_select ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id));

CREATE POLICY act_select ON public.activities FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id) AND (
    public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','ops_coordinator','analyst']::app_role[])
    OR created_by = auth.uid()
    OR (contact_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id))
    OR (opportunity_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id))));
CREATE POLICY act_insert ON public.activities FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','sales_manager','sales_rep','ops_coordinator']::app_role[]));
CREATE POLICY act_delete ON public.activities FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_opp_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Block direct stage/state/tenant edits; only move_opportunity may change them
CREATE OR REPLACE FUNCTION public.guard_opportunity_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id THEN RAISE EXCEPTION 'Cannot move a deal between workspaces'; END IF;
  IF (NEW.stage IS DISTINCT FROM OLD.stage OR NEW.state IS DISTINCT FROM OLD.state OR NEW.lost_reason IS DISTINCT FROM OLD.lost_reason)
     AND coalesce(current_setting('salesos.transition', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Stage changes must go through the pipeline transition rules';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_opportunity_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_opp_guard BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.guard_opportunity_update();

CREATE OR REPLACE FUNCTION public.move_opportunity(_id uuid, _to_stage public.opp_stage, _to_state public.opp_state, _reason text DEFAULT NULL, _follow_up date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.opportunities; from_idx int; to_idx int;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF NOT (public.has_tenant_role(o.tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[])
       OR (public.has_tenant_role(o.tenant_id, ARRAY['sales_rep']::app_role[]) AND (o.owner_id = auth.uid() OR o.created_by = auth.uid()))) THEN
    RAISE EXCEPTION 'Not allowed to move this deal';
  END IF;
  IF o.state IN ('won','lost') AND NOT public.has_tenant_role(o.tenant_id, ARRAY['tenant_admin','sales_manager']::app_role[]) THEN
    RAISE EXCEPTION 'Only managers can reopen a closed deal';
  END IF;
  from_idx := array_position(enum_range(NULL::public.opp_stage), o.stage);
  to_idx := array_position(enum_range(NULL::public.opp_stage), _to_stage);
  IF _to_state = 'lost' THEN
    IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required to close a deal as lost'; END IF;
    _to_stage := o.stage;
  ELSIF _to_state IN ('on_hold','nurturing') THEN
    IF _follow_up IS NULL THEN RAISE EXCEPTION 'A follow-up date is required'; END IF;
    _to_stage := o.stage;
  ELSIF _to_stage = 'closed_won' THEN
    IF o.stage <> 'closing' THEN RAISE EXCEPTION 'Deals can only be won from contract and closing preparation'; END IF;
    _to_state := 'won';
  ELSE
    _to_state := 'open';
    IF to_idx > from_idx + 1 THEN RAISE EXCEPTION 'Stages cannot be skipped; move one stage at a time'; END IF;
  END IF;

  PERFORM set_config('salesos.transition', 'on', true);
  UPDATE public.opportunities SET stage = _to_stage, state = _to_state,
    lost_reason = CASE WHEN _to_state = 'lost' THEN _reason ELSE NULL END,
    follow_up_at = CASE WHEN _to_state IN ('on_hold','nurturing') THEN _follow_up ELSE follow_up_at END
  WHERE id = _id;
  PERFORM set_config('salesos.transition', 'off', true);

  INSERT INTO public.opportunity_stage_history(tenant_id, opportunity_id, from_stage, to_stage, from_state, to_state, reason, changed_by)
  VALUES (o.tenant_id, _id, o.stage, _to_stage, o.state, _to_state, _reason, auth.uid());
  INSERT INTO public.audit_events(tenant_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (o.tenant_id, auth.uid(), 'opportunity.moved', 'opportunity', _id,
    jsonb_build_object('from_stage', o.stage, 'to_stage', _to_stage, 'from_state', o.state, 'to_state', _to_state, 'reason', _reason));
END $$;
REVOKE ALL ON FUNCTION public.move_opportunity(uuid, public.opp_stage, public.opp_state, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_opportunity(uuid, public.opp_stage, public.opp_state, text, date) TO authenticated;

-- record initial stage on creation
CREATE OR REPLACE FUNCTION public.log_opportunity_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.opportunity_stage_history(tenant_id, opportunity_id, from_stage, to_stage, from_state, to_state, changed_by)
  VALUES (NEW.tenant_id, NEW.id, NULL, NEW.stage, NULL, NEW.state, auth.uid());
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_opportunity_created() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_opp_created AFTER INSERT ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.log_opportunity_created();
