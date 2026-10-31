-- v29.329.0 — caso Venilson (31/10/2026). O horário das 09:00 foi marcado como falta (no_show) às 09:13; às 10:39 ele
-- escreveu "Não consegui pegar o ônibus / tô vendo se tem ônibus para ir" e a JuIA respondeu "Sem problema, seu
-- horário está garantido. Pode vir com tranquilidade". Ela não enxergava o horário: phone_upcoming_bookings só traz o
-- que ainda vai começar e phone_current_bookings só pending/confirmed. Esta função traz as faltas dos últimos 2 dias
-- do telefone (mesma chave de telefone das outras), para a JuIA responder com a política de falta.
create or replace function public.phone_missed_bookings(p_phone text)
returns table(id uuid, booking_date date, start_time time, service_name text)
language sql
security definer
set search_path to 'public'
as $function$
  select b.id, b.booking_date, b.start_time, b.service_name
  from public.bookings b
  where b.status = 'no_show'
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and b.booking_date between (timezone('America/Sao_Paulo', now()))::date - 2 and (timezone('America/Sao_Paulo', now()))::date
  order by b.booking_date desc, b.start_time desc
$function$;

revoke all on function public.phone_missed_bookings(text) from public, anon, authenticated;
grant execute on function public.phone_missed_bookings(text) to service_role;
