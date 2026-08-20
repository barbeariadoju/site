-- 126 (v29.54.0) — Copiar a chave Pix no site agora avisa o Juliano.
--
-- Caso real (Nado, 20/08/2026): o cliente agendou pelo site, copiou a chave,
-- pagou o Pix... e não tocou em "Já fiz o Pix". Resultado: nenhum registro
-- (prepay_key e prepay_declared_at nulos), nenhum push, e o Juliano só soube
-- do pagamento depois do atendimento, conferindo o extrato à mão.
--
-- O aviso não pode depender de um toque opcional. O ato de COPIAR a chave já
-- é sinal suficiente de intenção: registra a chave copiada e devolve se foi a
-- primeira vez (para a edge function mandar UM push de "fique de olho").
-- A declaração forte ("Já fiz o Pix" -> prepay_declared_at) continua exclusiva
-- do declare_prepay; esta função NÃO mexe em prepay_declared_at.

create or replace function public.note_prepay_key_copied(p_booking_code text, p_token text, p_key text default 'pagbank')
returns table (ok boolean, first_copy boolean, booking_id uuid, customer_name text, valor numeric)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_key text := lower(coalesce(nullif(trim(p_key), ''), 'pagbank'));
  v_first boolean := false;
begin
  if v_key not in ('pagbank', 'picpay') then v_key := 'pagbank'; end if;

  select b.* into v_booking
  from public.bookings b
  where b.booking_code = p_booking_code
    and b.management_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;

  if not found then
    return query select false, false, null::uuid, null::text, null::numeric;
    return;
  end if;

  if v_booking.status = 'cancelled' then
    return query select false, false, null::uuid, null::text, null::numeric;
    return;
  end if;

  -- Primeira sinalização de Pix deste agendamento? (nem copiou antes, nem declarou)
  v_first := (v_booking.prepay_key is null and v_booking.prepay_declared_at is null);

  update public.bookings
     set prepay_key = coalesce(prepay_key, v_key),
         updated_at = now()
   where id = v_booking.id;

  return query select true, v_first, v_booking.id, v_booking.customer_name,
                      (coalesce(v_booking.service_price, 0) + coalesce(v_booking.products_price, 0));
end;
$function$;

comment on function public.note_prepay_key_copied(text, text, text) is
  'Cliente copiou uma chave Pix na tela de confirmacao do site. Registra a chave (prepay_key) e informa se foi a primeira sinalizacao, para a edge function avisar o Juliano uma unica vez. Nao marca prepay_declared_at.';

revoke all on function public.note_prepay_key_copied(text, text, text) from public;
grant execute on function public.note_prepay_key_copied(text, text, text) to anon, authenticated, service_role;
