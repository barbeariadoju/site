-- v29.47.0 (19/08/2026) — phone_upcoming_bookings passa a devolver service_price, products_price e
-- prepay_declared_at: a JuIA precisa do VALOR pra mandar junto com a chave Pix (caso Frei Bartolomeu).
drop function if exists public.phone_upcoming_bookings(text);
create or replace function public.phone_upcoming_bookings(p_phone text)
returns table(id uuid, booking_date date, start_time time without time zone, duration_minutes integer, service_name text, status text, selected_products jsonb, service_price numeric, products_price numeric, prepay_declared_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select b.id, b.booking_date, b.start_time, b.duration_minutes, b.service_name, b.status, coalesce(b.selected_products,'[]'::jsonb),
         coalesce(b.service_price,0), coalesce(b.products_price,0), b.prepay_declared_at
  from public.bookings b
  where b.status in ('pending','confirmed')
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and (
      b.booking_date > (timezone('America/Sao_Paulo', now()))::date
      or (b.booking_date = (timezone('America/Sao_Paulo', now()))::date
          and b.start_time > (timezone('America/Sao_Paulo', now()))::time)
    )
  order by b.booking_date, b.start_time
$$;
grant execute on function public.phone_upcoming_bookings(text) to anon, authenticated, service_role;
