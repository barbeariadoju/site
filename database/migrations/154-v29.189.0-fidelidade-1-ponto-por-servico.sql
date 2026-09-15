-- v29.189.0 — Fidelidade: 1 ponto por SERVIÇO contratado; combo do catálogo vale 1
-- (decisão do Juliano, 15/09/2026, ~11h10: "combos valem 1 porque tem desconto; agora se
-- contratar 2 serviços valem 2 pontos").
--
-- Até aqui (v29.9.0) todo atendimento concluído valia 1 ponto, tivesse 1 ou 3 serviços. O caso
-- Juliano Prando (sexta 12/09: "Raspar a cabeça + Barba na navalha com toalha quente", dois
-- serviços de tabela, 1 ponto) levantou a regra. Fica assim:
--   - cada item do CATÁLOGO (public.services, ativo) que aparece no service_name vale 1 ponto;
--   - combo do catálogo ("Corte + Barba Express", "Corte + Lavagem", "Corte + Barba na navalha…")
--     é UM item — já tem desconto no preço, então vale 1;
--   - dois itens somados no agendamento ("Corte de cabelo + Barba Express", "Corte + Lavagem +
--     Barba Express", "Raspar a cabeça + Barba na navalha…") valem 1 cada.
-- A leitura do service_name é a mesma da tela de Concluir (matchCurrentServiceNames, v28.x):
-- gulosa, casa o nome de catálogo MAIS LONGO no início do texto; o que não casa conta 1 por
-- pedaço separado por "+" (nomes antigos de serviço que saíram do catálogo continuam valendo).
-- Nunca menos de 1 ponto por atendimento concluído. Sem retroativo: vale daqui pra frente.
--
-- Um evento 'earn' por atendimento (índice loyalty_one_earn_per_booking), com points_delta = N.

create or replace function public.loyalty_points_for_service(p_service_name text)
returns integer language plpgsql stable set search_path = public as $$
declare
  v_rest text := trim(coalesce(p_service_name, ''));
  v_count integer := 0;
  v_hit text;
  v_idx integer;
begin
  if v_rest = '' then return 1; end if;
  while v_rest <> '' loop
    select s.name into v_hit
      from public.services s
     where s.active
       and lower(left(v_rest, length(s.name))) = lower(s.name)
       and (length(v_rest) = length(s.name) or substr(v_rest, length(s.name) + 1) ~ '^\s*\+')
     order by length(s.name) desc
     limit 1;
    if v_hit is not null then
      v_count := v_count + 1;
      v_rest := regexp_replace(substr(v_rest, length(v_hit) + 1), '^\s*\+\s*', '');
    else
      v_idx := position('+' in v_rest);
      if v_idx = 0 then
        if trim(v_rest) <> '' then v_count := v_count + 1; end if;
        v_rest := '';
      else
        if trim(substr(v_rest, 1, v_idx - 1)) <> '' then v_count := v_count + 1; end if;
        v_rest := substr(v_rest, v_idx + 1);
      end if;
    end if;
    v_rest := trim(v_rest);
  end loop;
  return greatest(1, v_count);
end $$;
revoke all on function public.loyalty_points_for_service(text) from public;
grant execute on function public.loyalty_points_for_service(text) to authenticated, service_role;

-- Gatilho: igual à migration 153, só o bloco do ponto muda (N em vez de 1).
create or replace function public.v21_sync_loyalty_on_completed_booking()
returns trigger language plpgsql security definer set search_path=public as $$
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

  -- ---- 2. Baixa do prêmio usado neste atendimento (antes do ponto do dia) ----
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

  -- ---- 1. Pontos do atendimento concluído: 1 por serviço do catálogo (combo = 1) ----
  if v_completing and not coalesce(new.courtesy, false)
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

  -- ---- 3. Prêmio reservado pela JuIA num atendimento que cancelou/faltou: devolve ----
  if new.loyalty_reward_id is not null
     and new.status in ('cancelled','no_show')
     and (TG_OP = 'INSERT' or coalesce(old.status,'') not in ('cancelled','no_show')) then
    update public.loyalty_rewards
       set status = 'available', booking_id = null, updated_at = now()
     where id = new.loyalty_reward_id and status = 'reserved';
  end if;

  return new;
end
$$;
