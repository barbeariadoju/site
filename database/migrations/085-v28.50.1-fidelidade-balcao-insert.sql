-- v28.50.1 — Bug real (caso Eduardo, 04/08/2026): fidelidade nunca creditava corte feito
-- no Atendimento Balcão. bookings_v21_loyalty era só "AFTER UPDATE OF status" — o balcão
-- INSERE o agendamento já 'completed' de uma vez, nunca passa por UPDATE, então o gatilho
-- nunca rodava. Mesma causa raiz e mesmo fix já usados em v27_queue_experience_after_completion
-- (migration 082): guarda TG_OP='INSERT' antes de tocar em OLD (senão dá erro de trigger).
create or replace function public.v21_sync_loyalty_on_completed_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_customer uuid; v_points integer; v_rewards integer;
begin
  if new.status='completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed')
     and lower(new.service_name) like '%corte%' then
    select id into v_customer from public.customer_profiles
      where phone=regexp_replace(new.customer_phone,'\D','','g') and archived=false limit 1;
    if v_customer is not null then
      insert into public.loyalty_accounts(customer_id) values(v_customer)
        on conflict(customer_id) do nothing;
      insert into public.loyalty_events(customer_id,booking_id,event_type,points_delta,description)
        values(v_customer,new.id,'earn',1,'Corte concluído')
        on conflict do nothing;
      if found then
        update public.loyalty_accounts
          set points=points+1,lifetime_points=lifetime_points+1,updated_at=now()
          where customer_id=v_customer
          returning points,rewards_available into v_points,v_rewards;
        if v_points >= 10 then
          update public.loyalty_accounts
            set points=points-10,rewards_available=rewards_available+1,updated_at=now()
            where customer_id=v_customer;
        end if;
      end if;
    end if;
  end if;
  return new;
end
$function$;

create trigger bookings_v21_loyalty_insert
after insert on public.bookings
for each row execute function public.v21_sync_loyalty_on_completed_booking();
