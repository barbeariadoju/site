-- Barbearia do Ju — V28.18.0
-- Atendimento Balcão ganha registro de produtos vendidos (mesmo padrão já usado no
-- agendamento do site/JuIA: selected_products jsonb + products_price numeric).
--
-- Contexto: até aqui só dava pra registrar serviço no balcão. O Juliano também vende
-- produtos (pomada, óleo de barba etc.) tanto pra quem vem direto na porta quanto pra
-- quem já tinha agendado pelo site — precisa poder registrar isso em qualquer um dos
-- dois casos pra ter o faturamento completo. O caso "site" (agendamento já existente,
-- concluído ou não) é resolvido só no admin-booking-status (Edge Function), que já lê
-- e grava direto na tabela via service_role — não precisou de RPC nova pra isso.
--
-- GOTCHA (documentado em sessão anterior): mudar a lista de parâmetros de uma function
-- com CREATE OR REPLACE cria uma sobrecarga nova em vez de substituir — sempre DROP
-- FUNCTION IF EXISTS com a assinatura antiga exata antes de recriar com parâmetro novo.
drop function if exists public.admin_register_walkin_visit(
  text, text, text, numeric, integer, date, time without time zone, text, text
);

create or replace function public.admin_register_walkin_visit(
  p_customer_name text,
  p_customer_phone text,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_booking_date date,
  p_start_time time without time zone,
  p_payment_method text,
  p_notes text default null::text,
  p_selected_products jsonb default '[]'::jsonb
)
returns table(booking_id uuid, is_new_customer boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_phone text := regexp_replace(p_customer_phone, '\D', '', 'g');
  v_is_new boolean;
  v_products_price numeric;
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

  insert into public.bookings(
    customer_name, customer_phone, service_name, service_price, duration_minutes,
    booking_date, start_time, notes, status, payment_method, channel,
    selected_products, products_price
  ) values (
    trim(p_customer_name), v_phone, p_service_name, p_service_price, p_duration_minutes,
    p_booking_date, p_start_time, nullif(trim(p_notes), ''), 'completed', p_payment_method, 'balcao',
    coalesce(p_selected_products,'[]'::jsonb), v_products_price
  ) returning id into v_id;

  return query select v_id, v_is_new;
end;
$function$;

notify pgrst, 'reload schema';
