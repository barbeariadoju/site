-- v29.231.0 (24/09/2026) — caso Américo: horário das 09:15, às 09:16 ele avisou "estou em trânsito, chego em
-- instantes" e a JuIA respondeu que o 09:15 "acabou de ser reservado por outro cliente". O
-- phone_upcoming_bookings só devolve horário que AINDA NÃO COMEÇOU; passado 1 minuto, o horário do próprio
-- cliente sumia da conversa e virava "ocupado". Esta função devolve o horário de HOJE que já começou há
-- até 2 horas (quem está a caminho, atrasado ou na cadeira). Aplicada em produção como
-- phone_current_bookings_v29_231.
create or replace function public.phone_current_bookings(p_phone text)
returns table(id uuid, booking_date date, start_time time, duration_minutes integer, service_name text, status text)
language sql stable security definer set search_path to 'public'
as $$
  select b.id, b.booking_date, b.start_time, b.duration_minutes, b.service_name, b.status
  from public.bookings b
  where b.status in ('pending','confirmed')
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and b.booking_date = (timezone('America/Sao_Paulo', now()))::date
    and b.start_time <= (timezone('America/Sao_Paulo', now()))::time
    and b.start_time > ((timezone('America/Sao_Paulo', now()))::time - interval '2 hours')
  order by b.start_time desc
$$;
revoke all on function public.phone_current_bookings(text) from public, anon, authenticated;
grant execute on function public.phone_current_bookings(text) to service_role;
