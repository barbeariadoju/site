-- Barbearia do Ju — v29.32.0 — Razão de cota-parte, entrega de espécie e fechamento semanal
--
-- Depende da 113 (professionals, bookings.professional_id, products.cost_price).
--
-- O modelo mental é uma CONTA CORRENTE entre a barbearia e cada profissional:
--   crédito (+)  cota-parte de serviço, cota-parte de produto
--   débito  (−)  consumo do frigobar, ressarcimento de dano acordado, estorno posterior
--   saldo        é o que sai no Pix de segunda-feira
--
-- O dinheiro em espécie NÃO entra nessa conta, de propósito. Pela Cláusula 4.5 do contrato
-- v2.0 (decisão do Juliano em 16/08/2026), todo valor recebido do cliente é entregue no
-- mesmo dia — ou seja, ele nunca fica devendo nem tendo crédito por causa de dinheiro.
-- O que o sistema faz é dizer QUANTO ele tem que entregar naquele dia e registrar a
-- conferência. Misturar as duas coisas foi o desenho da v1 do contrato e foi abandonado
-- justamente porque embaralhava adiantamento com receita da casa.
--
-- Regras do contrato que estão codificadas aqui, e não na cabeça de ninguém:
--   Cl. 3.1.1  valor-base = pago pelo cliente − taxa do meio de pagamento
--   Cl. 3.1.2  não se deduz estrutura, insumo, luz, sistema: só a maquininha
--   Cl. 3.2    produto rateia LUCRO (venda − custo − taxa), não faturamento
--   Cl. 10.2   cortesia comercial paga cota normal; refação por erro próprio, não
--   Cl. 10.3   fidelidade e vale-presente não reduzem a cota — vale o preço de referência
--   Cl. 4.6    todo débito é discriminado e contestável antes de ser compensado

-- ============================================================================
-- 1. Taxas por meio de pagamento — ATENÇÃO: ver migration 117
-- ============================================================================
-- Esta migration criou uma tabela `payment_method_fees` que foi REMOVIDA na 117, e o
-- registro do erro fica aqui porque ele é fácil de repetir: `finance_fee_rates` já existia
-- desde 09/08/2026, preenchida pelo Juliano no Financeiro (crédito 4,61%, débito 2,12%,
-- Pix 0%), e eu criei uma segunda tabela sem procurar antes. Duas tabelas de taxa é como
-- divergência nasce: um dia ele reajusta num lugar, o repasse continua calculando pelo
-- outro, e o erro aparece no bolso do parceiro.
--
-- Fonte única de taxa neste projeto: public.finance_fee_rates.

-- ============================================================================
-- 2. Razão (conta corrente) do profissional
-- ============================================================================
create table if not exists public.professional_ledger (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  entry_date date not null default current_date,
  kind text not null check (kind in ('cota_servico', 'cota_produto', 'consumo', 'ressarcimento', 'estorno', 'ajuste')),
  booking_id uuid references public.bookings(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  description text,
  -- Positivo = a favor do profissional. Negativo = a descontar do repasse.
  amount numeric(10,2) not null default 0,
  -- Memória de cálculo: sem isso o extrato vira "confia em mim", que é exatamente o que
  -- não pode acontecer numa relação onde o dinheiro passa todo pela mão de um dos dois.
  gross_amount numeric(10,2),
  fee_amount numeric(10,2),
  cost_amount numeric(10,2),
  base_amount numeric(10,2),
  share_percent numeric(5,2),
  payment_method text,
  -- Lançamento que não pôde ser calculado (ex.: produto sem custo cadastrado) entra com
  -- amount 0 e um motivo. Nunca some do extrato: some da conta, aparece como pendência.
  pending_reason text,
  settlement_id uuid,
  created_by text not null default 'sistema',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.professional_ledger is 'Conta corrente entre a barbearia e cada profissional. Credito = cota-parte; debito = consumo e ressarcimento. Dinheiro em especie NAO entra aqui (ver cash_handovers) porque, pela Cl. 4.5, e entregue no mesmo dia.';
comment on column public.professional_ledger.pending_reason is 'Lancamento que ficou sem calculo (tipicamente produto sem cost_price). Entra com amount 0 para nao sumir do extrato e ser resolvido depois.';

create index if not exists professional_ledger_period_idx on public.professional_ledger (professional_id, entry_date);
create index if not exists professional_ledger_settlement_idx on public.professional_ledger (settlement_id);
-- Trava de idempotência: rodar o fechamento do atendimento duas vezes não pode pagar duas
-- vezes. É a proteção mais importante desta migration.
create unique index if not exists professional_ledger_booking_unique_idx
  on public.professional_ledger (booking_id, kind, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where booking_id is not null;

alter table public.professional_ledger enable row level security;

-- ============================================================================
-- 3. Entrega de espécie (Cláusula 4.5)
-- ============================================================================
create table if not exists public.cash_handovers (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  handover_date date not null default current_date,
  expected_amount numeric(10,2) not null default 0,
  received_amount numeric(10,2),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, handover_date)
);

comment on table public.cash_handovers is 'Conferencia diaria do dinheiro em especie: quanto o sistema apurou que o profissional recebeu dos clientes naquele dia e quanto ele efetivamente entregou. Diferenca fica visivel, sem virar desconto automatico.';

create index if not exists cash_handovers_pending_idx on public.cash_handovers (professional_id, handover_date) where confirmed_at is null;

alter table public.cash_handovers enable row level security;

-- ============================================================================
-- 4. Fechamento semanal
-- ============================================================================
create table if not exists public.professional_settlements (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'aberto' check (status in ('aberto', 'conferido', 'pago', 'cancelado')),
  total_credits numeric(10,2) not null default 0,
  total_debits numeric(10,2) not null default 0,
  net_amount numeric(10,2) not null default 0,
  pending_count integer not null default 0,
  closed_at timestamptz,
  paid_at timestamptz,
  paid_method text,
  paid_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, period_start, period_end)
);

comment on table public.professional_settlements is 'Fechamento semanal (segunda a domingo, repassado na segunda seguinte - Cl. 4.2). Passa por conferencia antes do pagamento, conforme decisao do Juliano em 16/08/2026.';

alter table public.professional_settlements enable row level security;

alter table public.professional_ledger
  drop constraint if exists professional_ledger_settlement_fk;
alter table public.professional_ledger
  add constraint professional_ledger_settlement_fk
  foreign key (settlement_id) references public.professional_settlements(id) on delete set null;

-- ============================================================================
-- 5. Geração da cota-parte a partir do atendimento
-- ============================================================================
-- Chamada na conclusão do atendimento. Idempotente por construção (o índice único acima
-- garante), então pode ser chamada de novo sem medo — inclusive para recalcular histórico.
create or replace function public.record_booking_shares(p_booking_id uuid)
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_booking record;
  v_prof record;
  v_fee_percent numeric;
  v_gross numeric;
  v_fee numeric;
  v_base numeric;
  v_amount numeric;
  v_produto jsonb;
  v_prod record;
  v_prod_fee_percent numeric;
  v_prod_gross numeric;
  v_prod_fee numeric;
  v_prod_cost numeric;
  v_prod_base numeric;
  v_refacao boolean;
  v_count integer := 0;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.professional_id is null then
    return 0;
  end if;

  select * into v_prof from public.professionals where id = v_booking.professional_id;
  -- O dono não tem cota-parte consigo mesmo: o faturamento dele já é o da barbearia.
  if not found or v_prof.is_owner then
    return 0;
  end if;

  -- Cl. 10.2(b): refação de serviço mal executado pelo próprio profissional não gera nova
  -- cota, por ser complementação do serviço já remunerado. Qualquer outra cortesia (10.2 a,
  -- b, c) paga normalmente. A distinção sai do motivo registrado no check-out.
  -- Regex sem depender de acento: o motivo é digitado à mão no check-out e vem com e sem
  -- cedilha/til conforme o teclado do momento.
  v_refacao := coalesce(v_booking.courtesy, false)
    and coalesce(v_booking.courtesy_reason, '') ~* '(refa[cc]ao|refa..ao|corre[cc]ao|erro tecnico|refazer)';

  -- ---------- Cota-parte do serviço ----------
  if not v_refacao then
    -- Cl. 10.3: fidelidade, vale-presente e cortesia promocional não reduzem a base — vale
    -- o preço de referência do serviço. O desconto é custo de marketing da casa, não do
    -- profissional que executou o corte.
    v_gross := coalesce(v_booking.service_price, 0);

    select fee_percent into v_fee_percent
      from public.payment_method_fees
     where method = coalesce(v_booking.payment_method, 'dinheiro');
    v_fee_percent := coalesce(v_fee_percent, 0);

    v_fee := round(v_gross * v_fee_percent / 100.0, 2);
    v_base := v_gross - v_fee;
    v_amount := round(v_base * v_prof.share_percent / 100.0, 2);

    insert into public.professional_ledger (
      professional_id, entry_date, kind, booking_id, description, amount,
      gross_amount, fee_amount, base_amount, share_percent, payment_method
    ) values (
      v_prof.id, coalesce(v_booking.booking_date, current_date), 'cota_servico', p_booking_id,
      coalesce(v_booking.service_name, 'Atendimento'), v_amount,
      v_gross, v_fee, v_base, v_prof.share_percent, v_booking.payment_method
    )
    on conflict do nothing;
    if found then v_count := v_count + 1; end if;
  end if;

  -- ---------- Cota-parte dos produtos ----------
  -- Cl. 3.2: rateia o LUCRO (venda − custo − taxa). Produto sem custo cadastrado não pode
  -- ser calculado: entra como pendência em vez de virar cota sobre o preço cheio, que
  -- pagaria ao profissional dinheiro que a barbearia gastou comprando o item.
  if jsonb_typeof(coalesce(v_booking.selected_products, '[]'::jsonb)) = 'array' then
    for v_produto in select * from jsonb_array_elements(v_booking.selected_products)
    loop
      select * into v_prod from public.products
       where name = (v_produto->>'name') limit 1;

      v_prod_gross := coalesce((v_produto->>'price')::numeric, 0);

      select fee_percent into v_prod_fee_percent
        from public.payment_method_fees
       where method = coalesce(v_booking.products_payment_method, v_booking.payment_method, 'dinheiro');
      v_prod_fee_percent := coalesce(v_prod_fee_percent, 0);
      v_prod_fee := round(v_prod_gross * v_prod_fee_percent / 100.0, 2);

      if v_prod.id is null or v_prod.cost_price is null then
        insert into public.professional_ledger (
          professional_id, entry_date, kind, booking_id, product_id, description, amount,
          gross_amount, fee_amount, share_percent, payment_method, pending_reason
        ) values (
          v_prof.id, coalesce(v_booking.booking_date, current_date), 'cota_produto', p_booking_id,
          v_prod.id, coalesce(v_produto->>'name', 'Produto'), 0,
          v_prod_gross, v_prod_fee, v_prof.share_percent,
          coalesce(v_booking.products_payment_method, v_booking.payment_method),
          case when v_prod.id is null then 'Produto não encontrado no catálogo'
               else 'Custo do produto ainda não cadastrado' end
        )
        on conflict do nothing;
      else
        v_prod_cost := v_prod.cost_price;
        v_prod_base := greatest(v_prod_gross - v_prod_fee - v_prod_cost, 0);

        insert into public.professional_ledger (
          professional_id, entry_date, kind, booking_id, product_id, description, amount,
          gross_amount, fee_amount, cost_amount, base_amount, share_percent, payment_method
        ) values (
          v_prof.id, coalesce(v_booking.booking_date, current_date), 'cota_produto', p_booking_id,
          v_prod.id, v_prod.name, round(v_prod_base * v_prof.share_percent / 100.0, 2),
          v_prod_gross, v_prod_fee, v_prod_cost, v_prod_base, v_prof.share_percent,
          coalesce(v_booking.products_payment_method, v_booking.payment_method)
        )
        on conflict do nothing;
      end if;

      v_count := v_count + 1;
    end loop;
  end if;

  -- Espécie do dia: recalcula o esperado sempre que um atendimento é fechado.
  perform public.refresh_cash_due(v_prof.id, coalesce(v_booking.booking_date, current_date));

  return v_count;
end;
$$;

-- ============================================================================
-- 6. Espécie do dia
-- ============================================================================
create or replace function public.refresh_cash_due(p_professional_id uuid, p_date date)
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare v_total numeric;
begin
  select coalesce(sum(
           case when b.payment_method = 'dinheiro' then coalesce(b.service_price, 0) - coalesce(b.loyalty_discount, 0) else 0 end
         + case when coalesce(b.products_payment_method, b.payment_method) = 'dinheiro' then coalesce(b.products_price, 0) else 0 end
         ), 0)
    into v_total
    from public.bookings b
   where b.professional_id = p_professional_id
     and b.booking_date = p_date
     and coalesce(b.courtesy, false) = false;

  insert into public.cash_handovers (professional_id, handover_date, expected_amount)
  values (p_professional_id, p_date, v_total)
  on conflict (professional_id, handover_date) do update
    set expected_amount = excluded.expected_amount,
        updated_at = now()
    -- Depois de conferido, o esperado congela: senão um lançamento tardio mudaria o valor
    -- de uma conferência que as duas partes já fizeram juntas.
    where public.cash_handovers.confirmed_at is null;

  return v_total;
end;
$$;

create or replace function public.admin_confirm_cash_handover(
  p_professional_id uuid, p_date date, p_received numeric, p_notes text default null
)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;

  insert into public.cash_handovers (professional_id, handover_date, expected_amount, received_amount, confirmed_at, notes)
  values (p_professional_id, p_date, coalesce(public.refresh_cash_due(p_professional_id, p_date), 0), p_received, now(), p_notes)
  on conflict (professional_id, handover_date) do update
    set received_amount = excluded.received_amount,
        confirmed_at = now(),
        notes = coalesce(excluded.notes, public.cash_handovers.notes),
        updated_at = now();
end;
$$;

-- ============================================================================
-- 7. Consumo interno (Anexo I, 5.2)
-- ============================================================================
-- Quem lança é o próprio profissional, pelo módulo dele — é o que torna o valor uma compra
-- reconhecida em vez de um desconto imposto (Anexo I, 5.2.1). Preço: venda menos a
-- cota-parte que ele receberia se tivesse vendido (5.2.2).
create or replace function public.register_professional_consumption(
  p_professional_id uuid, p_product_id uuid, p_quantity integer default 1
)
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare
  v_prof record;
  v_prod record;
  v_lucro numeric;
  v_cota numeric;
  v_preco numeric;
begin
  select * into v_prof from public.professionals where id = p_professional_id and status = 'ativo';
  if not found then raise exception 'Profissional não encontrado ou inativo.'; end if;

  select * into v_prod from public.products where id = p_product_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if v_prod.cost_price is null then
    raise exception 'Custo do produto ainda não cadastrado — não dá para calcular o valor do consumo.';
  end if;
  if coalesce(p_quantity, 1) < 1 then raise exception 'Quantidade inválida.'; end if;

  v_lucro := greatest(v_prod.price - v_prod.cost_price, 0);
  v_cota := round(v_lucro * v_prof.share_percent / 100.0, 2);
  v_preco := round((v_prod.price - v_cota) * p_quantity, 2);

  insert into public.professional_ledger (
    professional_id, entry_date, kind, product_id, quantity, description, amount,
    gross_amount, cost_amount, share_percent, created_by
  ) values (
    p_professional_id, current_date, 'consumo', p_product_id, p_quantity,
    v_prod.name || ' (consumo interno)', -v_preco,
    v_prod.price * p_quantity, v_prod.cost_price * p_quantity, v_prof.share_percent, 'profissional'
  );

  if v_prod.track_stock then
    update public.products
       set stock_quantity = stock_quantity - p_quantity, updated_at = now()
     where id = p_product_id;
  end if;

  return v_preco;
end;
$$;

-- Débito que não é consumo: ressarcimento de dano (Anexo I, 3.4) e ajustes. Exige a
-- concordância registrada, porque compensar sem acordo é o que o Anexo proíbe.
create or replace function public.admin_add_ledger_entry(
  p_professional_id uuid, p_kind text, p_amount numeric, p_description text, p_date date default null
)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_kind not in ('ressarcimento', 'estorno', 'ajuste') then
    raise exception 'Tipo inválido para lançamento manual.';
  end if;
  if coalesce(trim(p_description), '') = '' then
    raise exception 'Descrição é obrigatória — lançamento sem motivo não é contestável.';
  end if;

  insert into public.professional_ledger (professional_id, entry_date, kind, amount, description, created_by)
  values (p_professional_id, coalesce(p_date, current_date), p_kind, p_amount, trim(p_description), 'admin')
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- 8. Extrato e fechamento
-- ============================================================================
create or replace function public.admin_professional_statement(
  p_professional_id uuid, p_start date, p_end date
)
returns table (
  id uuid, entry_date date, kind text, description text, amount numeric,
  gross_amount numeric, fee_amount numeric, cost_amount numeric, base_amount numeric,
  share_percent numeric, payment_method text, pending_reason text, settlement_id uuid
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;

  return query
    select l.id, l.entry_date, l.kind, l.description, l.amount,
           l.gross_amount, l.fee_amount, l.cost_amount, l.base_amount,
           l.share_percent, l.payment_method, l.pending_reason, l.settlement_id
      from public.professional_ledger l
     where l.professional_id = p_professional_id
       and l.entry_date between p_start and p_end
     order by l.entry_date, l.created_at;
end;
$$;

-- Fecha o período e devolve o resumo para a tela de conferência. Não paga nada: o
-- pagamento é um segundo passo deliberado, depois de o Juliano conferir com ele.
create or replace function public.admin_close_settlement(
  p_professional_id uuid, p_start date, p_end date
)
returns table (
  settlement_id uuid, total_credits numeric, total_debits numeric,
  net_amount numeric, pending_count integer, cash_expected numeric, cash_received numeric
)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_credits numeric;
  v_debits numeric;
  v_pending integer;
  v_cash_expected numeric;
  v_cash_received numeric;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_end < p_start then
    raise exception 'Período inválido.';
  end if;

  select coalesce(sum(case when l.amount > 0 then l.amount else 0 end), 0),
         coalesce(sum(case when l.amount < 0 then -l.amount else 0 end), 0),
         count(*) filter (where l.pending_reason is not null)
    into v_credits, v_debits, v_pending
    from public.professional_ledger l
   where l.professional_id = p_professional_id
     and l.entry_date between p_start and p_end
     and (l.settlement_id is null);

  select coalesce(sum(h.expected_amount), 0), coalesce(sum(h.received_amount), 0)
    into v_cash_expected, v_cash_received
    from public.cash_handovers h
   where h.professional_id = p_professional_id
     and h.handover_date between p_start and p_end;

  insert into public.professional_settlements (
    professional_id, period_start, period_end, status,
    total_credits, total_debits, net_amount, pending_count, closed_at
  ) values (
    p_professional_id, p_start, p_end, 'conferido',
    v_credits, v_debits, v_credits - v_debits, v_pending, now()
  )
  on conflict (professional_id, period_start, period_end) do update
    set total_credits = excluded.total_credits,
        total_debits = excluded.total_debits,
        net_amount = excluded.net_amount,
        pending_count = excluded.pending_count,
        status = case when public.professional_settlements.status = 'pago' then 'pago' else 'conferido' end,
        closed_at = now(),
        updated_at = now()
  returning id into v_id;

  update public.professional_ledger l
     set settlement_id = v_id, updated_at = now()
   where l.professional_id = p_professional_id
     and l.entry_date between p_start and p_end
     and l.settlement_id is null;

  return query select v_id, v_credits, v_debits, v_credits - v_debits, v_pending, v_cash_expected, v_cash_received;
end;
$$;

create or replace function public.admin_mark_settlement_paid(
  p_settlement_id uuid, p_method text default 'pix', p_reference text default null
)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;

  update public.professional_settlements
     set status = 'pago', paid_at = now(), paid_method = p_method,
         paid_reference = p_reference, updated_at = now()
   where id = p_settlement_id and status <> 'cancelado';

  if not found then
    raise exception 'Fechamento não encontrado.';
  end if;
end;
$$;

create or replace function public.admin_set_payment_fee(p_method text, p_percent numeric)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_percent is null or p_percent < 0 or p_percent >= 100 then
    raise exception 'Percentual inválido.';
  end if;

  update public.payment_method_fees
     set fee_percent = p_percent, configured = true, updated_at = now()
   where method = p_method;

  if not found then
    raise exception 'Meio de pagamento não encontrado.';
  end if;
end;
$$;

-- ============================================================================
-- 9. Permissões
-- ============================================================================
revoke execute on function public.record_booking_shares(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_cash_due(uuid, date) from public, anon, authenticated;
revoke execute on function public.register_professional_consumption(uuid, uuid, integer) from public, anon;
revoke execute on function public.admin_confirm_cash_handover(uuid, date, numeric, text) from public, anon;
revoke execute on function public.admin_add_ledger_entry(uuid, text, numeric, text, date) from public, anon;
revoke execute on function public.admin_professional_statement(uuid, date, date) from public, anon;
revoke execute on function public.admin_close_settlement(uuid, date, date) from public, anon;
revoke execute on function public.admin_mark_settlement_paid(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_payment_fee(text, numeric) from public, anon;

grant execute on function public.register_professional_consumption(uuid, uuid, integer) to authenticated;
grant execute on function public.admin_confirm_cash_handover(uuid, date, numeric, text) to authenticated;
grant execute on function public.admin_add_ledger_entry(uuid, text, numeric, text, date) to authenticated;
grant execute on function public.admin_professional_statement(uuid, date, date) to authenticated;
grant execute on function public.admin_close_settlement(uuid, date, date) to authenticated;
grant execute on function public.admin_mark_settlement_paid(uuid, text, text) to authenticated;
grant execute on function public.admin_set_payment_fee(text, numeric) to authenticated;
