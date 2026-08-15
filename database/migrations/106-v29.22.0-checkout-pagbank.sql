-- 106 — v29.22.0 — Fase 2 do pagamento antecipado: Checkout PagBank (decisão do Juliano em 15/08/2026)
--
-- A Fase 1 (migration 096) era deliberadamente sem API: chave copiável + "Já fiz o Pix" +
-- conferência manual. Em 15/08 o Juliano decidiu ir pra API: o cliente merece confirmação
-- automática, e cartão de crédito/débito entra como opção. O caminho escolhido foi o
-- Checkout PagBank (página hospedada com Pix + cartão) em vez de formulário de cartão no
-- site: uma integração só serve o site E, depois, o link que a JuIA pode mandar no
-- WhatsApp — onde nascem ~90% dos agendamentos (ver v29.1.0).
--
-- O ciclo novo: pagbank-checkout cria o link → cliente paga na página do PagBank →
-- pagbank-webhook recebe a notificação assinada, valida e marca prepay_confirmed_at
-- sozinho → cliente recebe WhatsApp na hora, Juliano recebe push. Ninguém confere extrato.
-- O fluxo manual da Fase 1 continua existindo como fallback (se o token não estiver
-- configurado, o site volta a mostrar a chave copiável).

-- Registro de cada cobrança criada no PagBank. Uma linha por checkout; o webhook
-- atualiza a MESMA linha quando o pagamento cai (casa por checkout_id).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  checkout_id text,
  charge_id text,
  status text not null default 'created'
    check (status in ('created','paid','declined','canceled','expired')),
  method text check (method is null or method in ('pix','credito','debito')),
  amount_cents integer not null check (amount_cents > 0),
  pay_link text,
  paid_at timestamptz,
  expires_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is
  'Cobranças criadas no Checkout PagBank (v29.22.0). Escrita só via service_role (functions pagbank-checkout e pagbank-webhook); leitura só admin.';

create index if not exists payments_booking_id_idx on public.payments (booking_id);
create index if not exists payments_checkout_id_idx on public.payments (checkout_id);

-- RLS is_admin() E GRANT de base — a lição da migration 058.
alter table public.payments enable row level security;
drop policy if exists payments_admin_select on public.payments;
create policy payments_admin_select on public.payments
  for select to authenticated using (public.is_admin());
grant select on public.payments to authenticated;

-- prepay_key ganha o valor 'checkout': pagamento pela API, confirmado por webhook —
-- diferente de 'pagbank'/'picpay', que são as chaves manuais da Fase 1.
alter table public.bookings drop constraint if exists bookings_prepay_key_check;
alter table public.bookings add constraint bookings_prepay_key_check
  check (prepay_key is null or prepay_key in ('pagbank','picpay','checkout'));

-- Dados do agendamento para criar o checkout, autorizada pelo MESMO par code+token do
-- link de gerenciamento (padrão da declare_prepay, migration 096): sem isso, uma RPC
-- pública devolveria nome e telefone de cliente pra qualquer um com um código chutado.
create or replace function public.get_booking_for_checkout(p_booking_code text, p_token text)
returns table (
  ok boolean, message text, booking_id uuid,
  customer_name text, customer_phone text, customer_email text,
  service_name text, amount_cents integer, already_paid boolean
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_b public.bookings%rowtype;
begin
  select b.* into v_b
  from public.bookings b
  where b.booking_code = p_booking_code
    and b.management_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;

  if not found then
    return query select false, 'Agendamento não encontrado.'::text,
      null::uuid, null::text, null::text, null::text, null::text, null::integer, false;
    return;
  end if;

  if v_b.status = 'cancelled' then
    return query select false, 'Esse agendamento está cancelado.'::text,
      null::uuid, null::text, null::text, null::text, null::text, null::integer, false;
    return;
  end if;

  return query select true, 'ok'::text, v_b.id,
    v_b.customer_name, v_b.customer_phone, v_b.customer_email,
    v_b.service_name,
    round((coalesce(v_b.service_price, 0) + coalesce(v_b.products_price, 0)) * 100)::integer,
    (v_b.prepay_confirmed_at is not null);
end;
$function$;

comment on function public.get_booking_for_checkout(text, text) is
  'Dados mínimos pra criar o Checkout PagBank. Autorizada pelo par booking_code + management_token — o mesmo do link de gerenciamento.';

revoke all on function public.get_booking_for_checkout(text, text) from public;
grant execute on function public.get_booking_for_checkout(text, text) to anon, authenticated, service_role;
