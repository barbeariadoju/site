-- v29.209.0 (19/09/2026) — Presente de aniversário estruturado + programa de indicação.
--
-- Pedido do Juliano: "estruture isto de forma que fique profissional e nos proteja e também
-- garanta que o cliente goze de seu benefício" (aniversário) e "estruture e coloque pra rodar"
-- (indicação). Até aqui o WhatsApp de aniversário prometia "um serviço extra por nossa conta"
-- sem dizer qual nem até quando, nada no painel lembrava o Juliano e a JuIA não sabia do
-- presente. Regras completas e públicas em /beneficios.html.
--
-- Uma tabela só para os dois (customer_benefits), com validade, baixa automática e rastro:
--   aniversario          — 1 Sobrancelha Masculina por conta da casa, junto com um serviço
--                          pago, do dia do aniversário até 30 dias depois; 1 por ano.
--   indicacao_indicado   — R$ 10 no 1º atendimento de quem nunca foi atendido e agendou pelo
--                          link de um cliente; só de terça a quinta (dias fracos); 60 dias.
--   indicacao_indicador  — R$ 10 no próximo atendimento de quem indicou, criado SÓ quando o
--                          indicado conclui e paga o 1º atendimento; 60 dias; até 3 por mês.
-- Aplicação: no "Concluir" do painel, pelo desconto manual (v29.162.0) com o motivo
-- "Presente de aniversário" ou "Indicação: …". O gatilho abaixo dá a baixa sozinho ao concluir.

create table if not exists public.customer_benefits (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('aniversario','indicacao_indicado','indicacao_indicador')),
  customer_id uuid references public.customer_profiles(id) on delete set null,
  phone text not null,
  phone_mkey text generated always as (public.phone_match_key(phone)) stored,
  status text not null default 'available' check (status in ('available','redeemed','expired','cancelled')),
  amount numeric(10,2),
  service_name text,
  weekdays int[],
  valid_from date not null default (now() at time zone 'America/Sao_Paulo')::date,
  valid_until date not null,
  referral_booking_id uuid references public.bookings(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  redeemed_at timestamptz,
  notified_at timestamptz,
  reminded_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.customer_benefits enable row level security;
drop policy if exists "admin_all_customer_benefits" on public.customer_benefits;
create policy "admin_all_customer_benefits" on public.customer_benefits for all using (public.is_admin()) with check (public.is_admin());
grant select, update on public.customer_benefits to authenticated;
grant select, insert, update on public.customer_benefits to service_role;
create index if not exists customer_benefits_mkey_idx on public.customer_benefits(phone_mkey, status);
-- 1 presente de aniversário por pessoa por ano; 1 benefício de indicado por pessoa (para
-- sempre); 1 crédito de indicador por atendimento do indicado.
create unique index if not exists customer_benefits_aniv_ano on public.customer_benefits(phone_mkey, (extract(year from valid_from))) where kind = 'aniversario';
create unique index if not exists customer_benefits_indicado_uma_vez on public.customer_benefits(phone_mkey) where kind = 'indicacao_indicado';
create unique index if not exists customer_benefits_indicador_por_booking on public.customer_benefits(referral_booking_id) where kind = 'indicacao_indicador';

alter table public.customer_profiles add column if not exists referral_code text;
create unique index if not exists customer_profiles_referral_code_uq on public.customer_profiles(referral_code) where referral_code is not null;
alter table public.bookings add column if not exists referral_code text;
alter table public.bookings add column if not exists referred_by_customer_id uuid references public.customer_profiles(id) on delete set null;

-- Código de indicação: "JU" + 4 caracteres sem os ambíguos (0/O, 1/I/L).
create or replace function public.ensure_referral_code(p_customer_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_try int := 0; v_alfa text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select referral_code into v_code from public.customer_profiles where id = p_customer_id;
  if v_code is not null then return v_code; end if;
  loop
    v_try := v_try + 1;
    v_code := 'JU' || (select string_agg(substr(v_alfa, 1 + floor(random() * length(v_alfa))::int, 1), '') from generate_series(1, 4));
    begin
      update public.customer_profiles set referral_code = v_code where id = p_customer_id and referral_code is null;
      if found then return v_code; end if;
      select referral_code into v_code from public.customer_profiles where id = p_customer_id;
      return v_code;
    exception when unique_violation then
      if v_try > 20 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.ensure_referral_code(uuid) from public, anon, authenticated;
grant execute on function public.ensure_referral_code(uuid) to service_role;

-- Presente de aniversário: nasce no dia (chamado pela customer-birthday antes do WhatsApp).
create or replace function public.grant_birthday_benefit(p_customer_id uuid)
returns date language plpgsql security definer set search_path = public as $$
declare v_phone text; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_ate date;
begin
  select phone into v_phone from public.customer_profiles where id = p_customer_id and archived = false;
  if v_phone is null then return null; end if;
  insert into public.customer_benefits(kind, customer_id, phone, service_name, valid_from, valid_until)
  values ('aniversario', p_customer_id, v_phone, 'Sobrancelha Masculina', v_hoje, v_hoje + 30)
  on conflict do nothing;
  select valid_until into v_ate from public.customer_benefits
   where kind = 'aniversario' and phone_mkey = public.phone_match_key(v_phone)
     and extract(year from valid_from) = extract(year from v_hoje);
  return v_ate;
end $$;
revoke all on function public.grant_birthday_benefit(uuid) from public, anon, authenticated;
grant execute on function public.grant_birthday_benefit(uuid) to service_role;

-- Indicação: chamada pela create-public-booking logo depois de criar o agendamento.
create or replace function public.register_referral(p_booking_id uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype; r public.customer_profiles%rowtype; v_mkey text; v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code !~ '^[A-Z0-9]{4,10}$' then return 'codigo_invalido'; end if;
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then return 'sem_agendamento'; end if;
  select * into r from public.customer_profiles where referral_code = v_code and archived = false;
  if r.id is null then return 'codigo_invalido'; end if;
  v_mkey := public.phone_match_key(b.customer_phone);
  if public.phone_match_key(r.phone) = v_mkey
     or (nullif(trim(r.email), '') is not null and lower(trim(r.email)) = lower(trim(coalesce(b.customer_email, '')))) then
    return 'autoindicacao';
  end if;
  if exists (select 1 from public.bookings x where x.id <> b.id and x.status = 'completed' and public.phone_match_key(x.customer_phone) = v_mkey)
     or exists (select 1 from public.customer_profiles c where public.phone_match_key(c.phone) = v_mkey and coalesce(c.prior_visits, 0) > 0) then
    return 'ja_cliente';
  end if;
  if exists (select 1 from public.customer_benefits where kind = 'indicacao_indicado' and phone_mkey = v_mkey) then
    return 'ja_indicado';
  end if;
  update public.bookings set referral_code = v_code, referred_by_customer_id = r.id where id = b.id;
  insert into public.customer_benefits(kind, phone, amount, weekdays, valid_until, referral_booking_id, meta)
  values ('indicacao_indicado', b.customer_phone, 10, array[2,3,4], (now() at time zone 'America/Sao_Paulo')::date + 60, b.id,
          jsonb_build_object('referrer_id', r.id, 'referrer_code', v_code));
  return 'ok';
end $$;
revoke all on function public.register_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.register_referral(uuid, text) to service_role;

-- Baixa e crédito ao concluir. Nunca derruba a conclusão: qualquer erro vira aviso no log.
create or replace function public.benefits_on_booking_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_motivo text; v_mkey text; v_id uuid; r public.customer_profiles%rowtype; v_mes int;
begin
  if new.status <> 'completed' or coalesce(old.status, '') = 'completed' then return new; end if;
  begin
    v_mkey := public.phone_match_key(new.customer_phone);
    -- o % do botão rápido vem na frente ("20% · Presente de aniversário")
    v_motivo := regexp_replace(coalesce(new.discount_reason, ''), '^\s*\d+%\s*·\s*', '');
    if v_motivo ilike 'Presente de anivers%' then
      select id into v_id from public.customer_benefits
       where kind = 'aniversario' and status = 'available' and phone_mkey = v_mkey order by valid_until limit 1;
    elsif v_motivo ilike 'Indica%' then
      select id into v_id from public.customer_benefits
       where kind in ('indicacao_indicado', 'indicacao_indicador') and status = 'available' and phone_mkey = v_mkey
       order by (kind = 'indicacao_indicado') desc, valid_until limit 1;
    end if;
    if v_id is not null then
      update public.customer_benefits set status = 'redeemed', booking_id = new.id, redeemed_at = now() where id = v_id;
    end if;

    -- Crédito de quem indicou: 1º atendimento do indicado concluído e PAGO (não cortesia).
    if new.referred_by_customer_id is not null
       and not coalesce(new.courtesy, false)
       and coalesce(new.service_price, 0) > 0
       and not exists (select 1 from public.bookings x where x.id <> new.id and x.status = 'completed' and public.phone_match_key(x.customer_phone) = v_mkey) then
      select * into r from public.customer_profiles where id = new.referred_by_customer_id and archived = false;
      select count(*) into v_mes from public.customer_benefits
       where kind = 'indicacao_indicador' and customer_id = r.id
         and date_trunc('month', created_at at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo');
      if r.id is not null and v_mes < 3 then
        insert into public.customer_benefits(kind, customer_id, phone, amount, valid_until, referral_booking_id, meta)
        values ('indicacao_indicador', r.id, r.phone, 10, (now() at time zone 'America/Sao_Paulo')::date + 60, new.id,
                jsonb_build_object('indicado_nome', split_part(trim(coalesce(new.customer_name, '')), ' ', 1)))
        on conflict do nothing;
      end if;
    end if;
  exception when others then
    raise warning '[benefits_on_booking_completed] %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists trg_benefits_on_booking_completed on public.bookings;
create trigger trg_benefits_on_booking_completed after update of status on public.bookings
for each row execute function public.benefits_on_booking_completed();

create or replace function public.expire_customer_benefits()
returns integer language sql security definer set search_path = public as $$
  with x as (
    update public.customer_benefits set status = 'expired'
     where status = 'available' and valid_until < (now() at time zone 'America/Sao_Paulo')::date
    returning 1)
  select count(*)::int from x;
$$;
revoke all on function public.expire_customer_benefits() from public, anon, authenticated;
grant execute on function public.expire_customer_benefits() to service_role;
