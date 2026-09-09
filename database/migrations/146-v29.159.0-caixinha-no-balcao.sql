-- 146 — v29.159.0 (09/09/2026) — Caixinha no Atendimento Balcão
--
-- Caso real: o Juliano fechando um walk-in às 13h23 de 09/09, o cliente deixou caixinha e
-- não havia onde registrar. O "Concluir" da Agenda tem o campo desde a v29.20.0
-- (bookings.tip_amount, fora do faturamento, sai no comprovante); o Balcão nasce de uma RPC
-- própria e nunca ganhou o parâmetro.
--
-- A RPC ganha p_tip_amount (default 0, pra nada que já chame continuar funcionando).
-- A assinatura antiga é DERRUBADA antes: com as duas convivendo, uma chamada sem o
-- parâmetro novo casaria com ambas (o default cobre) e o PostgREST devolve "ambiguous
-- function" — o Balcão inteiro pararia de registrar. Mesmo cuidado da migration 050.
drop function if exists public.admin_register_walkin_visit(
  text, text, text, numeric, integer, date, time without time zone, text, text, jsonb
);

create or replace function public.admin_register_walkin_visit(
  p_customer_name text, p_customer_phone text, p_service_name text, p_service_price numeric,
  p_duration_minutes integer, p_booking_date date, p_start_time time without time zone,
  p_payment_method text, p_notes text default null, p_selected_products jsonb default '[]'::jsonb,
  p_tip_amount numeric default 0
) returns table(booking_id uuid, is_new_customer boolean)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_phone text := regexp_replace(p_customer_phone, '\D', '', 'g');
  v_is_new boolean;
  v_products_price numeric;
  -- Caixinha: nunca negativa, centavos arredondados; zero vira null (mesma convenção do
  -- admin-booking-status, que só grava tip_amount quando > 0).
  v_tip numeric := nullif(round(greatest(coalesce(p_tip_amount, 0), 0), 2), 0);
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Informe o nome do cliente.'; end if;
  if v_phone !~ '^[0-9]{10,13}$' then raise exception 'Telefone inválido.'; end if;
  if p_payment_method not in ('pix','debito','credito','dinheiro','fidelidade') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select coalesce(sum((x->>'price')::numeric),0) into v_products_price
  from jsonb_array_elements(coalesce(p_selected_products,'[]'::jsonb)) x;

  select not exists(
    select 1 from public.customer_profiles c
    where public.phone_match_key(c.phone) = public.phone_match_key(v_phone)
  ) into v_is_new;

  if v_is_new then
    insert into public.customer_profiles(name, phone)
    values (trim(p_customer_name), v_phone);
  end if;

  insert into public.bookings(
    customer_name, customer_phone, service_name, service_price, duration_minutes,
    booking_date, start_time, notes, status, payment_method, channel,
    selected_products, products_price, loyalty_discount, loyalty_free_service, tip_amount
  ) values (
    trim(p_customer_name), v_phone, p_service_name, p_service_price, p_duration_minutes,
    p_booking_date, p_start_time, nullif(trim(p_notes), ''), 'completed', p_payment_method, 'balcao',
    coalesce(p_selected_products,'[]'::jsonb), v_products_price,
    case when p_payment_method = 'fidelidade' then coalesce(p_service_price, 0) else 0 end,
    case when p_payment_method = 'fidelidade' then p_service_name else null end,
    v_tip
  ) returning id into v_id;

  return query select v_id, v_is_new;
end;
$$;

grant execute on function public.admin_register_walkin_visit(
  text, text, text, numeric, integer, date, time without time zone, text, text, jsonb, numeric
) to authenticated, service_role;

notify pgrst, 'reload schema';
