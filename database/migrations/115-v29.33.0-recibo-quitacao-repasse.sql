-- Barbearia do Ju — v29.33.0 — Recibo de quitação do repasse semanal
--
-- Pedido do Juliano em 16/08/2026: "caso ele venha a alegar que não o pagamos".
--
-- O comprovante do Pix prova que saiu dinheiro da conta. Não prova que aquele dinheiro se
-- refere àquela semana, àquele extrato e àqueles atendimentos. Quem fecha essa lacuna é a
-- quitação dada pelo próprio profissional, com o extrato à vista, registrada com data,
-- hora, IP e o hash do documento que ele viu.
--
-- O hash é a peça que faz o documento valer: sem ele, sobra espaço para alegar que o
-- extrato foi alterado depois da confirmação. Mesma lógica já usada no aceite do contrato.
--
-- Aplicada em 3 partes (115, 116, 116b) — ver o comentário de cada função.

alter table public.professional_settlements
  add column if not exists receipt_number text,
  add column if not exists receipt_token_hash text,
  add column if not exists receipt_sent_at timestamptz,
  add column if not exists receipt_snapshot jsonb,
  add column if not exists receipt_hash text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_ip text,
  add column if not exists acknowledged_user_agent text;

comment on column public.professional_settlements.receipt_hash is 'SHA-256 do extrato exato que o profissional viu ao dar a quitação. Sem isso, não há como afastar a alegação de que o extrato mudou depois da confirmação.';
comment on column public.professional_settlements.acknowledged_at is 'Momento em que o profissional confirmou o recebimento. É a quitação propriamente dita.';

create unique index if not exists settlements_receipt_number_idx
  on public.professional_settlements (receipt_number) where receipt_number is not null;
create index if not exists settlements_receipt_token_idx
  on public.professional_settlements (receipt_token_hash) where receipt_token_hash is not null;

-- Numeração própria: BDJ-R-2026-0001. Documento sem número é difícil de referenciar
-- depois — e recibo existe justamente para ser referenciado.
create or replace function public.next_receipt_number()
returns text language plpgsql security definer set search_path to 'public' as $fn$
declare v_ano text; v_seq integer;
begin
  v_ano := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  select coalesce(max((regexp_replace(receipt_number, '^BDJ-R-\d{4}-', ''))::integer), 0) + 1
    into v_seq
    from public.professional_settlements
   where receipt_number like 'BDJ-R-' || v_ano || '-%';
  return 'BDJ-R-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
end;
$fn$;

create or replace function public.register_settlement_receipt(
  p_settlement_id uuid, p_token_hash text, p_snapshot jsonb, p_receipt_hash text
)
returns text language plpgsql security definer set search_path to 'public' as $fn$
declare v_numero text;
begin
  select receipt_number into v_numero from public.professional_settlements where id = p_settlement_id;
  if v_numero is null then v_numero := public.next_receipt_number(); end if;

  update public.professional_settlements
     set receipt_number = v_numero,
         receipt_token_hash = p_token_hash,
         receipt_snapshot = p_snapshot,
         receipt_hash = p_receipt_hash,
         receipt_sent_at = now(),
         updated_at = now()
   where id = p_settlement_id;

  if not found then raise exception 'Fechamento não encontrado.'; end if;
  return v_numero;
end;
$fn$;

-- Leitura pública pelo token (o profissional abre o link no celular, sem login). Devolve só
-- o que precisa aparecer no recibo — nunca CPF, CNPJ ou chave Pix.
create or replace function public.get_receipt_by_token(p_token_hash text)
returns table (
  settlement_id uuid, receipt_number text, professional_name text,
  period_start date, period_end date, total_credits numeric, total_debits numeric,
  net_amount numeric, paid_at timestamptz, paid_method text,
  snapshot jsonb, receipt_hash text, acknowledged_at timestamptz
)
language plpgsql security definer set search_path to 'public' as $fn$
begin
  return query
    select s.id, s.receipt_number, coalesce(p.display_name, p.name),
           s.period_start, s.period_end, s.total_credits, s.total_debits,
           s.net_amount, s.paid_at, s.paid_method,
           s.receipt_snapshot, s.receipt_hash, s.acknowledged_at
      from public.professional_settlements s
      join public.professionals p on p.id = s.professional_id
     where s.receipt_token_hash = p_token_hash
     limit 1;
end;
$fn$;

-- v29.33.2 — a primeira versão desta função usava `returning acknowledged_at into
-- v_row.acknowledged_at` e o Postgres não sabia se `acknowledged_at` era a coluna ou o
-- campo do record (mesma família de bug da migration 103). Variável escalar própria resolve.
create or replace function public.acknowledge_settlement_receipt(
  p_token_hash text, p_ip text default null, p_user_agent text default null
)
returns table (ok boolean, acknowledged_at timestamptz, receipt_number text)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_id uuid;
  v_numero text;
  v_quando timestamptz;
begin
  select s.id, s.receipt_number, s.acknowledged_at
    into v_id, v_numero, v_quando
    from public.professional_settlements s
   where s.receipt_token_hash = p_token_hash;

  if v_id is null then
    return query select false, null::timestamptz, null::text;
    return;
  end if;

  -- Quitação só se registra UMA vez: reconfirmar não move a data original, que é o dado
  -- com valor probatório.
  if v_quando is null then
    update public.professional_settlements s
       set acknowledged_at = now(),
           acknowledged_ip = p_ip,
           acknowledged_user_agent = left(coalesce(p_user_agent, ''), 400),
           updated_at = now()
     where s.id = v_id
    returning s.acknowledged_at into v_quando;
  end if;

  return query select true, v_quando, v_numero;
end;
$fn$;

-- ============================================================================
-- Permissões — atenção ao par revoke/grant
-- ============================================================================
-- v29.33.1: revogar de PUBLIC derruba TAMBÉM o service_role, que acessava por ali (função
-- nasce com EXECUTE para PUBLIC). Sintoma: "permission denied for function
-- get_receipt_by_token" na Edge Function — e o mesmo teria acontecido em silêncio com
-- record_booking_shares na conclusão do atendimento, que só loga o erro para não travar o
-- atendimento: a cota-parte simplesmente não seria gerada, e ninguém perceberia até o
-- fechamento da semana vir vazio. É o espelho do bug das migrations 087/088: lá faltou
-- revogar de PUBLIC, aqui faltou devolver ao service_role depois de revogar.
revoke execute on function public.next_receipt_number() from public, anon, authenticated;
revoke execute on function public.register_settlement_receipt(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.get_receipt_by_token(text) from public, anon, authenticated;
revoke execute on function public.acknowledge_settlement_receipt(text, text, text) from public, anon, authenticated;

grant execute on function public.next_receipt_number() to service_role;
grant execute on function public.register_settlement_receipt(uuid, text, jsonb, text) to service_role;
grant execute on function public.get_receipt_by_token(text) to service_role;
grant execute on function public.acknowledge_settlement_receipt(text, text, text) to service_role;

-- Mesmo conserto para as funções da migration 114, revogadas pelo mesmo padrão.
grant execute on function public.record_booking_shares(uuid) to service_role;
grant execute on function public.refresh_cash_due(uuid, date) to service_role;
grant execute on function public.register_professional_consumption(uuid, uuid, integer) to service_role;
