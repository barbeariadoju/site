-- v29.188.0 — Fidelidade: o prêmio voltou a existir de verdade (caso Juliano Prando, 15/09/2026)
--
-- O que aconteceu: o Juliano Prando fechou o 10º ponto na sexta (12/09) e o sistema anotou
-- "1 prêmio disponível" no contador da conta (loyalty_accounts.rewards_available) — mas
-- NADA além disso. Ninguém avisou o cliente, o painel não mostrou nada, e na terça (15/09) o
-- Juliano fez a Barba Express dele "na fidelidade" de cabeça, sem o sistema saber. Palavras
-- dele: "precisamos nos organizar porque outro cliente pode acontecer a mesma coisa, passar
-- batido e o cara achar que eu não quero dar o benefício pra ele".
--
-- Causa: a v29.10.0 (migrations 100/101) criou a tabela loyalty_rewards — o prêmio como
-- registro individual, com prazo de 30 dias, aviso por WhatsApp (cron loyalty-rewards-notify),
-- aplicação automática pela JuIA (reserve_loyalty_reward) e baixa na conclusão. Só que as
-- correções seguintes do gatilho v21_sync_loyalty_on_completed_booking (v29.12.0
-- phone_match_key, v29.20.0 cortesia, v29.80.0 só-produto) foram aplicadas direto no banco
-- a partir da versão ANTIGA (migration 099) e apagaram tudo isso. Desde então a tabela
-- loyalty_rewards ficou vazia (0 linhas em 15/09/2026), o cron de aviso nunca teve o que
-- mandar, a JuIA nunca aplicou prêmio, e o "Bônus de fidelidade" no Concluir gravava o
-- desconto no atendimento sem dar baixa no prêmio (o contador ficava inflado pra sempre).
-- Dois clientes estavam com prêmio "no contador" e sem registro: John Maicon (desde 02/09)
-- e Juliano Prando (desde 12/09).
--
-- O que fica (uma regra só, pra todo caminho que conclui atendimento — Agenda, Hoje,
-- Balcão, JuIA):
--   1. ao fechar 10 pontos, nasce uma linha em loyalty_rewards (available, 30 dias) — é ela
--      que dispara o WhatsApp de parabéns e que a JuIA aplica sozinha no próximo agendamento;
--   2. ao concluir um atendimento com prêmio (loyalty_reward_id reservado pela JuIA, OU
--      loyalty_discount > 0 / payment_method = 'fidelidade' marcados no Concluir/Balcão), o
--      gatilho dá baixa: o prêmio mais antigo do cliente vira 'redeemed', o atendimento fica
--      ligado a ele (loyalty_reward_id), o contador desce e fica um evento 'redeem' no
--      histórico. Se o contador dizia que havia prêmio mas não existia a linha (herança do
--      período quebrado), o gatilho cria a linha já resgatada — o histórico fica completo;
--   3. cancelamento/ausência de um atendimento com prêmio reservado devolve o prêmio.
-- A baixa acontece ANTES do ponto do dia ser creditado: o ponto ganho hoje nunca é engolido
-- pelo próprio resgate de hoje.
--
-- Regra de pontos NÃO mudou aqui: continua 1 ponto por atendimento concluído (decisão da
-- v29.9.0), mesmo com dois serviços no combo. O Juliano levantou em 15/09 que o combo de
-- sexta "em teoria" valeria 2 pontos — fica como decisão pendente dele, porque muda a regra
-- pra todo mundo e o que a JuIA anuncia ao cliente.

-- 1) Gatilho: pontos, prêmio como registro e baixa do prêmio na conclusão.
create or replace function public.v21_sync_loyalty_on_completed_booking()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_customer uuid;
  v_points integer;
  v_rewards integer;
  v_reward_id uuid;
  v_reward_customer uuid;
  v_completing boolean;
  v_usa_premio boolean;
begin
  v_completing := new.status = 'completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed');

  -- ---- 2. Baixa do prêmio usado neste atendimento (antes do ponto do dia) ----
  v_usa_premio := v_completing and not coalesce(new.courtesy, false)
    and (new.loyalty_reward_id is not null
         or coalesce(new.loyalty_discount, 0) > 0
         or new.payment_method = 'fidelidade');
  if v_usa_premio then
    v_reward_id := null; v_reward_customer := null;
    if new.loyalty_reward_id is not null then
      -- prêmio reservado pela JuIA no agendamento (reserve_loyalty_reward)
      update public.loyalty_rewards
         set status = 'redeemed', redeemed_at = now(), booking_id = new.id, updated_at = now()
       where id = new.loyalty_reward_id and status in ('available','reserved')
       returning id, customer_id into v_reward_id, v_reward_customer;
    else
      v_customer := public.v27_customer_for_booking(new);
      if v_customer is not null then
        -- prêmio mais antigo do cliente (ou o reservado pra este mesmo atendimento)
        select r.id, r.customer_id into v_reward_id, v_reward_customer
          from public.loyalty_rewards r
         where r.customer_id = v_customer
           and (r.status = 'available' or (r.status = 'reserved' and r.booking_id = new.id))
         order by r.earned_at asc
         limit 1
         for update;
        if v_reward_id is not null then
          update public.loyalty_rewards
             set status = 'redeemed', redeemed_at = now(), booking_id = new.id, updated_at = now()
           where id = v_reward_id;
        elsif exists (select 1 from public.loyalty_accounts la where la.customer_id = v_customer and la.rewards_available > 0) then
          -- contador dizia que havia prêmio, mas sem registro (período em que o gatilho
          -- estava quebrado): cria a linha já resgatada pra o histórico fechar
          insert into public.loyalty_rewards(customer_id, status, earned_at, expires_at, booking_id, redeemed_at, notified_at)
            values (v_customer, 'redeemed', now(), now(), new.id, now(), now())
            returning id into v_reward_id;
          v_reward_customer := v_customer;
        end if;
        -- liga o atendimento ao prêmio (UPDATE sem tocar em status: este gatilho não dispara de novo)
        if v_reward_id is not null then
          update public.bookings set loyalty_reward_id = v_reward_id where id = new.id;
        end if;
      end if;
    end if;

    if v_reward_customer is not null then
      update public.loyalty_accounts
         set rewards_available = greatest(0, rewards_available - 1), updated_at = now()
       where customer_id = v_reward_customer;
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_reward_customer, new.id, 'redeem', 0,
                'Prêmio resgatado: ' || coalesce(nullif(trim(new.loyalty_free_service), ''), new.service_name) || ' por nossa conta')
        on conflict do nothing;
    elsif v_customer is not null then
      -- "Bônus de fidelidade" marcado sem prêmio no sistema: registra, não bloqueia (a
      -- decisão é do Juliano na cadeira — ex.: cartão de papel antigo). Fica visível no histórico.
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_customer, new.id, 'redeem', 0,
                'Serviço por nossa conta SEM prêmio disponível no sistema: ' || coalesce(nullif(trim(new.loyalty_free_service), ''), new.service_name))
        on conflict do nothing;
    end if;
  end if;

  -- ---- 1. Ponto do atendimento concluído ----
  -- v29.20.0: cortesia não credita fidelidade
  -- v29.80.0: venda só de produto (serviço R$0 + produtos) não credita fidelidade
  if v_completing and not coalesce(new.courtesy, false)
     and not (coalesce(new.service_price, 0) <= 0 and coalesce(new.products_price, 0) > 0) then
    -- v29.12.0: phone_match_key em vez de igualdade exata de dígitos; v29.188.0: mesma
    -- escolha de cadastro da v27_customer_for_booking (quem já tem conta de fidelidade primeiro)
    v_customer := public.v27_customer_for_booking(new);
    if v_customer is not null then
      insert into public.loyalty_accounts(customer_id) values (v_customer)
        on conflict (customer_id) do nothing;
      insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
        values (v_customer, new.id, 'earn', 1, 'Atendimento concluído')
        on conflict do nothing;
      if found then
        update public.loyalty_accounts
           set points = points + 1, lifetime_points = lifetime_points + 1, updated_at = now()
         where customer_id = v_customer
         returning points, rewards_available into v_points, v_rewards;
        while v_points >= 10 loop
          v_points := v_points - 10;
          v_rewards := v_rewards + 1;
          update public.loyalty_accounts
             set points = v_points, rewards_available = v_rewards, updated_at = now()
           where customer_id = v_customer;
          insert into public.loyalty_rewards(customer_id, earned_at, expires_at)
            values (v_customer, now(), now() + interval '30 days');
        end loop;
      end if;
    end if;
  end if;

  -- ---- 3. Prêmio reservado pela JuIA num atendimento que cancelou/faltou: devolve ----
  if new.loyalty_reward_id is not null
     and new.status in ('cancelled','no_show')
     and (TG_OP = 'INSERT' or coalesce(old.status,'') not in ('cancelled','no_show')) then
    update public.loyalty_rewards
       set status = 'available', booking_id = null, updated_at = now()
     where id = new.loyalty_reward_id and status = 'reserved';
  end if;

  return new;
end
$$;

-- 2) Mesclar cadastros: os prêmios (registros) também mudam de dono, e o estouro de 10
--    pontos na soma gera o registro do prêmio (antes só mexia no contador).
create or replace function public.admin_merge_customers(p_keep_id uuid, p_merge_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_keep_phone text;
  v_merge_phone text;
  v_merge_points integer;
  v_merge_lifetime integer;
  v_merge_rewards integer;
  v_points integer;
  v_rewards integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_keep_id = p_merge_id then
    raise exception 'Selecione dois clientes diferentes.';
  end if;

  select phone into v_keep_phone from public.customer_profiles where id = p_keep_id;
  select phone into v_merge_phone from public.customer_profiles where id = p_merge_id;
  if v_keep_phone is null or v_merge_phone is null then
    raise exception 'Cliente não encontrado.';
  end if;

  update public.bookings
    set customer_phone = v_keep_phone
    where regexp_replace(customer_phone,'\D','','g') = regexp_replace(v_merge_phone,'\D','','g');

  update public.customer_timeline set customer_id = p_keep_id where customer_id = p_merge_id;
  update public.experience_requests set customer_id = p_keep_id where customer_id = p_merge_id;
  update public.loyalty_events set customer_id = p_keep_id where customer_id = p_merge_id;
  update public.loyalty_rewards set customer_id = p_keep_id, updated_at = now() where customer_id = p_merge_id;
  update public.customer_outreach_log set customer_id = p_keep_id, phone = v_keep_phone where customer_id = p_merge_id;

  select points, lifetime_points, rewards_available
    into v_merge_points, v_merge_lifetime, v_merge_rewards
    from public.loyalty_accounts where customer_id = p_merge_id;

  if v_merge_points is not null then
    insert into public.loyalty_accounts(customer_id) values (p_keep_id) on conflict (customer_id) do nothing;
    update public.loyalty_accounts
      set points = points + coalesce(v_merge_points,0),
          lifetime_points = lifetime_points + coalesce(v_merge_lifetime,0),
          rewards_available = rewards_available + coalesce(v_merge_rewards,0),
          updated_at = now()
      where customer_id = p_keep_id
      returning points, rewards_available into v_points, v_rewards;

    while v_points >= 10 loop
      v_points := v_points - 10;
      v_rewards := v_rewards + 1;
      insert into public.loyalty_rewards(customer_id, earned_at, expires_at)
        values (p_keep_id, now(), now() + interval '30 days');
    end loop;
    update public.loyalty_accounts set points = v_points, rewards_available = v_rewards, updated_at = now() where customer_id = p_keep_id;

    delete from public.loyalty_accounts where customer_id = p_merge_id;
  end if;

  insert into public.customer_timeline(customer_id, booking_id, event_type, title, details)
  values (p_keep_id, null, 'customer_merged', 'Cadastro duplicado mesclado', jsonb_build_object(
    'merged_customer_id', p_merge_id,
    'merged_phone', v_merge_phone,
    'merged_by', auth.uid()
  ));

  delete from public.customer_profiles where id = p_merge_id;
end;
$$;

-- 3) Reposição: todo prêmio que o contador dizia existir e não tinha registro ganha a linha
--    agora. O prazo de 30 dias conta de HOJE (o cliente só passa a saber a partir daqui — não
--    faz sentido descontar os dias em que o sistema ficou calado). notified_at fica preenchido:
--    o Juliano Prando soube pessoalmente em 15/09; o aviso do John Maicon ficou segurado pra
--    o Juliano decidir (é uma mensagem de WhatsApp em nome dele) — pra soltar, é só zerar
--    notified_at que o cron manda na próxima rodada dentro do horário de contato.
insert into public.loyalty_rewards(customer_id, status, earned_at, expires_at, notified_at)
select la.customer_id, 'available', la.updated_at, now() + interval '30 days', now()
  from public.loyalty_accounts la
  cross join lateral generate_series(1, la.rewards_available - (
      select count(*) from public.loyalty_rewards r
       where r.customer_id = la.customer_id and r.status in ('available','reserved')
  )) g
 where la.rewards_available > 0;
