-- v29.233.0 (24/09/2026) — CLUBE DO JU: assinatura mensal da Barbearia do Ju.
-- Regras aprovadas pelo Juliano em 24/09/2026 (ver CHANGELOG 29.233.0 e /clube/contrato/):
--   * só terça a quinta; agendamento pelo Clube com NO MÍNIMO 7 e NO MÁXIMO 30 dias de antecedência
--     (a Cadeira Cativa tem horário fixo semanal e não passa por essa régua);
--   * cancelou com menos de 24h ou faltou = visita usada; visita vence no fim do ciclo; intransferível;
--   * desconto pela tabela mensal do que o plano inclui: até R$119 15%, R$120-199 20%, R$200+ 25%;
--   * vagas: 20 nos planos + 5 na Cadeira Cativa; depois, lista de espera;
--   * visita coberta pelo Clube não gera ponto de fidelidade (o Clube já é o desconto).
-- Ciclo: mensal, a partir do dia em que o primeiro pagamento cai (cycle_anchor). Cada ciclo é pago
-- antes (link do PagBank com Pix ou cartão; cartão recorrente automático quando a conta for liberada).
-- Tabela nova em public depois de 30/10 precisa de GRANT explícito: já vai aqui em todas.

-- ---------------------------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------------------------
create table if not exists public.club_settings (
  id int primary key default 1 check (id = 1),
  vagas_geral int not null default 20,
  vagas_cativa int not null default 5,
  vendas_abertas boolean not null default true,
  terms_version text not null default 'v1',
  updated_at timestamptz not null default now()
);
insert into public.club_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.club_plans (
  id text primary key,
  name text not null,
  summary text not null,
  kind text not null check (kind in ('fixo', 'sob_medida', 'cativa')),
  visit_items text[] not null default '{}',       -- serviços cobertos em cada visita
  visits_per_cycle int,                            -- null na Cativa (1 por semana, horário fixo)
  extras_per_cycle jsonb not null default '{}',    -- {"Hidratação / Reconstrução Capilar": 1}
  table_value numeric(10,2),                       -- tabela mensal (preços de 01/10/2026)
  price numeric(10,2),                             -- mensalidade
  discount_pct int,
  pool text not null default 'geral' check (pool in ('geral', 'cativa')),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.club_terms (
  version text primary key,
  sha256 text not null,
  url text not null,
  published_at timestamptz not null default now()
);

create table if not exists public.club_subscriptions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  manage_token_hash text not null,
  customer_id uuid references public.customer_profiles(id) on delete set null,
  name text not null,
  phone text not null,
  phone_mkey text not null,
  email text,
  plan_id text not null references public.club_plans(id),
  visit_items text[] not null,
  visits_per_cycle int,
  extras_per_cycle jsonb not null default '{}',
  table_value numeric(10,2) not null,
  price numeric(10,2) not null,
  discount_pct int not null,
  fixed_weekday int check (fixed_weekday between 2 and 4),   -- ISO: 2=terça, 3=quarta, 4=quinta
  fixed_time time,
  payment_method text not null default 'link' check (payment_method in ('link', 'cartao_auto')),
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento', 'ativa', 'atrasada', 'cancelada', 'arrependida', 'expirada', 'encerrada')),
  cycle_anchor date,
  current_cycle_start date,
  current_cycle_end date,
  cancel_at_cycle_end boolean not null default false,
  pagbank_subscription_id text,
  terms_version text not null references public.club_terms(version),
  accepted_at timestamptz not null,
  accept_ip text,
  accept_user_agent text,
  accept_checks jsonb not null default '{}',
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  cancel_requested_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancel_channel text,
  refund_due numeric(10,2),
  refunded_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);
-- Um telefone, uma assinatura viva.
create unique index if not exists club_subscriptions_one_live_per_phone
  on public.club_subscriptions (phone_mkey) where status in ('aguardando_pagamento', 'ativa', 'atrasada');
create index if not exists club_subscriptions_status on public.club_subscriptions (status);

create table if not exists public.club_charges (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.club_subscriptions(id) on delete cascade,
  seq int not null,                                -- 1 = primeiro pagamento, 2 = primeira renovação…
  cycle_start date,                                -- preenchido quando o pagamento cai (1º) ou ao gerar (renovação)
  cycle_end date,
  amount numeric(10,2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'cancelada', 'expirada', 'estornada')),
  method text,
  reference_id text not null unique,
  pagbank_checkout_id text,
  pagbank_charge_id text,
  pay_link text,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (subscription_id, seq)
);

create table if not exists public.club_usage (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.club_subscriptions(id) on delete cascade,
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  cycle_start date not null,
  covered_items text[] not null,
  covered_value numeric(10,2) not null,
  status text not null default 'reservada' check (status in ('reservada', 'usada', 'perdida', 'devolvida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists club_usage_sub_cycle on public.club_usage (subscription_id, cycle_start);

create table if not exists public.club_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_mkey text not null,
  plan_id text references public.club_plans(id),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create table if not exists public.club_phone_codes (
  id uuid primary key default gen_random_uuid(),
  phone_mkey text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists club_phone_codes_phone on public.club_phone_codes (phone_mkey, created_at desc);

-- Divulgação para a base (mensagem única, em ritmo lento, com SAIR).
create table if not exists public.club_announcements (
  phone_mkey text primary key,
  customer_id uuid references public.customer_profiles(id) on delete set null,
  phone text not null,
  name text,
  status text not null default 'fila' check (status in ('fila', 'enviada', 'falhou', 'pulada')),
  variant int,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);

alter table public.customer_profiles add column if not exists marketing_opt_out_at timestamptz;
alter table public.bookings add column if not exists club_subscription_id uuid references public.club_subscriptions(id) on delete set null;
create index if not exists bookings_club_subscription on public.bookings (club_subscription_id) where club_subscription_id is not null;

-- ---------------------------------------------------------------------------------------------
-- 2. Segurança: RLS ligado; o painel (admin) lê; só as functions (service_role) escrevem.
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['club_settings','club_plans','club_terms','club_subscriptions','club_charges','club_usage','club_waitlist','club_phone_codes','club_announcements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant select on public.club_settings, public.club_plans, public.club_terms, public.club_subscriptions,
  public.club_charges, public.club_usage, public.club_waitlist, public.club_announcements to authenticated;
grant update on public.club_settings to authenticated;

drop policy if exists club_admin_read on public.club_settings;
create policy club_admin_read on public.club_settings for select to authenticated using (public.is_admin());
drop policy if exists club_admin_update on public.club_settings;
create policy club_admin_update on public.club_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
do $$
declare t text;
begin
  foreach t in array array['club_plans','club_terms','club_subscriptions','club_charges','club_usage','club_waitlist','club_announcements'] loop
    execute format('drop policy if exists club_admin_read on public.%I', t);
    execute format('create policy club_admin_read on public.%I for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Planos (preços da tabela de 01/10/2026)
-- ---------------------------------------------------------------------------------------------
insert into public.club_plans (id, name, summary, kind, visit_items, visits_per_cycle, extras_per_cycle, table_value, price, discount_pct, pool, sort) values
  ('clube-corte', 'Clube Corte', '2 cortes por mês', 'fixo', array['Corte de cabelo'], 2, '{}', 100, 85, 15, 'geral', 10),
  ('barba-em-dia', 'Barba em Dia', '4 Barba Express por mês (uma por semana)', 'fixo', array['Barba Express'], 4, '{}', 140, 112, 20, 'geral', 20),
  ('corte-barba', 'Corte + Barba', '2 Corte + Barba Express por mês', 'fixo', array['Corte + Barba Express'], 2, '{}', 160, 128, 20, 'geral', 30),
  ('barboterapia-semanal', 'Barboterapia Semanal', '4 Barboterapias por mês (uma por semana)', 'fixo', array['Barba na navalha com toalha quente'], 4, '{}', 200, 150, 25, 'geral', 40),
  ('clube-completo', 'Clube Completo', '2 Corte + Barboterapia com sobrancelha por mês', 'fixo', array['Corte + Barba na navalha com toalha quente', 'Sobrancelha Masculina'], 2, '{}', 230, 172, 25, 'geral', 50),
  ('sob-medida', 'Sob Medida', 'Você escolhe os serviços e quantas vezes vem no mês', 'sob_medida', '{}', null, '{}', null, null, null, 'geral', 60),
  ('cadeira-cativa', 'Cadeira Cativa', 'Seu horário fixo toda semana: corte, Barboterapia e sobrancelha, mais uma hidratação por mês', 'cativa',
     array['Corte + Barba na navalha com toalha quente', 'Sobrancelha Masculina'], null, '{"Hidratação / Reconstrução Capilar": 1}', 510, 249, null, 'cativa', 70)
on conflict (id) do update set name = excluded.name, summary = excluded.summary, kind = excluded.kind, visit_items = excluded.visit_items,
  visits_per_cycle = excluded.visits_per_cycle, extras_per_cycle = excluded.extras_per_cycle, table_value = excluded.table_value,
  price = excluded.price, discount_pct = excluded.discount_pct, pool = excluded.pool, sort = excluded.sort;

-- ---------------------------------------------------------------------------------------------
-- 4. Funções de apoio
-- ---------------------------------------------------------------------------------------------
-- "Corte + Barba na navalha com toalha quente + Sobrancelha Masculina" → os nomes do catálogo,
-- sem confundir o " + " dos combos (mesma leitura gulosa do service_price_on).
create or replace function public.club_split_services(p_service_name text)
returns text[] language plpgsql stable security definer set search_path to 'public' as $$
declare tokens text[]; n int; i int; j int; nome text; achou boolean; out_ text[] := '{}';
begin
  tokens := regexp_split_to_array(coalesce(p_service_name, ''), '\s+\+\s+');
  n := coalesce(array_length(tokens, 1), 0);
  i := 1;
  while i <= n loop
    achou := false;
    for j in reverse n..i loop
      nome := array_to_string(tokens[i:j], ' + ');
      if exists (select 1 from public.services s where s.name = nome) then
        out_ := out_ || nome; i := j + 1; achou := true; exit;
      end if;
    end loop;
    if not achou then out_ := out_ || tokens[i]; i := i + 1; end if;
  end loop;
  return out_;
end $$;

create or replace function public.club_item_price(p_item text, p_date date)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce((select p.price from public.service_price_on(p_item, p_date) p limit 1), 0)
$$;

-- Régua única de desconto do Clube (espelhada em supabase/functions/_shared/clube-regras.ts).
create or replace function public.club_discount_pct(p_table numeric)
returns int language sql immutable as $$
  select case when p_table >= 200 then 25 when p_table >= 120 then 20 else 15 end
$$;

-- Início do ciclo que contém a data (ciclos mensais a partir da âncora).
create or replace function public.club_cycle_start_for(p_anchor date, p_date date)
returns date language plpgsql immutable as $$
declare k int;
begin
  if p_anchor is null or p_date is null or p_date < p_anchor then return p_anchor; end if;
  k := (extract(year from age(p_date, p_anchor)) * 12 + extract(month from age(p_date, p_anchor)))::int;
  return (p_anchor + make_interval(months => k))::date;
end $$;

create or replace function public.club_now_sp() returns timestamp language sql stable as $$
  select timezone('America/Sao_Paulo', now())
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. O coração: um atendimento é coberto pelo Clube?
--    Devolve a assinatura, o que fica coberto e, se não cobre, o motivo em português simples.
-- ---------------------------------------------------------------------------------------------
create or replace function public.club_quote(
  p_phone text, p_date date, p_service_name text,
  p_created_at timestamptz default now(), p_skip_lead boolean default false, p_exclude_booking uuid default null)
returns table (
  subscription_id uuid, plan_name text, eligible boolean, reason text,
  covered_items text[], covered_value numeric, visits_left int, cycle_start date)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  s public.club_subscriptions%rowtype;
  v_items text[]; v_item text; v_cov text[] := '{}'; v_val numeric := 0;
  v_lead int; v_cycle date; v_cycle_end date; v_used int; v_limit int;
  v_extra_lim int; v_extra_used int; v_plan text; v_dow int;
  v_paid boolean;
begin
  select * into s from public.club_subscriptions c
   where c.phone_mkey = public.phone_match_key(p_phone) and c.status in ('ativa', 'atrasada', 'aguardando_pagamento')
   order by c.created_at desc limit 1;
  if not found then return; end if;
  select name into v_plan from public.club_plans where id = s.plan_id;
  subscription_id := s.id; plan_name := v_plan; eligible := false; covered_items := '{}'; covered_value := 0; visits_left := null;

  if s.status = 'aguardando_pagamento' then reason := 'A assinatura ainda aguarda o primeiro pagamento.'; return next; return; end if;
  if s.status = 'atrasada' then reason := 'A mensalidade do Clube está em aberto; o atendimento sai pelo preço normal até o pagamento.'; return next; return; end if;

  v_dow := extract(isodow from p_date)::int;
  if v_dow not in (2, 3, 4) then reason := 'O Clube vale de terça a quinta.'; return next; return; end if;

  if not p_skip_lead then
    v_lead := p_date - (timezone('America/Sao_Paulo', p_created_at))::date;
    if v_lead < 7 then reason := 'Pelo Clube, o horário é marcado com no mínimo 7 dias de antecedência.'; return next; return; end if;
    if v_lead > 30 then reason := 'Pelo Clube, o horário é marcado com no máximo 30 dias de antecedência.'; return next; return; end if;
  end if;

  v_cycle := public.club_cycle_start_for(s.cycle_anchor, p_date);
  v_cycle_end := ((v_cycle + interval '1 month')::date - 1);
  cycle_start := v_cycle;
  -- O ciclo da data precisa estar pago, ou ser o próximo de uma assinatura ativa que não pediu
  -- cancelamento (a renovação é cobrada antes do fim do ciclo atual).
  select exists (select 1 from public.club_charges ch where ch.subscription_id = s.id and ch.status = 'paga' and ch.cycle_start = v_cycle) into v_paid;
  if not v_paid then
    if s.cancel_at_cycle_end or v_cycle <> (s.current_cycle_end + 1) then
      reason := 'Essa data fica fora do período pago do Clube.'; return next; return;
    end if;
  end if;

  v_items := public.club_split_services(p_service_name);
  foreach v_item in array v_items loop
    if v_item = any (s.visit_items) then
      v_cov := v_cov || v_item;
    elsif s.extras_per_cycle ? v_item then
      v_extra_lim := (s.extras_per_cycle ->> v_item)::int;
      select count(*) into v_extra_used from public.club_usage u
       where u.subscription_id = s.id and u.cycle_start = v_cycle and u.status in ('reservada', 'usada', 'perdida')
         and v_item = any (u.covered_items) and (p_exclude_booking is null or u.booking_id <> p_exclude_booking);
      if v_extra_used < v_extra_lim then v_cov := v_cov || v_item; end if;
    end if;
  end loop;
  if coalesce(array_length(v_cov, 1), 0) = 0 then
    reason := 'Esse serviço não faz parte do seu plano.'; return next; return;
  end if;

  if s.fixed_weekday is not null then
    -- Cadeira Cativa: uma visita por semana.
    select count(*) into v_used from public.club_usage u join public.bookings b on b.id = u.booking_id
     where u.subscription_id = s.id and u.status in ('reservada', 'usada', 'perdida')
       and date_trunc('week', b.booking_date) = date_trunc('week', p_date)
       and (p_exclude_booking is null or u.booking_id <> p_exclude_booking);
    v_limit := 1;
  else
    select count(*) into v_used from public.club_usage u
     where u.subscription_id = s.id and u.cycle_start = v_cycle and u.status in ('reservada', 'usada', 'perdida')
       and (p_exclude_booking is null or u.booking_id <> p_exclude_booking);
    v_limit := coalesce(s.visits_per_cycle, 0);
  end if;
  visits_left := greatest(0, v_limit - v_used);
  if v_used >= v_limit then
    reason := case when s.fixed_weekday is not null then 'A visita desta semana do Clube já está marcada.' else 'As visitas do Clube neste ciclo já foram usadas.' end;
    return next; return;
  end if;

  foreach v_item in array v_cov loop v_val := v_val + public.club_item_price(v_item, p_date); end loop;
  eligible := true; reason := null; covered_items := v_cov; covered_value := v_val; visits_left := visits_left - 1;
  return next;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Gatilhos em bookings
-- ---------------------------------------------------------------------------------------------
-- Antes de gravar: se o atendimento cabe no Clube, abate o valor coberto (convenção da migration
-- 147: service_price LÍQUIDO + discount_amount/discount_reason). Roda depois do preço vigente
-- (ordem alfabética dos gatilhos: trg_bookings_* < trg_zz_*).
create or replace function public.club_booking_before_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare q record; v_skip boolean;
begin
  if new.status not in ('pending', 'confirmed') then return new; end if;
  if coalesce(new.courtesy, false) or new.gift_card_id is not null or new.loyalty_reward_id is not null or new.loyalty_free_service is not null then return new; end if;
  if coalesce(new.discount_amount, 0) > 0 then return new; end if;
  v_skip := coalesce(current_setting('club.skip_lead', true), '') = '1';
  select * into q from public.club_quote(new.customer_phone, new.booking_date, new.service_name, coalesce(new.created_at, now()), v_skip) limit 1;
  if q.subscription_id is null or not q.eligible then return new; end if;
  new.club_subscription_id := q.subscription_id;
  new.discount_amount := least(coalesce(new.service_price, 0), q.covered_value);
  new.discount_reason := 'Clube do Ju';
  new.service_price := greatest(0, coalesce(new.service_price, 0) - new.discount_amount);
  return new;
end $$;

create or replace function public.club_booking_after_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare s public.club_subscriptions%rowtype;
begin
  if new.club_subscription_id is null then return new; end if;
  select * into s from public.club_subscriptions where id = new.club_subscription_id;
  insert into public.club_usage (subscription_id, booking_id, cycle_start, covered_items, covered_value, status)
  select new.club_subscription_id, new.id, public.club_cycle_start_for(s.cycle_anchor, new.booking_date),
         (select coalesce(array_agg(x), '{}') from unnest(public.club_split_services(new.service_name)) x
           where x = any (s.visit_items) or s.extras_per_cycle ? x),
         new.discount_amount, 'reservada'
  on conflict (booking_id) do nothing;
  return new;
end $$;

-- Mudança de status: concluiu = usada; faltou = perdida; cancelou = devolvida, exceto quando o
-- próprio cliente cancelou com menos de 24h (perdida). Cancelamento feito pelo Juliano devolve.
create or replace function public.club_booking_after_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_novo text; v_inicio timestamptz;
begin
  if new.club_subscription_id is null or new.status is not distinct from old.status then return new; end if;
  v_inicio := ((new.booking_date + new.start_time) at time zone 'America/Sao_Paulo');
  v_novo := case
    when new.status = 'completed' then 'usada'
    when new.status = 'no_show' then 'perdida'
    when new.status = 'cancelled' and new.customer_cancelled_at is not null and v_inicio - new.customer_cancelled_at < interval '24 hours' then 'perdida'
    when new.status = 'cancelled' then 'devolvida'
    when new.status in ('pending', 'confirmed') then 'reservada'
    else null end;
  if v_novo is not null then
    update public.club_usage set status = v_novo, updated_at = now() where booking_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_zz_club_before_insert on public.bookings;
create trigger trg_zz_club_before_insert before insert on public.bookings for each row execute function public.club_booking_before_insert();
drop trigger if exists trg_zz_club_after_insert on public.bookings;
create trigger trg_zz_club_after_insert after insert on public.bookings for each row execute function public.club_booking_after_insert();
drop trigger if exists trg_zz_club_after_status on public.bookings;
create trigger trg_zz_club_after_status after update of status on public.bookings for each row execute function public.club_booking_after_status();

-- Tira a cobertura dos horários futuros que caíram fora do período pago (cancelamento no fim do
-- ciclo, arrependimento, mensalidade em aberto). O atendimento continua marcado, pelo preço normal.
create or replace function public.club_uncover_future(p_subscription uuid, p_from date)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; b record;
begin
  for b in select id, service_price, discount_amount from public.bookings
            where club_subscription_id = p_subscription and status in ('pending', 'confirmed') and booking_date >= p_from loop
    update public.bookings set service_price = coalesce(b.service_price, 0) + coalesce(b.discount_amount, 0),
           discount_amount = 0, discount_reason = null, club_subscription_id = null, updated_at = now()
     where id = b.id;
    update public.club_usage set status = 'devolvida', updated_at = now() where booking_id = b.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Fidelidade: visita coberta pelo Clube não pontua (regra de 14/08, mantida em 24/09).
--    Mesma função da v21, com a condição a mais no bloco de crédito de pontos.
-- ---------------------------------------------------------------------------------------------
create or replace function public.v21_sync_loyalty_on_completed_booking()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_customer uuid;
  v_points integer;
  v_rewards integer;
  v_reward_id uuid;
  v_reward_customer uuid;
  v_completing boolean;
  v_usa_premio boolean;
  v_n integer;
begin
  v_completing := new.status = 'completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed');

  v_usa_premio := v_completing and not coalesce(new.courtesy, false)
    and (new.loyalty_reward_id is not null
         or coalesce(new.loyalty_discount, 0) > 0
         or new.payment_method = 'fidelidade');
  if v_usa_premio then
    v_reward_id := null; v_reward_customer := null;
    if new.loyalty_reward_id is not null then
      update public.loyalty_rewards
         set status = 'redeemed', redeemed_at = now(), booking_id = new.id, updated_at = now()
       where id = new.loyalty_reward_id and status in ('available','reserved')
       returning id, customer_id into v_reward_id, v_reward_customer;
    else
      v_customer := public.v27_customer_for_booking(new);
      if v_customer is not null then
        select r.id, r.customer_id into v_reward_id, v_reward_customer
          from public.loyalty_rewards r
         where r.customer_id = v_customer
           and (r.status = 'available' or (r.status = 'reserved' and r.booking_id = new.id))
         order by r.earned_at asc
         limit 1
         for update;
        if v_reward_id is not null then
          update public.loyalty_rewards
             set status = 'redeemed', redeemed_at = now(), booking_id = new.id, updated_at = now()
           where id = v_reward_id;
        elsif exists (select 1 from public.loyalty_accounts la where la.customer_id = v_customer and la.rewards_available > 0) then
          insert into public.loyalty_rewards(customer_id, status, earned_at, expires_at, booking_id, redeemed_at, notified_at)
            values (v_customer, 'redeemed', now(), now(), new.id, now(), now())
            returning id into v_reward_id;
          v_reward_customer := v_customer;
        end if;
        if v_reward_id is not null then
          update public.bookings set loyalty_reward_id = v_reward_id where id = new.id;
        end if;
      end if;
    end if;

    if v_reward_customer is not null then
      update public.loyalty_accounts
         set rewards_available = greatest(0, rewards_available - 1), updated_at = now()
       where customer_id = v_reward_customer;
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_reward_customer, new.id, 'redeem', 0,
                'Prêmio resgatado: ' || coalesce(nullif(trim(new.loyalty_free_service), ''), new.service_name) || ' por nossa conta')
        on conflict do nothing;
    elsif v_customer is not null then
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_customer, new.id, 'redeem', 0,
                'Serviço por nossa conta SEM prêmio disponível no sistema: ' || coalesce(nullif(trim(new.loyalty_free_service), ''), new.service_name))
        on conflict do nothing;
    end if;
  end if;

  if v_completing and not coalesce(new.courtesy, false)
     and new.club_subscription_id is null
     and not (coalesce(new.service_price, 0) <= 0 and coalesce(new.products_price, 0) > 0) then
    v_customer := public.v27_customer_for_booking(new);
    if v_customer is not null then
      v_n := public.loyalty_points_for_service(new.service_name);
      insert into public.loyalty_accounts(customer_id) values (v_customer)
        on conflict (customer_id) do nothing;
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_customer, new.id, 'earn', v_n,
                'Atendimento concluído' || case when v_n > 1 then format(' (%s serviços, %s pontos)', v_n, v_n) else '' end)
        on conflict do nothing;
      if found then
        update public.loyalty_accounts
           set points = points + v_n, lifetime_points = lifetime_points + v_n, updated_at = now()
         where customer_id = v_customer
         returning points, rewards_available into v_points, v_rewards;
        while v_points >= 10 loop
          v_points := v_points - 10;
          v_rewards := v_rewards + 1;
          update public.loyalty_accounts
             set points = v_points, rewards_available = v_rewards, updated_at = now()
           where customer_id = v_customer;
          insert into public.loyalty_rewards(customer_id, earned_at, expires_at)
            values (v_customer, now(), now() + interval '30 days');
        end loop;
      end if;
    end if;
  end if;

  if new.loyalty_reward_id is not null
     and new.status in ('cancelled','no_show')
     and (TG_OP = 'INSERT' or coalesce(old.status,'') not in ('cancelled','no_show')) then
    update public.loyalty_rewards
       set status = 'available', booking_id = null, updated_at = now()
     where id = new.loyalty_reward_id and status = 'reserved';
  end if;

  return new;
end
$function$;

-- ---------------------------------------------------------------------------------------------
-- 8. Vagas e horários da Cadeira Cativa
-- ---------------------------------------------------------------------------------------------
create or replace function public.club_vagas()
returns table (pool text, total int, ocupadas int, livres int, vendas_abertas boolean)
language sql stable security definer set search_path to 'public' as $$
  with cfg as (select * from public.club_settings where id = 1),
  vivas as (
    select p.pool, count(*)::int n from public.club_subscriptions s join public.club_plans p on p.id = s.plan_id
     where s.status in ('ativa', 'atrasada') or (s.status = 'aguardando_pagamento' and s.created_at > now() - interval '24 hours')
     group by p.pool)
  select x.pool, x.total, coalesce(v.n, 0), greatest(0, x.total - coalesce(v.n, 0)), cfg.vendas_abertas
    from cfg, lateral (values ('geral', cfg.vagas_geral), ('cativa', cfg.vagas_cativa)) x(pool, total)
    left join vivas v on v.pool = x.pool
$$;

-- Horários fixos possíveis para a Cadeira Cativa: terça a quinta, livres nas próximas 5 semanas
-- (a partir de 7 dias) e sem outra Cativa no mesmo dia e hora.
create or replace function public.club_cativa_slots()
returns table (weekday int, slot_time time)
language plpgsql stable security definer set search_path to 'public' as $$
declare d date; wd int; t time; semana int; ok boolean; dur int := 85; hoje date := (timezone('America/Sao_Paulo', now()))::date;
begin
  for wd in 2..4 loop
    d := hoje + 7;
    while extract(isodow from d)::int <> wd loop d := d + 1; end loop;
    for t in select s.slot_time from public.get_available_slots(d, dur) s order by 1 loop
      ok := true;
      for semana in 1..4 loop
        if not exists (select 1 from public.get_available_slots(d + semana * 7, dur) s2 where s2.slot_time = t) then ok := false; exit; end if;
      end loop;
      if ok and exists (select 1 from public.club_subscriptions c where c.fixed_weekday = wd and c.fixed_time = t
                         and (c.status in ('ativa', 'atrasada') or (c.status = 'aguardando_pagamento' and c.created_at > now() - interval '24 hours'))) then
        ok := false;
      end if;
      if ok then weekday := wd; slot_time := t; return next; end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Permissões das funções: só backend (e o painel lê o que precisa pelas tabelas).
-- ---------------------------------------------------------------------------------------------
revoke all on function public.club_quote(text, date, text, timestamptz, boolean, uuid) from public, anon, authenticated;
grant execute on function public.club_quote(text, date, text, timestamptz, boolean, uuid) to service_role;
revoke all on function public.club_uncover_future(uuid, date) from public, anon, authenticated;
grant execute on function public.club_uncover_future(uuid, date) to service_role;
revoke all on function public.club_cativa_slots() from public, anon, authenticated;
grant execute on function public.club_cativa_slots() to service_role;
revoke all on function public.club_vagas() from public, anon;
grant execute on function public.club_vagas() to service_role, authenticated;
revoke all on function public.club_split_services(text) from public, anon;
grant execute on function public.club_split_services(text) to service_role, authenticated;
grant execute on function public.club_item_price(text, date) to service_role;
grant execute on function public.club_discount_pct(numeric) to service_role, authenticated, anon;
grant execute on function public.club_cycle_start_for(date, date) to service_role, authenticated;
