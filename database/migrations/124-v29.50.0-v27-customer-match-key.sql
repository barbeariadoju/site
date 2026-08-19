-- v29.50.0 (19/08) — v27_customer_for_booking usava dígitos exatos (5511 x 11 = perfis diferentes).
create or replace function public.v27_customer_for_booking(p_booking bookings)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_customer uuid;
begin
  select c.id into v_customer
  from public.customer_profiles c
  where public.phone_match_key(c.phone) = public.phone_match_key(p_booking.customer_phone)
    and c.archived = false
  order by (exists(select 1 from public.loyalty_accounts la where la.customer_id = c.id)) desc, c.created_at asc
  limit 1;
  return v_customer;
end $$;
