create or replace function public.convert_lead(_lead_id uuid, _deal_name text, _value numeric default null, _expected_close date default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  l public.leads%rowtype;
  _contact uuid;
  _opp uuid;
  _cur text;
begin
  select * into l from public.leads where id = _lead_id for update;
  if not found then raise exception 'Lead not found or not accessible'; end if;
  if l.status in ('converted','disqualified') then
    raise exception 'Lead is % and cannot be converted', l.status;
  end if;
  select default_currency into _cur from public.tenants where id = l.tenant_id;

  insert into public.contacts (tenant_id, full_name, email, phone, notes, owner_id, created_by)
  values (l.tenant_id, l.full_name, l.email, l.phone, l.notes, coalesce(l.owner_id, auth.uid()), auth.uid())
  returning id into _contact;

  insert into public.opportunities (tenant_id, name, contact_id, lead_id, value, currency, expected_close, owner_id, created_by)
  values (l.tenant_id, coalesce(nullif(trim(_deal_name),''), l.full_name), _contact, l.id, _value, coalesce(_cur,'USD'), _expected_close, coalesce(l.owner_id, auth.uid()), auth.uid())
  returning id into _opp;

  update public.leads set status = 'converted' where id = l.id;

  insert into public.activities (tenant_id, contact_id, opportunity_id, kind, summary, occurred_at, created_by)
  values (l.tenant_id, _contact, _opp, 'note', 'Converted from lead (source: ' || l.source || ')', now(), auth.uid());

  return _opp;
end;
$$;
revoke all on function public.convert_lead(uuid, text, numeric, date) from public, anon;
grant execute on function public.convert_lead(uuid, text, numeric, date) to authenticated;