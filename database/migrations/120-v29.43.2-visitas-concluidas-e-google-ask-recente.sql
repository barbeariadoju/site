-- v29.43.2 — apoio da recuperacao de pesquisa "direto ao Google" para cliente recorrente.
-- customer_completed_visits: visitas concluidas (datas distintas), telefone normalizado.
-- customer_google_ask_recent: ja houve pedido de avaliacao no Google nos ultimos N dias?
create or replace function public.customer_completed_visits(p_phone text)
returns integer language sql stable security definer set search_path to 'public' as $$
  select count(distinct b.booking_date)::int from public.bookings b
  where b.status='completed' and public.phone_match_key(b.customer_phone)=public.phone_match_key(p_phone);
$$;
grant execute on function public.customer_completed_visits(text) to service_role;

create or replace function public.customer_google_ask_recent(p_phone text, p_days integer default 30)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.experience_requests er join public.bookings b on b.id=er.booking_id
    where er.google_asked_at > now() - make_interval(days => p_days)
      and public.phone_match_key(b.customer_phone)=public.phone_match_key(p_phone)
  );
$$;
grant execute on function public.customer_google_ask_recent(text, integer) to service_role;
