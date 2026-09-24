-- v29.233.0 (24/09/2026) — Clube do Ju: complementos aplicados em produção depois da 171, na ordem:
--   clube_do_ju_v29_233_guardas            (erro no Clube nunca impede agendamento)
--   clube_do_ju_v29_233_cativa_termos      (termos v1, Cadeira Cativa, bonus_visits, club_quote v2, club_summary)
--   clube_do_ju_v29_233_recupera_cobertura (club_recover_coverage)
--   clube_do_ju_v29_233_anuncio_cron       (mensagem de lançamento + cron bdj-clube-ciclo)
--   marketing_opt_out_v29_233              (SAIR respeitado em aniversário, reativação e indicação)
-- A versão final de club_quote e dos três gatilhos é a daqui (substitui a da 171).

-- 1. Colunas e termos
alter table public.club_subscriptions add column if not exists bonus_visits jsonb not null default '{}';
alter table public.club_settings add column if not exists anuncio_ativo boolean not null default false;
alter table public.club_settings add column if not exists anuncio_por_rodada int not null default 2;
insert into public.club_terms (version, sha256, url)
values ('v1', '64c9488de8d25676756d4190a4cbd419045289b27105ab8c7e843359f5dc3e46', 'https://www.barbeariadoju.com.br/clube/contrato/v1.txt')
on conflict (version) do update set sha256 = excluded.sha256, url = excluded.url;
-- Vendas fechadas até o lançamento (01/10/2026); quem tentar assinar entra na lista de espera.
update public.club_settings set vendas_abertas = false where id = 1;

-- 2. Gatilhos com guarda: o corpo de cada um (171) passa a ficar dentro de
--    begin ... exception when others then raise warning '[clube] ...'; end;
--    e o before_insert sai cedo quando não existe nenhuma assinatura viva:
--    if not exists (select 1 from public.club_subscriptions c where c.status in ('ativa','atrasada','aguardando_pagamento')) then return new; end if;

-- 3. club_quote v2: igual à 171 + visita extra por fechamento (cláusula 6):
--    v_bonus := coalesce((s.bonus_visits ->> v_cycle::text)::int, 0);
--    planos comuns: v_limit := visits_per_cycle + v_bonus; Cativa: a semana já usada libera mais 1 visita
--    no ciclo enquanto houver bônus.

-- 4. Funções novas
create or replace function public.club_cativa_book(p_subscription uuid, p_from date, p_to date)
returns table (booking_date date, booked boolean, motivo text)
language plpgsql security definer set search_path to 'public' as $$
declare s public.club_subscriptions%rowtype; d date; v_service text := 'Corte + Barba na navalha com toalha quente + Sobrancelha Masculina';
  v_price numeric; hoje date := (timezone('America/Sao_Paulo', now()))::date;
begin
  select * into s from public.club_subscriptions where id = p_subscription;
  if not found or s.fixed_weekday is null or s.fixed_time is null then return; end if;
  perform set_config('club.skip_lead', '1', true);
  d := greatest(p_from, hoje + 1);
  while d <= p_to loop
    if extract(isodow from d)::int = s.fixed_weekday then
      booking_date := d;
      if exists (select 1 from public.bookings b where b.club_subscription_id = s.id and b.booking_date = d and b.status in ('pending','confirmed','completed')) then
        booked := true; motivo := 'já marcado'; return next;
      elsif not exists (select 1 from public.get_available_slots(d, 85) g where g.slot_time = s.fixed_time) then
        booked := false; motivo := 'horário ocupado ou dia fechado'; return next;
      else
        begin
          v_price := coalesce((select p.price from public.service_price_on(v_service, d) p limit 1), 115);
          insert into public.bookings (customer_name, customer_phone, customer_email, service_name, service_price, duration_minutes, booking_date, start_time, status, channel, notes)
          values (s.name, regexp_replace(s.phone, '\D', '', 'g'), s.email, v_service, v_price, 85, d, s.fixed_time, 'confirmed', 'clube', 'Cadeira Cativa (horário fixo do Clube do Ju)');
          booked := true; motivo := null; return next;
        exception when others then
          booked := false; motivo := sqlerrm; return next;
        end;
      end if;
    end if;
    d := d + 1;
  end loop;
  perform set_config('club.skip_lead', '', true);
end $$;

create or replace function public.club_summary(p_subscription uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'code', s.code, 'status', s.status, 'name', s.name, 'plan_id', s.plan_id, 'plan_name', p.name, 'kind', p.kind,
    'visit_items', s.visit_items, 'visits_per_cycle', s.visits_per_cycle, 'extras_per_cycle', s.extras_per_cycle,
    'price', s.price, 'table_value', s.table_value, 'discount_pct', s.discount_pct,
    'fixed_weekday', s.fixed_weekday, 'fixed_time', to_char(s.fixed_time, 'HH24:MI'),
    'current_cycle_start', s.current_cycle_start, 'current_cycle_end', s.current_cycle_end,
    'cancel_at_cycle_end', s.cancel_at_cycle_end, 'accepted_at', s.accepted_at, 'terms_version', s.terms_version,
    'arrependimento_ate', (s.accepted_at + interval '7 days'),
    'bonus_visits', s.bonus_visits,
    'usadas_no_ciclo', (select count(*) from public.club_usage u where u.subscription_id = s.id and u.cycle_start = s.current_cycle_start and u.status in ('reservada','usada','perdida')),
    'proximos', coalesce((select jsonb_agg(jsonb_build_object('date', b.booking_date, 'time', to_char(b.start_time,'HH24:MI'), 'service', b.service_name, 'coberto', b.club_subscription_id is not null) order by b.booking_date, b.start_time)
        from public.bookings b where public.phone_match_key(b.customer_phone) = s.phone_mkey and b.status in ('pending','confirmed')
          and b.booking_date >= (timezone('America/Sao_Paulo', now()))::date), '[]'::jsonb),
    'cobranca_pendente', (select jsonb_build_object('amount', c.amount, 'pay_link', c.pay_link, 'expires_at', c.expires_at, 'cycle_start', c.cycle_start)
        from public.club_charges c where c.subscription_id = s.id and c.status = 'pendente' order by c.seq desc limit 1)
  )
  from public.club_subscriptions s join public.club_plans p on p.id = s.plan_id where s.id = p_subscription
$$;

create or replace function public.club_recover_coverage(p_subscription uuid)
returns int language plpgsql security definer set search_path to 'public' as $$
declare s public.club_subscriptions%rowtype; b record; q record; n int := 0; hoje date := (timezone('America/Sao_Paulo', now()))::date;
begin
  select * into s from public.club_subscriptions where id = p_subscription;
  if not found or s.status <> 'ativa' then return 0; end if;
  for b in select * from public.bookings x
            where public.phone_match_key(x.customer_phone) = s.phone_mkey and x.status in ('pending','confirmed')
              and x.booking_date >= hoje and x.club_subscription_id is null and coalesce(x.discount_amount,0) = 0
              and not coalesce(x.courtesy,false) and x.loyalty_reward_id is null and x.gift_card_id is null
            order by x.booking_date, x.start_time loop
    select * into q from public.club_quote(b.customer_phone, b.booking_date, b.service_name, b.created_at, s.fixed_weekday is not null and b.channel = 'clube', b.id) limit 1;
    if q.eligible then
      update public.bookings set club_subscription_id = s.id,
             discount_amount = least(coalesce(b.service_price,0), q.covered_value), discount_reason = 'Clube do Ju',
             service_price = greatest(0, coalesce(b.service_price,0) - least(coalesce(b.service_price,0), q.covered_value)), updated_at = now()
       where id = b.id;
      insert into public.club_usage (subscription_id, booking_id, cycle_start, covered_items, covered_value, status)
      values (s.id, b.id, q.cycle_start, q.covered_items, least(coalesce(b.service_price,0), q.covered_value), 'reservada')
      on conflict (booking_id) do update set status = 'reservada', subscription_id = excluded.subscription_id, cycle_start = excluded.cycle_start,
        covered_items = excluded.covered_items, covered_value = excluded.covered_value, updated_at = now();
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.club_fill_announcements()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  insert into public.club_announcements (phone_mkey, customer_id, phone, name)
  select distinct on (public.phone_match_key(p.phone)) public.phone_match_key(p.phone), p.id, regexp_replace(p.phone, '\D', '', 'g'), p.name
    from public.customer_profiles p
   where not coalesce(p.archived, false) and p.marketing_opt_out_at is null
     and length(regexp_replace(coalesce(p.phone,''), '\D', '', 'g')) between 10 and 13
     and (coalesce(p.prior_visits, 0) > 0 or exists (select 1 from public.bookings b where b.status = 'completed' and public.phone_match_key(b.customer_phone) = public.phone_match_key(p.phone)))
     and not exists (select 1 from public.club_subscriptions s where s.phone_mkey = public.phone_match_key(p.phone) and s.status in ('aguardando_pagamento','ativa','atrasada'))
   order by public.phone_match_key(p.phone), p.updated_at desc nulls last
  on conflict (phone_mkey) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.club_cativa_book(uuid, date, date) from public, anon, authenticated;
grant execute on function public.club_cativa_book(uuid, date, date) to service_role;
revoke all on function public.club_summary(uuid) from public, anon, authenticated;
grant execute on function public.club_summary(uuid) to service_role;
revoke all on function public.club_recover_coverage(uuid) from public, anon, authenticated;
grant execute on function public.club_recover_coverage(uuid) to service_role;
revoke all on function public.club_fill_announcements() from public, anon, authenticated;
grant execute on function public.club_fill_announcements() to service_role;

-- 5. Cron da rotina do Clube (a function confere a hora e o silêncio)
select cron.unschedule('bdj-clube-ciclo') where exists (select 1 from cron.job where jobname = 'bdj-clube-ciclo');
select cron.schedule('bdj-clube-ciclo', '*/10 * * * *', $cron$
  select case when extract(hour from (now() at time zone 'America/Sao_Paulo')) between 9 and 18 then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/clube-ciclo',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )) end;
$cron$);

-- 6. SAIR: customers_birthday_today, customers_due_for_reactivation e referral_invite_candidates ganharam
--    "and c.marketing_opt_out_at is null" no filtro de clientes (resto idêntico à versão anterior).
