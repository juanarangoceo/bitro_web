-- 0012_ai_quota.sql — reserva atómica y cierre de generaciones con IA.
alter table public.ai_generations drop constraint ai_generations_status_check,
  add constraint ai_generations_status_check check (status in ('pending', 'ok', 'invalid_output', 'error'));

create or replace function public.reserve_ai_generation(
  p_site_id uuid, p_mode text, p_target_key text, p_model text, p_prompt_version text
)
returns table(generation_id uuid, used bigint, monthly_limit integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant_id uuid; v_limit integer; v_used bigint; v_generation_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_mode not in ('full', 'section', 'field') then raise exception 'invalid generation mode' using errcode = '22023'; end if;
  select s.tenant_id into v_tenant_id from public.sites s where s.id = p_site_id
    and app.has_tenant_role(s.tenant_id, array['owner', 'editor']::app.tenant_role[]);
  if v_tenant_id is null then raise exception 'site not found' using errcode = 'P0002'; end if;
  select coalesce((p.limits_json ->> 'max_ai_generations')::integer, 0) into v_limit
    from public.tenants t join public.plans p on p.id = t.plan_id
    where t.id = v_tenant_id and t.status = 'active' and t.billing_status in ('trial', 'active');
  if v_limit is null or v_limit <= 0 then raise exception 'ai unavailable for tenant' using errcode = 'P0001'; end if;
  insert into public.usage_monthly (tenant_id, period, metric, value)
  values (v_tenant_id, date_trunc('month', current_date)::date, 'ai_generations', 1)
  on conflict (tenant_id, period, metric) do update set value = public.usage_monthly.value + 1, updated_at = now()
    where public.usage_monthly.value < v_limit returning value into v_used;
  if v_used is null or v_used > v_limit then raise exception 'monthly ai quota reached' using errcode = 'P0001'; end if;
  insert into public.ai_generations (tenant_id, site_id, user_id, mode, target_key, model, prompt_version, status, error_message)
  values (v_tenant_id, p_site_id, (select auth.uid()), p_mode, p_target_key, p_model, p_prompt_version, 'pending', 'Generación reservada')
  returning id into v_generation_id;
  return query select v_generation_id, v_used, v_limit;
end;
$$;

create or replace function public.finish_ai_generation(
  p_generation_id uuid, p_status text, p_input_tokens integer, p_output_tokens integer,
  p_latency_ms integer, p_cost_micros bigint, p_result_json jsonb, p_error_message text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('ok', 'invalid_output', 'error') then raise exception 'invalid generation status' using errcode = '22023'; end if;
  update public.ai_generations set status = p_status, input_tokens = p_input_tokens,
    output_tokens = p_output_tokens, latency_ms = p_latency_ms, cost_micros = p_cost_micros,
    result_json = p_result_json, error_message = p_error_message
  where id = p_generation_id and user_id = (select auth.uid())
    and tenant_id in (select app.current_tenant_ids());
  if not found then raise exception 'generation not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.reserve_ai_generation(uuid, text, text, text, text) from public, anon;
grant execute on function public.reserve_ai_generation(uuid, text, text, text, text) to authenticated;
revoke all on function public.finish_ai_generation(uuid, text, integer, integer, integer, bigint, jsonb, text) from public, anon;
grant execute on function public.finish_ai_generation(uuid, text, integer, integer, integer, bigint, jsonb, text) to authenticated;
