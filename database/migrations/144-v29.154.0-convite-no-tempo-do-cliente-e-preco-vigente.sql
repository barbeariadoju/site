-- 144 — v29.154.0 (08/09/2026) — Convite de retorno no tempo do cliente + preço vigente na data
--
-- Duas coisas que se cruzam no reajuste de 01/10/2026:
--
-- 1) CONVITE DE RETORNO. Passou a sair alguns dias antes do retorno típico do cliente (dia 12
--    pra corte, dia 5 pra barba, ou a cadência dele menos 4) em vez de no dia seguinte. A
--    tabela ganha duas colunas de auditoria — o alvo calculado e o dia real do envio — pra
--    dar pra medir a régua nova contra a velha sem adivinhar.
--
-- 2) PREÇO VIGENTE NA DATA DO ATENDIMENTO. A placa do reajuste diz "vale inclusive para horários
--    marcados antes", mas o sistema gravava em bookings.service_price o preço do DIA DA MARCAÇÃO:
--    site (catálogo vira por data de hoje), JuIA, balcão e o próprio convite de retorno (que
--    copiava o valor pago da última vez). Um cliente que reservasse em setembro pra 03/10 ficava
--    com R$ 40 gravado e ouvia R$ 50 na cadeira. Aqui entra:
--      - service_price_on(nome, data): preço de um serviço (ou combo "A + B") numa data, já
--        considerando reajustes agendados em service_price_changes ainda não aplicados;
--      - trigger BEFORE INSERT em bookings: se o valor recebido é exatamente a tabela de hoje e
--        a tabela da data do atendimento é outra, grava a da data. Só nesse caso — desconto,
--        cortesia, vale-presente e preço digitado à mão no balcão passam intocados;
--      - reprice_future_bookings(): rede de segurança pros agendamentos que já existiam antes
--        deste trigger, chamada pelo apply_scheduled_price_changes() no dia da virada. Mesma
--        regra estreita, e cada mudança fica registrada na customer_timeline.

-- ---------------------------------------------------------------------------------------------
-- 1) return_invites: auditoria da régua nova
-- ---------------------------------------------------------------------------------------------
alter table public.return_invites
  add column if not exists target_days integer,
  add column if not exists days_since integer;

comment on column public.return_invites.target_days is
  'v29.154.0: dia-alvo do envio (dias após o atendimento) calculado pela regra — cadência do cliente ou padrão da família do serviço.';
comment on column public.return_invites.days_since is
  'v29.154.0: dias entre o atendimento e o envio real (ou a decisão de pular).';

-- ---------------------------------------------------------------------------------------------
-- 2) Preço de um serviço (ou combo) numa data
-- ---------------------------------------------------------------------------------------------
-- O nome pode ser um item do catálogo ("Corte + Barba Express") ou vários itens unidos por " + "
-- ("Corte de cabelo + Sobrancelha Masculina"). Como itens do catálogo também têm " + " no nome,
-- o casamento é guloso da esquerda pra direita: tenta o pedaço mais longo que exista no catálogo.
-- Qualquer pedaço desconhecido → nenhuma linha (quem chama mantém o preço que tinha).
create or replace function public.service_price_on(p_service_name text, p_date date)
returns table(price numeric, effective_from date)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  tokens text[];
  n integer;
  i integer;
  j integer;
  nome text;
  v_base numeric;
  v_new numeric;
  v_eff date;
  achou boolean;
  total numeric := 0;
  vigencia date := null;
begin
  tokens := regexp_split_to_array(coalesce(p_service_name, ''), '\s+\+\s+');
  n := coalesce(array_length(tokens, 1), 0);
  if n = 0 or p_date is null then return; end if;

  i := 1;
  while i <= n loop
    achou := false;
    for j in reverse n..i loop
      nome := array_to_string(tokens[i:j], ' + ');
      select s.price into v_base from public.services s where s.name = nome limit 1;
      if found then
        -- Reajuste agendado e ainda não aplicado cuja vigência (data em São Paulo) já vale em p_date.
        select c.new_price, (c.effective_at at time zone 'America/Sao_Paulo')::date
          into v_new, v_eff
          from public.service_price_changes c
         where c.service_name = nome
           and c.applied_at is null
           and (c.effective_at at time zone 'America/Sao_Paulo')::date <= p_date
         order by c.effective_at desc
         limit 1;
        if found then
          total := total + coalesce(v_new, v_base, 0);
          if vigencia is null or v_eff > vigencia then vigencia := v_eff; end if;
        else
          total := total + coalesce(v_base, 0);
        end if;
        achou := true;
        i := j + 1;
        exit;
      end if;
    end loop;
    if not achou then return; end if;
  end loop;

  price := total;
  effective_from := vigencia;
  return next;
end;
$$;

grant execute on function public.service_price_on(text, date) to service_role, authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- 3) Trigger: agendamento nasce com o preço da data do atendimento
-- ---------------------------------------------------------------------------------------------
create or replace function public.bookings_preco_vigente_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  hoje date := (timezone('America/Sao_Paulo', now()))::date;
  tabela_hoje numeric;
  tabela_na_data numeric;
begin
  if new.status not in ('pending', 'confirmed') then return new; end if;
  if new.booking_date is null or new.booking_date <= hoje then return new; end if;
  if coalesce(new.courtesy, false) then return new; end if;
  if new.gift_card_id is not null or new.loyalty_free_service is not null or new.loyalty_reward_id is not null then return new; end if;

  select p.price into tabela_hoje from public.service_price_on(new.service_name, hoje) p limit 1;
  select p.price into tabela_na_data from public.service_price_on(new.service_name, new.booking_date) p limit 1;

  if tabela_hoje is null or tabela_na_data is null then return new; end if;
  if coalesce(new.service_price, -1) <> tabela_hoje then return new; end if; -- valor não é "a tabela de hoje": alguém decidiu esse preço
  if tabela_na_data = tabela_hoje then return new; end if;

  new.service_price := tabela_na_data;
  return new;
end;
$$;

drop trigger if exists trg_bookings_preco_vigente on public.bookings;
create trigger trg_bookings_preco_vigente
  before insert on public.bookings
  for each row execute function public.bookings_preco_vigente_trg();

-- ---------------------------------------------------------------------------------------------
-- 4) Rede de segurança: agendamentos futuros gravados antes do trigger
-- ---------------------------------------------------------------------------------------------
-- Mesma regra estreita do trigger: só mexe se o valor gravado é exatamente a tabela que valia
-- no dia da marcação E a tabela da data do atendimento é outra. Registra na customer_timeline.
create or replace function public.reprice_future_bookings()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  hoje date := (timezone('America/Sao_Paulo', now()))::date;
  r record;
  tabela_marcacao numeric;
  tabela_na_data numeric;
  alterados integer := 0;
  v_customer uuid;
begin
  for r in
    select b.id, b.service_name, b.service_price, b.booking_date, b.phone_key,
           (timezone('America/Sao_Paulo', b.created_at))::date as marcado_em
      from public.bookings b
     where b.status in ('pending', 'confirmed')
       and b.booking_date >= hoje
       and coalesce(b.courtesy, false) = false
       and b.gift_card_id is null
       and b.loyalty_free_service is null
       and b.loyalty_reward_id is null
       and b.prepay_confirmed_at is null
  loop
    select p.price into tabela_marcacao from public.service_price_on(r.service_name, r.marcado_em) p limit 1;
    select p.price into tabela_na_data from public.service_price_on(r.service_name, r.booking_date) p limit 1;
    if tabela_marcacao is null or tabela_na_data is null then continue; end if;
    if coalesce(r.service_price, -1) <> tabela_marcacao then continue; end if;
    if tabela_na_data = tabela_marcacao then continue; end if;

    update public.bookings set service_price = tabela_na_data, updated_at = now() where id = r.id;
    alterados := alterados + 1;

    select c.id into v_customer from public.customer_profiles c where c.phone_key = r.phone_key limit 1;
    if v_customer is not null then
      insert into public.customer_timeline(customer_id, booking_id, event_type, title, details)
      values (v_customer, r.id, 'price_update', 'Valor atualizado pela tabela vigente na data',
              jsonb_build_object('de', r.service_price, 'para', tabela_na_data, 'booking_date', r.booking_date, 'motivo', 'reajuste agendado (service_price_changes)'));
    end if;
  end loop;
  return alterados;
end;
$$;

grant execute on function public.reprice_future_bookings() to service_role;

-- apply_scheduled_price_changes(): mesma função de antes (aplica os reajuste vencidos em
-- services), agora seguida da rede de segurança acima. O cron bdj-aplicar-reajuste-agendado
-- (03h05 UTC, diário) continua chamando só esta.
create or replace function public.apply_scheduled_price_changes()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  afetados integer := 0;
  repricados integer := 0;
begin
  -- Rede de segurança ANTES de aplicar: service_price_on ainda enxerga a mudança como
  -- "agendada e não aplicada" e compara tabela do dia da marcação × tabela da data.
  repricados := public.reprice_future_bookings();

  with pendentes as (
    select id, service_name, new_price
    from service_price_changes
    where applied_at is null and effective_at <= now()
    for update skip locked
  ), atualizados as (
    update services s
    set price = p.new_price, updated_at = now()
    from pendentes p
    where s.name = p.service_name
    returning p.id
  )
  update service_price_changes c
  set applied_at = now()
  from atualizados a
  where c.id = a.id;

  get diagnostics afetados = row_count;
  raise notice 'apply_scheduled_price_changes: % reajuste(s) aplicado(s), % agendamento(s) futuro(s) repricado(s)', afetados, repricados;
  return afetados;
end;
$$;
