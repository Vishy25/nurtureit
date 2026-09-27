alter table public.ai_runs drop constraint ai_runs_status_check;
alter table public.ai_runs add constraint ai_runs_status_check check (status in ('running','completed','failed','blocked','uncertain','retried'));
alter table public.ai_runs add column if not exists retry_of uuid references public.ai_runs(id);

create or replace view public.ai_recommendation_outcomes with (security_invoker = true) as
select r.id as recommendation_id, r.tenant_id, r.lead_id, r.status as decision, r.feedback, r.created_at, r.decided_at,
  r.payload->>'recommendation' as recommended, run.prompt_version, run.model, run.agent,
  l.full_name as lead_name, l.status as lead_status,
  o.id as opportunity_id, o.stage as opp_stage, o.state as opp_state, o.value as opp_value, o.currency, o.lost_reason,
  (select count(*) from public.opportunity_stage_history h where h.opportunity_id = o.id) as stage_moves,
  (select count(*) from public.lead_score_history s where s.lead_id = r.lead_id and s.source = 'override' and s.created_at > r.created_at) as score_corrections
from public.ai_recommendations r
join public.ai_runs run on run.id = r.run_id
left join public.leads l on l.id = r.lead_id
left join lateral (select * from public.opportunities op where op.lead_id = r.lead_id order by op.created_at desc limit 1) o on true;
grant select on public.ai_recommendation_outcomes to authenticated;