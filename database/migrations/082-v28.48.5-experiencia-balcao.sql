-- 082-v28.48.5: pesquisa de satisfação também para atendimento de balcão (bug real, 2026-08-04).
-- admin_register_walkin_visit INSERE o booking já com status='completed' (channel='balcao'),
-- mas o trigger bookings_v27_experience era só AFTER UPDATE OF status — balcão nunca entrava
-- na fila de satisfação (nem, por consequência, no pedido de avaliação Google). 2 clientes
-- reais ficaram sem pesquisa hoje; o Juliano mandou o pedido manualmente.
-- Fix: função tolerante a INSERT (TG_OP; referenciar OLD em trigger de INSERT daria erro)
-- + trigger novo AFTER INSERT. Comportamento no UPDATE permanece idêntico.
-- Testado com booking fictício de balcão (experience_request 'pending' agendada +2h criada
-- corretamente), dados apagados em seguida.

create or replace function public.v27_queue_experience_after_completion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_customer uuid;
begin
  if new.status='completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed') then
    v_customer := public.v27_customer_for_booking(new);

    insert into public.customer_timeline(customer_id,booking_id,event_type,title,details)
    values(v_customer,new.id,'booking_completed','Atendimento concluído',jsonb_build_object(
      'services',new.service_name,
      'value',coalesce(new.service_price,0)+coalesce(new.products_price,0),
      'date',new.booking_date,
      'time',new.start_time
    ));

    insert into public.experience_requests(booking_id,customer_id,scheduled_for,request_google_review)
    values(new.id,v_customer,now()+interval '2 hours',coalesce(new.request_google_review,true))
    on conflict(booking_id) do update set
      customer_id=excluded.customer_id,
      scheduled_for=excluded.scheduled_for,
      request_google_review=excluded.request_google_review,
      status=case when public.experience_requests.status in ('failed','expired') then 'pending' else public.experience_requests.status end,
      last_error=null,
      updated_at=now();
  end if;
  return new;
end $function$;

create trigger bookings_v27_experience_insert
  after insert on public.bookings
  for each row execute function public.v27_queue_experience_after_completion();
