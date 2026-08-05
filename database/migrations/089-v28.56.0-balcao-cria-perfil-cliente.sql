-- v28.56.0 — Cliente NOVO atendido no Balcão não entrava no CRM nem na Fidelidade
--
-- Caso real (Rafael Bombeiro, 05/08/2026): Juliano lançou o atendimento no Balcão e foi
-- ajustar os pontos de fidelidade dele (cliente recorrente da loja, 2 cortes no cartão de
-- papel), mas o nome não aparecia na tela de Fidelidade. Mesmo sintoma do caso Eduardo
-- (v28.50.1) — lá corrigimos o trigger que só disparava em UPDATE, mas sobrou a causa
-- de baixo, que só aparece com cliente NOVO:
--
-- admin_register_walkin_visit INSERE o booking mas NUNCA cria o customer_profiles. E os
-- dois triggers que rodam depois só sabem BUSCAR o perfil, nunca criar:
--   * v21_sync_loyalty_on_completed_booking: `select id into v_customer ...` e, se vier
--     null, sai em silêncio sem creditar ponto nenhum;
--   * v27_customer_for_booking: devolve null, então a experience_request nasce com
--     customer_id/customer_name nulos.
-- Resultado: booking existe, mas o cliente fica invisível no CRM e na Fidelidade.
--
-- Fix: criar o perfil ANTES do insert do booking (assim os triggers, que rodam depois,
-- já encontram o cliente e creditam o ponto sozinhos). Usa phone_match_key pra não
-- duplicar perfil de quem já existe com o telefone gravado noutro formato (com/sem o 9).
--
-- Testado depois de aplicar: insert de booking de balcão para telefone novo passou a
-- gerar 1 ponto de fidelidade e 1 pesquisa de satisfação automaticamente (dados de teste
-- removidos em seguida). Backfill do único cliente afetado (Rafael Bombeiro) feito à mão,
-- com 1 evento `earn` do corte do dia + 1 `adjustment` de 2 pontos do cartão de papel.

create or replace function public.admin_register_walkin_visit(
  p_customer_name text, p_customer_phone text, p_service_name text, p_service_price numeric,
  p_duration_minutes integer, p_booking_date date, p_start_time time without time zone,
  p_payment_method text, p_notes text default null::text, p_selected_products jsonb default '[]'::jsonb
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

  -- Cliente novo: cria o cadastro AGORA, antes do booking. Os triggers de fidelidade e
  -- de pesquisa de satisfação rodam depois do insert abaixo e dependem de já existir um
  -- customer_profiles com esse telefone — sem isso o cliente nunca aparece na Fidelidade.
  if v_is_new then
    insert into public.customer_profiles(name, phone)
    values (trim(p_customer_name), v_phone);
  end if;

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
