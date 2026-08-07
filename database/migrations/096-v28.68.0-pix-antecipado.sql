-- 096 — v28.68.0 — Pagamento antecipado por Pix (Fase 1, decisão do Juliano em 07/08/2026)
--
-- Ideia dele: no fim do agendamento, oferecer (nunca impor) o pagamento na hora. "Quer pagar
-- agora ou prefere pagar no local?" — grande parte dos clientes paga por Pix de qualquer
-- jeito, então adiantar é conveniência pros dois lados.
--
-- Escopo deliberadamente pequeno nesta fase: NÃO é integração de pagamento. É a chave Pix
-- copiável + o cliente avisando que pagou. A conferência continua sendo do Juliano — com
-- ~90 agendamentos/mês isso é perfeitamente administrável, e evita o custo e a complexidade
-- (taxa por transação, estorno em cancelamento, conciliação) de uma integração de cartão
-- que ainda não sabemos se se paga. Cartão via PagBank fica pra Fase 2, se a adesão provar
-- que vale.
--
-- Importante: isto NÃO foi criado pra reduzir falta. A taxa de falta em 90 dias é de 3,3%
-- (3 faltas, R$140) — não é problema. O ganho aqui é conveniência e caixa antecipado.

alter table public.bookings
  add column if not exists prepay_declared_at timestamptz;

comment on column public.bookings.prepay_declared_at is
  'Quando o CLIENTE declarou ter feito o Pix antecipado. NAO e confirmacao de pagamento: quem confere o comprovante e o Juliano.';

-- Autorização pelo mesmo par (code + token) que o cliente já usa pra gerenciar o próprio
-- agendamento — o token é secreto e só quem agendou tem. Sem isso, uma RPC pública que
-- marca "paguei" poderia ser chamada por qualquer um com um UUID.
-- O banco guarda apenas o HASH do token (SHA-256 hex, gerado em create-public-booking),
-- então a comparação é feita sobre o digest, nunca sobre o token em claro.
create or replace function public.declare_prepay(p_booking_code text, p_token text)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_booking public.bookings%rowtype;
begin
  select b.* into v_booking
  from public.bookings b
  where b.booking_code = p_booking_code
    and b.management_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;

  if not found then
    return query select false, 'Agendamento não encontrado.'::text;
    return;
  end if;

  if v_booking.status = 'cancelled' then
    return query select false, 'Esse agendamento está cancelado.'::text;
    return;
  end if;

  update public.bookings
     set prepay_declared_at = coalesce(prepay_declared_at, now()),
         updated_at = now()
   where id = v_booking.id;

  return query select true, 'ok'::text;
end;
$function$;

comment on function public.declare_prepay(text, text) is
  'Cliente avisa que fez o Pix antecipado. Autorizado pelo par booking_code + management_token. Nao confirma pagamento — apenas sinaliza para o Juliano conferir.';

revoke all on function public.declare_prepay(text, text) from public;
grant execute on function public.declare_prepay(text, text) to anon, authenticated, service_role;
