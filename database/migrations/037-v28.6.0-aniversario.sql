-- Barbearia do Ju — V28.6.0
-- Aniversariantes do dia para a mensagem automática de feliz aniversário.
-- Reaproveita customer_outreach_log (migration 036) para dedup: no máximo
-- uma mensagem de aniversário por cliente a cada 300 dias (1x por ano).

create or replace function public.customers_birthday_today()
returns table(customer_id uuid, name text, phone text)
language sql security definer set search_path=public as $$
  select c.id, c.name, c.phone
  from public.customer_profiles c
  where c.archived = false
    and c.birth_date is not null
    and to_char(c.birth_date, 'MM-DD') = to_char((now() at time zone 'America/Sao_Paulo')::date, 'MM-DD')
    and length(regexp_replace(c.phone,'\D','','g')) >= 10
    and not exists (
      select 1 from public.customer_outreach_log l
      where l.customer_id = c.id
        and l.kind = 'birthday'
        and l.created_at > now() - interval '300 days'
    )
  limit 100
$$;

grant execute on function public.customers_birthday_today() to service_role;

notify pgrst, 'reload schema';
