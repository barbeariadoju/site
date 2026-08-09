-- v29.10.0 — Prêmios de fidelidade viram registros individuais (não só um contador),
-- pra dar prazo de resgate (30 dias), avisar o cliente quando ganha, aplicar sozinho no
-- agendamento e ligar/desligar a reserva conforme o agendamento anda (cancela/conclui).

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  status text not null default 'available' check (status in ('available','reserved','redeemed','expired')),
  earned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  booking_id uuid references public.bookings(id),
  redeemed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_rewards enable row level security;
drop policy if exists "admin_all_loyalty_rewards" on public.loyalty_rewards;
create policy "admin_all_loyalty_rewards" on public.loyalty_rewards for all using (public.is_admin()) with check (public.is_admin());
grant select, update on public.loyalty_rewards to authenticated;
grant select, insert, update on public.loyalty_rewards to service_role;
create index if not exists loyalty_rewards_customer_idx on public.loyalty_rewards(customer_id, status);
create index if not exists loyalty_rewards_notify_idx on public.loyalty_rewards(status, notified_at) where status = 'available';

alter table public.bookings add column if not exists loyalty_reward_id uuid references public.loyalty_rewards(id);
alter table public.bookings add column if not exists loyalty_discount numeric not null default 0;

-- Estende o trigger de fidelidade existente: (1) cada vez que um prêmio nasce (10
-- carimbos), grava a linha em loyalty_rewards com prazo de 30 dias; (2) se o agendamento
-- que está mudando de status tinha um prêmio RESERVADO, resgata de vez (concluiu) ou
-- devolve pra disponível (cancelou/faltou), sem depender de qual caminho de código mudou
-- o status (admin, WhatsApp, etc. — o trigger cobre todos).
create or replace function public.v21_sync_loyalty_on_completed_booking()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_points integer; v_rewards integer;
begin
  if new.status='completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed') then
    select id into v_customer from public.customer_profiles
      where phone=regexp_replace(new.customer_phone,'\D','','g') and archived=false limit 1;
    if v_customer is not null then
      insert into public.loyalty_accounts(customer_id) values(v_customer)
        on conflict(customer_id) do nothing;
      insert into public.loyalty_events(customer_id,booking_id,event_type,points_delta,description)
        values(v_customer,new.id,'earn',1,'Atendimento concluído')
        on conflict do nothing;
      if found then
        update public.loyalty_accounts
          set points=points+1,lifetime_points=lifetime_points+1,updated_at=now()
          where customer_id=v_customer
          returning points,rewards_available into v_points,v_rewards;
        while v_points >= 10 loop
          v_points := v_points - 10;
          v_rewards := v_rewards + 1;
          update public.loyalty_accounts
            set points=v_points,rewards_available=v_rewards,updated_at=now()
            where customer_id=v_customer;
          insert into public.loyalty_rewards(customer_id,earned_at,expires_at)
            values(v_customer, now(), now() + interval '30 days');
        end loop;
      end if;
    end if;
  end if;

  if new.loyalty_reward_id is not null then
    if new.status='completed' and (TG_OP='INSERT' or coalesce(old.status,'')<>'completed') then
      update public.loyalty_rewards set status='redeemed', redeemed_at=now(), updated_at=now()
        where id=new.loyalty_reward_id and status='reserved';
    elsif new.status in ('cancelled','no_show') and (TG_OP='INSERT' or coalesce(old.status,'') not in ('cancelled','no_show')) then
      update public.loyalty_rewards set status='available', booking_id=null, updated_at=now()
        where id=new.loyalty_reward_id and status='reserved';
    end if;
  end if;

  return new;
end
$$;

-- Mesmo estouro (10 carimbos = 1 prêmio) no ajuste manual (admin_apply_completion_extras
-- chama esta função) — sem isso, um bônus manual que cruza a marca de 10 não geraria
-- registro de prêmio nem prazo de expiração.
create or replace function public.admin_adjust_loyalty_points(
  p_customer_id uuid,
  p_delta integer,
  p_description text default null
)
returns table(points integer, rewards_available integer, lifetime_points integer)
language plpgsql security definer set search_path = public as $$
declare v_points integer; v_rewards integer; v_lifetime integer;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'p_delta precisa ser diferente de zero';
  end if;

  insert into public.loyalty_accounts(customer_id) values (p_customer_id)
    on conflict (customer_id) do nothing;

  insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
    values (p_customer_id, null, 'adjustment', p_delta, coalesce(p_description, 'Ajuste manual de carimbos'));

  update public.loyalty_accounts
    set points = greatest(0, points + p_delta),
        lifetime_points = greatest(0, lifetime_points + p_delta),
        updated_at = now()
    where customer_id = p_customer_id
    returning points, rewards_available, lifetime_points into v_points, v_rewards, v_lifetime;

  while v_points >= 10 loop
    v_points := v_points - 10;
    v_rewards := v_rewards + 1;
    update public.loyalty_accounts
      set points = v_points, rewards_available = v_rewards, updated_at = now()
      where customer_id = p_customer_id;
    insert into public.loyalty_rewards(customer_id,earned_at,expires_at)
      values (p_customer_id, now(), now() + interval '30 days');
  end loop;

  return query select v_points, v_rewards, v_lifetime;
end;
$$;
revoke all on function public.admin_adjust_loyalty_points(uuid, integer, text) from public;
grant execute on function public.admin_adjust_loyalty_points(uuid, integer, text) to authenticated;

-- Reserva 1 prêmio disponível pra um agendamento recém-criado e já desconta o valor do
-- serviço que ficou grátis. Chamada DEPOIS de create_public_booking_v15 (não mexo na
-- assinatura dela, é o caminho mais crítico do sistema) — não bloqueia o agendamento se
-- falhar, é sempre best-effort a partir de quem chama.
create or replace function public.reserve_loyalty_reward(
  p_phone text, p_booking_id uuid, p_discount numeric, p_freed_service_name text default null
) returns table(reserved boolean, reward_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_phone text; v_customer_id uuid; v_reward_id uuid; v_service_price numeric;
begin
  v_phone := regexp_replace(p_phone,'\D','','g');
  select id into v_customer_id from public.customer_profiles where public.phone_match_key(phone)=public.phone_match_key(v_phone) limit 1;
  if v_customer_id is null then return query select false, null::uuid; return; end if;

  select id into v_reward_id from public.loyalty_rewards
    where customer_id=v_customer_id and status='available'
    order by earned_at asc limit 1 for update skip locked;
  if v_reward_id is null then return query select false, null::uuid; return; end if;

  update public.loyalty_rewards set status='reserved', booking_id=p_booking_id, updated_at=now() where id=v_reward_id;

  select service_price into v_service_price from public.bookings where id=p_booking_id;
  update public.bookings set
    loyalty_reward_id=v_reward_id,
    loyalty_discount=least(coalesce(p_discount,0), coalesce(v_service_price,0)),
    service_price=greatest(0, coalesce(v_service_price,0) - coalesce(p_discount,0)),
    notes = case when p_freed_service_name is not null then trim(both E'\n' from coalesce(notes||E'\n','') || 'Fidelidade: ' || p_freed_service_name || ' por nossa conta.') else notes end
    where id=p_booking_id;

  return query select true, v_reward_id;
end $$;
revoke all on function public.reserve_loyalty_reward(text,uuid,numeric,text) from public;
grant execute on function public.reserve_loyalty_reward(text,uuid,numeric,text) to service_role;

-- Fila de aviso "parabéns, completou 10 pontos" (cron loyalty-rewards-notify consome).
create or replace function public.loyalty_rewards_due_for_notice()
returns table(reward_id uuid, customer_id uuid, name text, phone text, expires_at timestamptz)
language sql security definer set search_path = public as $$
  select r.id, r.customer_id, c.name, c.phone, r.expires_at
  from public.loyalty_rewards r
  join public.customer_profiles c on c.id = r.customer_id
  where r.status = 'available' and r.notified_at is null;
$$;
revoke all on function public.loyalty_rewards_due_for_notice() from public;
grant execute on function public.loyalty_rewards_due_for_notice() to service_role;

create or replace function public.expire_loyalty_rewards() returns void
language sql security definer set search_path = public as $$
  update public.loyalty_rewards set status = 'expired', updated_at = now()
  where status = 'available' and expires_at < now();
$$;
revoke all on function public.expire_loyalty_rewards() from public;
grant execute on function public.expire_loyalty_rewards() to service_role, postgres;

select cron.schedule('bdj-loyalty-rewards-expire', '30 6 * * *', $$select public.expire_loyalty_rewards();$$);

select cron.schedule(
  'bdj-loyalty-rewards-notify',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/loyalty-rewards-notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
