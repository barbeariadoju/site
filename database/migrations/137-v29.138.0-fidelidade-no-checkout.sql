-- v29.138.0 — Prêmio da fidelidade no check-out: qual serviço foi de graça e quanto.
--
-- Caso Joao (05/09/2026, 08h00): corte pago com o prêmio do cartão. O Juliano marcou
-- "Bônus de fidelidade" no Concluir, o registro ficou payment_method='fidelidade' com
-- loyalty_discount=0 e service_price=40 — e o cupom saiu "Total: R$ 40,00 / Pago com prêmio
-- do cartão fidelidade". O cliente que não pagou recebeu um documento dizendo que pagou.
--
-- Regra que fica (uma só, pra todo mundo que lê bookings):
--   service_price     = preço de tabela do que foi feito (BRUTO, nunca reduzido);
--   loyalty_discount  = quanto o prêmio cobriu (o preço do serviço premiado);
--   loyalty_free_service = QUAL serviço foi o prêmio (importa no combo: "Corte + Barba
--                       Express" com só o corte de graça e a barba paga no cartão);
--   payment_method    = a forma do que foi PAGO em dinheiro; 'fidelidade' só quando não
--                       sobrou nada pra pagar.
-- Receita = service_price - loyalty_discount + products_price. A cota-parte (migration 114)
-- e o CSV do Google Ads (migration 134) já liam assim; o Financeiro e o Dashboard passam a
-- ler assim nesta versão. reserve_loyalty_reward (migration 100) era o único lugar que
-- REDUZIA service_price ao aplicar o prêmio — nunca chegou a rodar em produção (nenhum
-- booking com loyalty_reward_id até 05/09/2026), e agora segue a mesma regra.

alter table public.bookings add column if not exists loyalty_free_service text;

create or replace function public.reserve_loyalty_reward(
  p_phone text, p_booking_id uuid, p_discount numeric, p_freed_service_name text default null
) returns table(reserved boolean, reward_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_phone text; v_customer_id uuid; v_reward_id uuid; v_service_price numeric;
begin
  v_phone := regexp_replace(p_phone,'\D','','g');
  select id into v_customer_id from public.customer_profiles where public.phone_match_key(phone)=public.phone_match_key(v_phone) limit 1;
  if v_customer_id is null then return query select false, null::uuid; return; end if;

  select id into v_reward_id from public.loyalty_rewards
    where customer_id=v_customer_id and status='available'
    order by earned_at asc limit 1 for update skip locked;
  if v_reward_id is null then return query select false, null::uuid; return; end if;

  update public.loyalty_rewards set status='reserved', booking_id=p_booking_id, updated_at=now() where id=v_reward_id;

  select service_price into v_service_price from public.bookings where id=p_booking_id;
  -- v29.138.0: service_price fica BRUTO; o prêmio vive em loyalty_discount/loyalty_free_service.
  update public.bookings set
    loyalty_reward_id=v_reward_id,
    loyalty_discount=least(coalesce(p_discount,0), coalesce(v_service_price,0)),
    loyalty_free_service=nullif(trim(coalesce(p_freed_service_name,'')),''),
    notes = case when p_freed_service_name is not null then trim(both E'\n' from coalesce(notes||E'\n','') || 'Fidelidade: ' || p_freed_service_name || ' por nossa conta.') else notes end
    where id=p_booking_id;

  return query select true, v_reward_id;
end $$;
revoke all on function public.reserve_loyalty_reward(text,uuid,numeric,text) from public;
grant execute on function public.reserve_loyalty_reward(text,uuid,numeric,text) to service_role;

-- Balcão (walk-in): "fidelidade" como forma de pagamento = o serviço inteiro foi o prêmio.
create or replace function public.admin_register_walkin_visit(
  p_customer_name text, p_customer_phone text, p_service_name text, p_service_price numeric,
  p_duration_minutes integer, p_booking_date date, p_start_time time without time zone,
  p_payment_method text, p_notes text default null, p_selected_products jsonb default '[]'::jsonb
) returns table(booking_id uuid, is_new_customer boolean)
language plpgsql security definer set search_path to 'public' as $$
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

  if v_is_new then
    insert into public.customer_profiles(name, phone)
    values (trim(p_customer_name), v_phone);
  end if;

  insert into public.bookings(
    customer_name, customer_phone, service_name, service_price, duration_minutes,
    booking_date, start_time, notes, status, payment_method, channel,
    selected_products, products_price, loyalty_discount, loyalty_free_service
  ) values (
    trim(p_customer_name), v_phone, p_service_name, p_service_price, p_duration_minutes,
    p_booking_date, p_start_time, nullif(trim(p_notes), ''), 'completed', p_payment_method, 'balcao',
    coalesce(p_selected_products,'[]'::jsonb), v_products_price,
    case when p_payment_method = 'fidelidade' then coalesce(p_service_price, 0) else 0 end,
    case when p_payment_method = 'fidelidade' then p_service_name else null end
  ) returning id into v_id;

  return query select v_id, v_is_new;
end;
$$;

-- Acerto do caso Joao (05/09/2026, booking cffff303…): o registro que motivou a versão.
update public.bookings
   set loyalty_discount = service_price, loyalty_free_service = service_name
 where payment_method = 'fidelidade' and coalesce(loyalty_discount, 0) = 0 and status = 'completed';
