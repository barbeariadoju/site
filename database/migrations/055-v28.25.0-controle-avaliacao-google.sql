-- v28.25.0: controle manual de quando pedir avaliação no Google
--
-- Motivo: a pesquisa de satisfação sempre pedia avaliação no Google pra quem respondia
-- satisfeito, mesmo clientes recorrentes que o Juliano sabe que já avaliaram (a checagem
-- automática existente, customer_already_reviewed, só detecta quem clicou no nosso link
-- antes -- não cobre quem avaliou por conta própria). Novo campo, controlado na hora de
-- concluir o atendimento: se desmarcado, a JuIA manda um agradecimento (reforçando as
-- formas de agendamento) em vez de pedir avaliação. Default true (comportamento atual
-- preservado) -- o Juliano desmarca manualmente quando já sabe que aquele cliente já
-- avaliou.

alter table public.bookings
  add column if not exists request_google_review boolean not null default true;

alter table public.experience_requests
  add column if not exists request_google_review boolean not null default true;

create or replace function public.v27_queue_experience_after_completion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_customer uuid;
begin
  if new.status='completed' and coalesce(old.status,'') <> 'completed' then
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

-- RETURNS TABLE mudou (coluna nova) -- Postgres não deixa CREATE OR REPLACE trocar o tipo
-- de retorno definido pelos OUT params, precisa DROP antes. Isso reseta os grants pro
-- default (PUBLIC ganha execute de novo) -- por isso o revoke/grant logo abaixo, pra manter
-- a mesma trava de segurança que já existia (só service_role, ver migration 047).
drop function if exists public.find_pending_experience_by_phone(text);

create function public.find_pending_experience_by_phone(p_phone text)
 returns table(id uuid, token uuid, status text, customer_id uuid, booking_id uuid, customer_name text, request_google_review boolean)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select e.id, e.token, e.status, e.customer_id, e.booking_id, b.customer_name, e.request_google_review
  from public.experience_requests e
  join public.bookings b on b.id = e.booking_id
  where (e.status in ('sent','opened') or (e.status='feedback' and e.feedback is null))
    and e.created_at > now() - interval '30 days'
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
  order by e.created_at desc
  limit 1
$function$;

revoke all on function public.find_pending_experience_by_phone(text) from public, anon, authenticated;
grant execute on function public.find_pending_experience_by_phone(text) to service_role;
