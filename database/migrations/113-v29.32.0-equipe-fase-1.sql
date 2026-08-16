-- Barbearia do Ju — v29.32.0 — Fase 1 do sistema do 2º profissional
--
-- Até aqui o banco não tinha noção de QUEM atendeu: `bookings` guardava serviço, valor e
-- cliente, e o barbeiro era implícito porque só existia um. Com a segunda cadeira isso
-- deixa de funcionar — sem essa coluna não há cota-parte, não há fechamento semanal e não
-- há como responder "quanto ele produziu essa semana".
--
-- Esta migration entrega a BASE (cadastro + vínculo + custo de produto). A razão de
-- cota-parte e o fechamento vêm na 114, que depende desta.
--
-- Decisões do contrato v2.0 (16/08/2026) que aparecem aqui:
--   • cota-parte de 50% é POR PROFISSIONAL (share_percent), não constante no código —
--     o Juliano pode fechar diferente com outra pessoa sem migration nova;
--   • CNPJ com prazo de 30 dias (Cl. 5.3): o cadastro nasce válido com `cnpj_deadline`
--     preenchido e sem CNPJ, e o sistema cobra depois;
--   • desligamento com um clique era requisito explícito ("eventualmente vem um cara, não
--     dá certo, troco por outro") — é a RPC admin_set_professional_status.

-- ============================================================================
-- 1. Cadastro de profissionais
-- ============================================================================
create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text,
  phone text,
  email text,
  cpf text,
  cnpj text,
  company_name text,
  tax_regime text check (tax_regime in ('mei', 'simples', 'sem_cnpj')),
  -- Percentual que fica com o PROFISSIONAL. 50 = modelo padrão da casa.
  share_percent numeric(5,2) not null default 50 check (share_percent > 0 and share_percent <= 100),
  is_owner boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'encerrado')),
  started_at date not null default current_date,
  ended_at date,
  -- Cl. 5.3 do contrato: 30 dias para abrir o CNPJ, com o contrato já valendo.
  cnpj_deadline date,
  contract_version text,
  contract_accepted_at timestamptz,
  contract_signature_url text,
  contract_photo_url text,
  contract_hash text,
  pix_key text,
  agenda_color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.professionals is 'Profissionais que atendem na barbearia (o próprio Juliano incluído, com is_owner=true). Base do rateio de cota-parte da Lei 13.352/2016 — ver CONTRATO-PARCERIA-MINUTA.md.';
comment on column public.professionals.share_percent is 'Percentual da cota-parte que fica com o PROFISSIONAL. Padrão 50. Fica no cadastro, e não no código, para permitir acordo diferente sem migration.';
comment on column public.professionals.cnpj_deadline is 'Prazo da Cláusula 5.3: assinatura admitida sem CNPJ, desde que regularizado em 30 dias. Vencido e sem CNPJ, autoriza a rescisão da Cláusula 11.3(g).';
comment on column public.professionals.status is 'ativo | suspenso | encerrado. Encerrar revoga acesso e para de gerar cota-parte; o histórico é preservado para fins fiscais (Cl. 12.2).';

create index if not exists professionals_status_idx on public.professionals (status) where status = 'ativo';

alter table public.professionals enable row level security;
-- Sem policy nenhuma: a tabela guarda CPF, CNPJ e chave Pix. Todo acesso passa por RPC
-- SECURITY DEFINER com is_admin() ou pelo service_role das Edge Functions. Leitura
-- pública aqui seria vazamento de dado pessoal de terceiro.

create or replace function public.professionals_touch_updated_at()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists professionals_touch_updated_at on public.professionals;
create trigger professionals_touch_updated_at
  before update on public.professionals
  for each row execute function public.professionals_touch_updated_at();

-- O dono entra como profissional também: ele atende, e o relatório de produção precisa
-- somar os atendimentos dele. share_percent 100 porque não há rateio consigo mesmo.
insert into public.professionals (name, display_name, is_owner, share_percent, status, tax_regime, started_at)
select 'Juliano Bruno Lopes Padilha', 'Juliano', true, 100, 'ativo', 'simples', '2026-03-01'
where not exists (select 1 from public.professionals where is_owner = true);

-- ============================================================================
-- 2. Vínculo do atendimento com quem atendeu
-- ============================================================================
alter table public.bookings
  add column if not exists professional_id uuid references public.professionals(id) on delete set null;

comment on column public.bookings.professional_id is 'Quem atendeu. Base do rateio de cota-parte. Histórico anterior a 16/08/2026 foi atribuído ao dono, que era o único profissional da casa.';

create index if not exists bookings_professional_idx on public.bookings (professional_id, booking_date);

-- Backfill: até esta data só existiu um barbeiro, então todo o histórico é dele. Sem isso,
-- qualquer relatório por profissional nasceria com um buraco de meses.
update public.bookings
   set professional_id = (select id from public.professionals where is_owner = true limit 1)
 where professional_id is null;

-- ============================================================================
-- 3. Custo do produto — pré-requisito do rateio de produtos e do consumo interno
-- ============================================================================
-- Cl. 3.2: a cota-parte de produto é 50% do LUCRO LÍQUIDO (venda − custo − taxa). Sem
-- `cost_price` não existe lucro líquido, e o rateio de produto não pode ser calculado.
-- Anexo I, 5.2.2: o consumo interno também parte do custo.
alter table public.products
  add column if not exists cost_price numeric(10,2) check (cost_price >= 0),
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists track_stock boolean not null default false;

comment on column public.products.cost_price is 'Custo de aquisição. Nulo = custo ainda não informado: o rateio de produto fica pendente até o Juliano preencher, em vez de assumir zero e pagar cota-parte sobre o preço cheio.';
comment on column public.products.track_stock is 'Liga o controle de estoque para este item (bebidas do frigobar). Produto sem controle não bloqueia venda por falta de saldo.';

-- ============================================================================
-- 4. RPCs de administração
-- ============================================================================
create or replace function public.admin_list_professionals(p_include_inactive boolean default false)
returns table (
  id uuid, name text, display_name text, phone text, email text,
  cpf text, cnpj text, company_name text, tax_regime text,
  share_percent numeric, is_owner boolean, status text,
  started_at date, ended_at date, cnpj_deadline date,
  contract_accepted_at timestamptz, pix_key text, agenda_color text, notes text,
  cnpj_pendente boolean
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, p.display_name, p.phone, p.email,
           p.cpf, p.cnpj, p.company_name, p.tax_regime,
           p.share_percent, p.is_owner, p.status,
           p.started_at, p.ended_at, p.cnpj_deadline,
           p.contract_accepted_at, p.pix_key, p.agenda_color, p.notes,
           -- Sinaliza o prazo da Cl. 5.3 vencido sem CNPJ, para o painel avisar antes
           -- de virar problema fiscal.
           (p.cnpj is null and p.cnpj_deadline is not null and p.cnpj_deadline < current_date) as cnpj_pendente
      from public.professionals p
     where p_include_inactive or p.status = 'ativo'
     order by p.is_owner desc, p.status, p.name;
end;
$$;

create or replace function public.admin_upsert_professional(
  p_id uuid default null,
  p_name text default null,
  p_display_name text default null,
  p_phone text default null,
  p_email text default null,
  p_cpf text default null,
  p_cnpj text default null,
  p_company_name text default null,
  p_tax_regime text default null,
  p_share_percent numeric default 50,
  p_pix_key text default null,
  p_agenda_color text default null,
  p_notes text default null
)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nome é obrigatório.';
  end if;

  if p_id is null then
    insert into public.professionals (
      name, display_name, phone, email, cpf, cnpj, company_name, tax_regime,
      share_percent, pix_key, agenda_color, notes,
      -- Cl. 5.3: entrando sem CNPJ, o prazo de 30 dias começa a contar sozinho.
      cnpj_deadline
    ) values (
      trim(p_name), nullif(trim(coalesce(p_display_name, '')), ''), p_phone, p_email,
      p_cpf, nullif(trim(coalesce(p_cnpj, '')), ''), p_company_name, p_tax_regime,
      coalesce(p_share_percent, 50), p_pix_key, p_agenda_color, p_notes,
      case when coalesce(trim(coalesce(p_cnpj, '')), '') = '' then current_date + 30 else null end
    )
    returning id into v_id;
  else
    update public.professionals set
      name = coalesce(trim(p_name), name),
      display_name = coalesce(nullif(trim(coalesce(p_display_name, '')), ''), display_name),
      phone = coalesce(p_phone, phone),
      email = coalesce(p_email, email),
      cpf = coalesce(p_cpf, cpf),
      cnpj = coalesce(nullif(trim(coalesce(p_cnpj, '')), ''), cnpj),
      company_name = coalesce(p_company_name, company_name),
      tax_regime = coalesce(p_tax_regime, tax_regime),
      share_percent = coalesce(p_share_percent, share_percent),
      pix_key = coalesce(p_pix_key, pix_key),
      agenda_color = coalesce(p_agenda_color, agenda_color),
      notes = coalesce(p_notes, notes),
      -- CNPJ informado encerra o prazo da Cl. 5.3.
      cnpj_deadline = case when nullif(trim(coalesce(p_cnpj, '')), '') is not null then null else cnpj_deadline end
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Profissional não encontrado.';
    end if;
  end if;

  return v_id;
end;
$$;

-- O "um clique e ele perde tudo" que o Juliano pediu. Não apaga nada: encerra o vínculo,
-- para de gerar cota-parte e derruba os acessos. O histórico continua inteiro, porque é
-- ele que prova os repasses numa eventual discussão (Cl. 12.2).
create or replace function public.admin_set_professional_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_status not in ('ativo', 'suspenso', 'encerrado') then
    raise exception 'Status inválido.';
  end if;
  if exists (select 1 from public.professionals where id = p_id and is_owner = true) and p_status <> 'ativo' then
    raise exception 'O dono não pode ser desativado.';
  end if;

  update public.professionals
     set status = p_status,
         ended_at = case when p_status = 'encerrado' then current_date else null end
   where id = p_id;

  if not found then
    raise exception 'Profissional não encontrado.';
  end if;
end;
$$;

create or replace function public.admin_set_product_cost(p_product_id uuid, p_cost numeric, p_track_stock boolean default null)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'Custo inválido.';
  end if;

  update public.products
     set cost_price = p_cost,
         track_stock = coalesce(p_track_stock, track_stock),
         updated_at = now()
   where id = p_product_id;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;
end;
$$;

-- Funções nascem com EXECUTE para PUBLIC; sem este revoke, anon e authenticated herdam
-- (lição das migrations 087/088 — o revoke de anon/authenticated sozinho não fecha).
revoke execute on function public.admin_list_professionals(boolean) from public, anon;
revoke execute on function public.admin_upsert_professional(uuid, text, text, text, text, text, text, text, text, numeric, text, text, text) from public, anon;
revoke execute on function public.admin_set_professional_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_product_cost(uuid, numeric, boolean) from public, anon;

grant execute on function public.admin_list_professionals(boolean) to authenticated;
grant execute on function public.admin_upsert_professional(uuid, text, text, text, text, text, text, text, text, numeric, text, text, text) to authenticated;
grant execute on function public.admin_set_professional_status(uuid, text) to authenticated;
grant execute on function public.admin_set_product_cost(uuid, numeric, boolean) to authenticated;
