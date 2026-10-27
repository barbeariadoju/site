-- v29.309.0 — Fim do programa de pontos (decisão do Juliano, 27/10/2026).
-- Regra: quem tinha pontos em 27/10/2026 continua juntando até completar 10 e ganhar UM último prêmio,
-- desde que complete até 31/03/2027. Fechou o prêmio, o saldo zera e para de juntar. Quem tinha 0
-- ponto (ou chega agora) não junta mais. Prêmio já ganho continua valendo (30 dias, como sempre).
-- Não precisa de coluna nova: depois de hoje só pode ter ponto quem já tinha (o acúmulo exige saldo > 0),
-- e o merge de cadastros, que soma saldos, continua certo sozinho.
-- Antes (v21_sync_loyalty_on_completed_booking): todo atendimento concluído pago creditava pontos e o
-- laço gerava quantos prêmios coubessem.

-- Fonte única da data-limite: o trigger e quem mostra o saldo (JuIA, área do cliente, cupom) leem daqui.
create or replace function public.loyalty_fim_do_acumulo()
 returns timestamptz
 language sql
 immutable
as $$ select timestamptz '2027-04-01 00:00:00-03' $$;
grant execute on function public.loyalty_fim_do_acumulo() to service_role, authenticated, anon;

create or replace function public.v21_sync_loyalty_on_completed_booking()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- v29.309.0: só junta quem ainda tem saldo (> 0) e só até 31/03/2027.
  if v_completing and not coalesce(new.courtesy, false)
     and new.club_subscription_id is null
     and now() < public.loyalty_fim_do_acumulo()
     and not (coalesce(new.service_price, 0) <= 0 and coalesce(new.products_price, 0) > 0) then
    v_customer := public.v27_customer_for_booking(new);
    if v_customer is not null and exists (select 1 from public.loyalty_accounts la where la.customer_id = v_customer and la.points > 0) then
      v_n := public.loyalty_points_for_service(new.service_name);
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_customer, new.id, 'earn', v_n,
                'Atendimento concluído' || case when v_n > 1 then format(' (%s serviços, %s pontos)', v_n, v_n) else '' end)
        on conflict do nothing;
      if found then
        update public.loyalty_accounts
           set points = points + v_n, lifetime_points = lifetime_points + v_n, updated_at = now()
         where customer_id = v_customer
         returning points, rewards_available into v_points, v_rewards;
        if v_points >= 10 then
          -- O último prêmio: um só, e o que passou de 10 não vale mais (o programa acabou para ele).
          update public.loyalty_accounts
             set points = 0, rewards_available = v_rewards + 1, updated_at = now()
           where customer_id = v_customer;
          insert into public.loyalty_rewards(customer_id, earned_at, expires_at)
            values (v_customer, now(), now() + interval '30 days');
          if v_points > 10 then
            insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
              values (v_customer, null, 'adjustment', -(v_points - 10),
                      'Pontos além do último prêmio não contam: programa de pontos encerrado em 27/10/2026');
          end if;
        end if;
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

-- Contrato do Clube v4: a cláusula 4.8 não promete mais o cartão fidelidade.
insert into public.club_terms (version, sha256, url)
values ('v4', '22215ea71b91c76401c9611f315078e0fa8587bd7dfab7504819bf688f24b68d', 'https://www.barbeariadoju.com.br/clube/contrato/v4.txt')
on conflict (version) do nothing;
update public.club_settings set terms_version = 'v4', updated_at = now() where id = 1;
