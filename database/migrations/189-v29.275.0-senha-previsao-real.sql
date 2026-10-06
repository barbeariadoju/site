-- v29.275.0 (06/10/2026) — Senha digital: previsão real, sem a folga do agendamento online.
--
-- Teste do Juliano (06/10, 11h20): pegou a senha com a cadeira e a agenda vazias e recebeu
-- "previsão para as 11:45". Causa: senha_digital_criar escolhia o horário pela mesma regra do
-- agendamento online (get_available_slots_excluding = agora + 15 min de antecedência, na grade de
-- 15 em 15) — 11:20 + 15 = 11:35, arredondado para 11:45. Quem pegou a senha já está na loja: a
-- folga de 15 min existe para o cliente online chegar, não faz sentido aqui.
--
-- 1) senha_digital_criar procura o primeiro horário livre a partir de AGORA (arredondado para os
--    próximos 5 min), testando também o fim exato de cada atendimento e bloqueio do dia (quem está
--    na cadeira até 11:40 → senha às 11:40, não 11:45). Mesmas travas de antes: fechamento,
--    bloqueios, choque com agendamento e descanso a cada 4 atendimentos.
-- 2) create_public_booking_v15 deixa passar o horário "agora" SÓ quando chamada de dentro da
--    senha_digital_criar (marca local da transação bdj.senha_porta, ligada e desligada lá dentro).
--    O site, a JuIA e o painel continuam com os 15 min. A marca não é alcançável pela API: cada
--    chamada do PostgREST é uma transação, set_config não é exposto, e senha_digital_criar só roda
--    pelo service_role.
-- 3) posicao (quantos antes de mim) passa a contar só quem ainda não terminou (end_time > agora),
--    como já fazia a tela de acompanhamento: o atendimento das 9h que ficou "confirmado" porque
--    ninguém clicou em Concluir não vira "Há 1 pessoa antes de você".

create or replace function public.create_public_booking_v15(p_customer_name text, p_customer_phone text, p_customer_email text, p_service_name text, p_service_price numeric, p_duration_minutes integer, p_booking_date date, p_start_time time without time zone, p_notes text DEFAULT NULL::text, p_selected_products jsonb DEFAULT '[]'::jsonb, p_extend_close_minutes integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_end time;
  v_nominal time;
  v_close time;
  v_products_price numeric;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_booking_start timestamp;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then raise exception 'Duração do serviço inválida.'; end if;

  v_booking_start := p_booking_date + p_start_time;
  if p_booking_date < v_now_sp::date then raise exception 'A data escolhida já passou.'; end if;
  -- v29.275.0: a senha digital (cliente já dentro da loja) pode começar agora; o resto segue com 15 min.
  if v_booking_start < v_now_sp + interval '15 minutes'
     and not (coalesce(current_setting('bdj.senha_porta', true), '') = '1'
              and v_booking_start >= date_trunc('minute', v_now_sp) - interval '1 minute') then
    raise exception 'Para agendamentos no mesmo dia, escolha um horário com pelo menos 15 minutos de antecedência.';
  end if;
  if extract(dow from p_booking_date) in (0, 1) then raise exception 'A barbearia não abre neste dia.'; end if;

  select nominal_close, latest_end into v_nominal, v_close from public.closing_rule(p_booking_date);
  v_close := v_close + make_interval(mins => least(greatest(coalesce(p_extend_close_minutes, 0) - 60, 0), 60));
  v_end := p_start_time + make_interval(mins => p_duration_minutes);
  if p_start_time < '08:00'::time or p_start_time > v_nominal or v_end > v_close then raise exception 'Horário fora do atendimento.'; end if;

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date = p_booking_date
      and (s.all_day or (p_start_time < s.end_time and v_end > s.start_time))
  ) then raise exception 'Este horário está bloqueado. Escolha outro.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.booking_date = p_booking_date
      and b.status in ('pending', 'confirmed')
      and p_start_time < b.end_time and v_end > b.start_time
  ) then raise exception 'Este horário ficou indisponível. Escolha outro.'; end if;

  -- v29.185.0: descanso obrigatório a cada 4 atendimentos seguidos.
  if not public.descanso_ok(p_booking_date, p_start_time, p_duration_minutes, null) then
    raise exception 'Este horário ficou indisponível: depois de 4 atendimentos seguidos o Juliano precisa de 15 minutos de descanso. Escolha um pouco mais tarde.';
  end if;

  select coalesce(sum((x ->> 'price')::numeric), 0)
    into v_products_price
    from jsonb_array_elements(coalesce(p_selected_products, '[]'::jsonb)) x;

  insert into public.bookings (
    customer_name, customer_phone, customer_email, service_name,
    service_price, duration_minutes, booking_date, start_time, notes,
    selected_products, products_price, status
  ) values (
    trim(p_customer_name), regexp_replace(p_customer_phone, '\D', '', 'g'),
    nullif(lower(trim(p_customer_email)), ''), p_service_name,
    p_service_price, p_duration_minutes, p_booking_date, p_start_time,
    nullif(trim(p_notes), ''), coalesce(p_selected_products, '[]'::jsonb),
    v_products_price, 'confirmed'
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.senha_digital_criar(
  p_nome text, p_telefone text, p_servico text, p_preco numeric, p_duracao integer
)
returns table(booking_id uuid, booking_date date, start_time time, end_time time, senha_numero integer, posicao integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_hoje date := v_agora::date;
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_existente uuid;
  v_inicio time;
  v_dur interval;
  v_close time;
  v_latest time;
  v_slot time;
  v_id uuid;
  v_num integer;
  v_pos integer;
  v_end time;
begin
  -- Dois QR ao mesmo tempo: o segundo espera e pega o horário seguinte, em vez de colidir.
  perform pg_advisory_xact_lock(hashtext('senha-digital'));

  -- Uma senha ativa por telefone por dia (anti-trote e anti-duplicidade).
  select b.id into v_existente
    from public.bookings b
   where b.booking_date = v_hoje
     and b.channel = 'porta'
     and b.status in ('pending', 'confirmed')
     and public.phone_match_key(b.customer_phone) = public.phone_match_key(v_tel)
   limit 1;
  if v_existente is not null then
    raise exception 'senha_existente:%', v_existente;
  end if;

  if p_duracao is null or p_duracao <= 0 then raise exception 'Duração do serviço inválida.'; end if;
  if extract(dow from v_hoje) in (0, 1)
     or exists (select 1 from public.schedule_blocks bl where bl.block_date = v_hoje and bl.all_day) then
    raise exception 'sem_horario';
  end if;

  -- Agora, arredondado para os próximos 5 min (11:20 → 11:20; 11:21 → 11:25); antes das 8h, 8h.
  v_inicio := (date_trunc('minute', v_agora)
               + make_interval(mins => (5 - extract(minute from v_agora)::integer % 5) % 5))::time;
  if v_inicio < time '08:00' then v_inicio := time '08:00'; end if;
  v_dur := make_interval(mins => p_duracao);
  select nominal_close, latest_end into v_close, v_latest from public.closing_rule(v_hoje);

  -- Candidatos: agora, o fim de cada atendimento/bloqueio de hoje e a grade de 5 em 5 dali pra frente.
  select c.s into v_slot
    from (
      select v_inicio as s
      union select b.end_time from public.bookings b
             where b.booking_date = v_hoje and b.status in ('pending', 'confirmed') and b.end_time > v_inicio
      union select bl.end_time from public.schedule_blocks bl
             where bl.block_date = v_hoje and not bl.all_day and bl.end_time is not null and bl.end_time > v_inicio
      union select (v_inicio + make_interval(mins => g))::time from generate_series(5, 720, 5) g
    ) c
   where c.s >= v_inicio
     and c.s <= v_close
     and c.s + v_dur <= v_latest
     and c.s + v_dur > c.s -- não atravessa a meia-noite
     and not exists (
       select 1 from public.schedule_blocks bl
        where bl.block_date = v_hoje
          and (bl.all_day or (c.s < bl.end_time and c.s + v_dur > bl.start_time)))
     and not exists (
       select 1 from public.bookings b
        where b.booking_date = v_hoje
          and b.status in ('pending', 'confirmed')
          and c.s < b.end_time and c.s + v_dur > b.start_time)
     and public.descanso_ok(v_hoje, c.s, p_duracao, null)
   order by c.s
   limit 1;
  if v_slot is null then
    raise exception 'sem_horario';
  end if;

  perform set_config('bdj.senha_porta', '1', true);
  v_id := public.create_public_booking_v15(
    p_nome, v_tel, null, p_servico, p_preco, p_duracao, v_hoje, v_slot,
    'Senha digital: chegou sem agendamento', '[]'::jsonb, 0
  );
  perform set_config('bdj.senha_porta', '', true);

  select coalesce(max(b.senha_numero), 0) + 1 into v_num
    from public.bookings b
   where b.booking_date = v_hoje and b.channel = 'porta';

  -- arrival_route_sent_at: a pessoa já está na barbearia, não precisa da rota do Maps.
  update public.bookings b
     set channel = 'porta', senha_numero = v_num, arrival_route_sent_at = now(), updated_at = now()
   where b.id = v_id
   returning b.end_time into v_end;

  select count(*)::integer into v_pos
    from public.bookings b
   where b.booking_date = v_hoje
     and b.id <> v_id
     and b.status in ('pending', 'confirmed')
     and b.start_time < v_slot
     and b.end_time > v_agora::time;

  return query select v_id, v_hoje, v_slot, v_end, v_num, v_pos;
end;
$function$;

revoke all on function public.senha_digital_criar(text, text, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.senha_digital_criar(text, text, text, numeric, integer) to service_role;

notify pgrst, 'reload schema';
