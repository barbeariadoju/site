-- Bug real achado testando com telefone fictício: loyalty_accounts.rewards_available
-- (contador antigo, usado na tela de Fidelidade e no contexto que a JuIA lê) só SOMAVA —
-- nunca descontava quando um prêmio virava 'redeemed' ou 'expired' em loyalty_rewards.
-- Resultado: o contador ficava permanentemente inflado depois do 1º resgate/expiração.

create or replace function public.v21_sync_loyalty_on_completed_booking()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_points integer; v_rewards integer; v_reward_customer uuid;
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
        where id=new.loyalty_reward_id and status='reserved'
        returning customer_id into v_reward_customer;
      if v_reward_customer is not null then
        update public.loyalty_accounts set rewards_available=greatest(0,rewards_available-1), updated_at=now()
          where customer_id=v_reward_customer;
      end if;
    elsif new.status in ('cancelled','no_show') and (TG_OP='INSERT' or coalesce(old.status,'') not in ('cancelled','no_show')) then
      update public.loyalty_rewards set status='available', booking_id=null, updated_at=now()
        where id=new.loyalty_reward_id and status='reserved';
    end if;
  end if;

  return new;
end
$$;

create or replace function public.expire_loyalty_rewards() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, customer_id from public.loyalty_rewards where status='available' and expires_at < now() loop
    update public.loyalty_rewards set status='expired', updated_at=now() where id=r.id;
    update public.loyalty_accounts set rewards_available=greatest(0,rewards_available-1), updated_at=now() where customer_id=r.customer_id;
  end loop;
end $$;
revoke all on function public.expire_loyalty_rewards() from public;
grant execute on function public.expire_loyalty_rewards() to service_role, postgres;
