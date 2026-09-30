-- v29.265.0 (30/09/2026) — Expediente: ajuste manual do horário + abertura/fechamento pela câmera.
--
-- Pedido do Juliano (30/09): "hoje lembrei de abrir a barbearia no sistema 10:03, porém eu estava
-- aqui desde 8:50 [...] ontem eu fechei 20h mas não fechei no app". Duas coisas:
--
-- 1) expediente_ajustar(dia, abriu, fechou): corrige o horário à mão (tela Hoje e Histórico).
--    Marca aberto_por/fechado_por = 'ajuste'. Não mexe no bloqueio da agenda: fechar/reabrir
--    continuam sendo os botões. fechou = null mantém o que está (dia ainda aberto segue aberto).
--
-- 2) A câmera da cadeira já manda, a cada 30 s, quantas PESSOAS vê no quadro inteiro
--    (camera_state_log.people, migração 155). Isso vira expediente:
--    - ABRIR: primeira presença confirmada do dia (2 leituras com gente em até 3 min — uma
--      leitura solta pode ser falso positivo do detector) abre o dia com aberto_por='camera',
--      no horário da PRIMEIRA leitura. Roda dentro do camera_ingest, então o painel já mostra
--      "Aberta desde 8h52" logo que ele chega. Só ter–sáb, 6h até o fim do expediente, dia sem
--      bloqueio de dia inteiro, e NUNCA sobre um dia que já tem abertura (o clique vale) nem
--      reabre um dia fechado (quem aparece depois de fechar é a limpeza, não expediente).
--    - FECHAR: o expediente_fechar_automatico passa a esperar a câmera ficar 30 min sem ver
--      ninguém e fecha no horário da ÚLTIMA pessoa vista (fechado_por='camera'). Sem câmera
--      (notebook desligado, contador parado), cai na regra antiga: fim do último atendimento.
--      E pega o dia anterior que ficou aberto (ficou depois das 21h45, quando o cron já parou).
--
-- Limite conhecido: a câmera só enxerga depois que o notebook liga. Em 30/09 ele chegou 8h50 e
-- o contador subiu às 9h00 (primeira pessoa às 9h03). O ajuste manual cobre essa diferença.

-- ── 1) Ajuste manual ─────────────────────────────────────────────────────────────────────────
create or replace function public.expediente_ajustar(p_dia date, p_aberto time, p_fechado time default null)
returns public.expediente
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_ab timestamptz := (p_dia + p_aberto) at time zone 'America/Sao_Paulo';
  v_fe timestamptz := case when p_fechado is null then null else (p_dia + p_fechado) at time zone 'America/Sao_Paulo' end;
  v_row public.expediente;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if p_dia is null or p_aberto is null then raise exception 'Informe o dia e o horário de abertura.'; end if;
  if p_dia > v_agora::date then raise exception 'Não dá para ajustar um dia que ainda não chegou.'; end if;
  if p_dia < v_agora::date - 60 then raise exception 'Só dá para ajustar os últimos 60 dias.'; end if;
  if (p_dia + p_aberto) > v_agora + interval '5 minutes' then raise exception 'A abertura não pode ficar no futuro.'; end if;
  if p_fechado is not null and (p_dia + p_fechado) > v_agora + interval '5 minutes' then raise exception 'O fechamento não pode ficar no futuro.'; end if;

  select * into v_row from public.expediente where dia = p_dia;
  if p_fechado is null and v_row.fechado_em is not null and v_row.fechado_em <= v_ab then
    raise exception 'A abertura tem que ser antes do fechamento (%).', to_char(v_row.fechado_em at time zone 'America/Sao_Paulo', 'HH24:MI');
  end if;
  if v_fe is not null and v_fe <= v_ab then raise exception 'O fechamento tem que ser depois da abertura.'; end if;

  insert into public.expediente (dia, aberto_em, aberto_por, fechado_em, fechado_por)
  values (p_dia, v_ab, 'ajuste', v_fe, case when v_fe is null then null else 'ajuste' end)
  on conflict (dia) do update
    set aberto_por = case when public.expediente.aberto_em is distinct from excluded.aberto_em then 'ajuste' else public.expediente.aberto_por end,
        aberto_em = excluded.aberto_em,
        fechado_por = case when excluded.fechado_em is null then public.expediente.fechado_por
                           when public.expediente.fechado_em is distinct from excluded.fechado_em then 'ajuste'
                           else public.expediente.fechado_por end,
        fechado_em = coalesce(excluded.fechado_em, public.expediente.fechado_em),
        updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.expediente_ajustar(date, time, time) from public;
grant execute on function public.expediente_ajustar(date, time, time) to authenticated, service_role;

-- ── 2a) Presença pela câmera ─────────────────────────────────────────────────────────────────
-- Primeira presença confirmada do dia (2 leituras com gente em até 3 min) e última pessoa vista.
create or replace function public.camera_presenca_dia(p_dia date)
returns table(primeira timestamptz, ultima timestamptz, ultimo_sinal timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  with dia as (
    select l.at, l.people
      from public.camera_state_log l
     where l.at >= (p_dia + time '00:00') at time zone 'America/Sao_Paulo'
       and l.at <  (p_dia + 1 + time '00:00') at time zone 'America/Sao_Paulo'
  ), gente as (
    select at, lead(at) over (order by at) as prox from dia where people > 0
  )
  select (select min(at) from gente where prox is not null and prox <= at + interval '3 minutes'
            and at >= (p_dia + time '06:00') at time zone 'America/Sao_Paulo'),
         (select max(at) from gente),
         (select max(at) from dia);
$$;
revoke all on function public.camera_presenca_dia(date) from public;
grant execute on function public.camera_presenca_dia(date) to service_role;

-- Abre o dia pela câmera, se couber. Devolve true quando abriu agora.
create or replace function public.expediente_abrir_pela_camera()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_hoje date := v_agora::date;
  v_latest time;
  v_row public.expediente;
  v_primeira timestamptz;
begin
  if extract(dow from v_hoje) in (0, 1) then return false; end if;
  select latest_end into v_latest from public.closing_rule(v_hoje);
  if v_agora::time < time '06:00' or v_agora::time >= coalesce(v_latest, time '20:00') then return false; end if;
  select * into v_row from public.expediente where dia = v_hoje;
  if v_row.aberto_em is not null or v_row.fechado_em is not null then return false; end if;
  if exists (select 1 from public.schedule_blocks s where s.block_date = v_hoje and s.all_day) then return false; end if;

  select p.primeira into v_primeira from public.camera_presenca_dia(v_hoje) p;
  if v_primeira is null then return false; end if;

  insert into public.expediente (dia, aberto_em, aberto_por)
  values (v_hoje, v_primeira, 'camera')
  on conflict (dia) do update
    set aberto_em = excluded.aberto_em, aberto_por = 'camera', updated_at = now()
    where public.expediente.aberto_em is null and public.expediente.fechado_em is null;
  return found;
end;
$$;
revoke all on function public.expediente_abrir_pela_camera() from public;
grant execute on function public.expediente_abrir_pela_camera() to service_role;

-- camera_ingest: igual à versão da migração 155, mais a abertura pela câmera quando chega gente.
-- A abertura fica num bloco protegido: erro nela nunca derruba a ingestão da câmera.
create or replace function public.camera_ingest(p_secret text, p_event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_secret text; v_id uuid; v_type text := coalesce(p_event->>'type','');
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'camera_ingest_secret' limit 1;
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'camera_ingest: não autorizado' using errcode = '42501';
  end if;
  if v_type = 'heartbeat' then
    insert into camera_heartbeat (device, last_seen_at, fps, note)
    values (coalesce(p_event->>'device','barbearia-notebook'), now(), nullif(p_event->>'fps','')::numeric, p_event->>'note')
    on conflict (device) do update set last_seen_at = now(), fps = excluded.fps, note = excluded.note;
    if p_event ? 'occupied' then
      insert into camera_state_log (device, occupied, people)
      values (coalesce(p_event->>'device','barbearia-notebook'), (p_event->>'occupied')::boolean, coalesce((p_event->>'people')::int, 0));
      delete from camera_state_log where at < now() - interval '2 days';
      if coalesce((p_event->>'people')::int, 0) > 0 then
        begin
          perform public.expediente_abrir_pela_camera();
        exception when others then
          raise warning 'camera_ingest: abertura pela câmera falhou: %', sqlerrm;
        end;
      end if;
    end if;
    return jsonb_build_object('ok', true);
  end if;
  v_id := nullif(p_event->>'session_id','')::uuid;
  if v_type = 'open' then
    insert into chair_sessions (id, started_at, samples_occupied, samples_total, device, status)
    values (coalesce(v_id, gen_random_uuid()), (p_event->>'started_at')::timestamptz,
            coalesce((p_event->>'samples_occupied')::int,0), coalesce((p_event->>'samples_total')::int,0),
            coalesce(p_event->>'device','barbearia-notebook'), 'open')
    on conflict (id) do nothing
    returning id into v_id;
    return jsonb_build_object('ok', true, 'session_id', v_id);
  elsif v_type in ('update','close','discard') then
    update chair_sessions set
      ended_at = coalesce((p_event->>'ended_at')::timestamptz, ended_at),
      samples_occupied = coalesce((p_event->>'samples_occupied')::int, samples_occupied),
      samples_total = coalesce((p_event->>'samples_total')::int, samples_total),
      status = case v_type when 'close' then 'closed' when 'discard' then 'discarded' else status end,
      updated_at = now()
    where id = v_id;
    return jsonb_build_object('ok', true, 'session_id', v_id);
  end if;
  raise exception 'camera_ingest: tipo desconhecido %', v_type;
end $$;
revoke all on function public.camera_ingest(text, jsonb) from public;
grant execute on function public.camera_ingest(text, jsonb) to anon, authenticated, service_role;

-- ── 2b) Fechamento automático olhando a câmera ───────────────────────────────────────────────
-- Devolve quantos dias fechou. Hoje: só depois do fim do expediente + 30 min e com a câmera 30 min
-- sem ver ninguém (ou sem sinal). Dias anteriores (até 3) que ficaram abertos: fecha direto.
create or replace function public.expediente_fechar_automatico()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_hoje date := v_agora::date;
  v_dia date;
  v_latest time;
  v_row public.expediente;
  v_primeiro time;
  v_ultimo time;
  v_cam record;
  v_aberto timestamptz;
  v_fechado timestamptz;
  v_por text;
  v_n integer := 0;
begin
  for v_dia in select d::date from generate_series(v_hoje - 3, v_hoje, interval '1 day') d loop
    select * into v_row from public.expediente where dia = v_dia;
    if v_row.fechado_em is not null then continue; end if;

    if v_dia = v_hoje then
      if extract(dow from v_hoje) in (0, 1) then continue; end if;
      select latest_end into v_latest from public.closing_rule(v_hoje);
      if v_agora::time < v_latest + interval '30 minutes' then continue; end if;
    else
      -- Dia anterior só entra se ficou aberto (tem linha com abertura); folga não vira registro.
      if v_row.aberto_em is null then continue; end if;
      select latest_end into v_latest from public.closing_rule(v_dia);
    end if;

    select min(b.start_time), max(b.end_time) into v_primeiro, v_ultimo
      from public.bookings b
     where b.booking_date = v_dia and b.status = 'completed';
    if v_row.aberto_em is null and v_primeiro is null then continue; end if;

    select * into v_cam from public.camera_presenca_dia(v_dia);
    -- Hoje, com a câmera no ar e gente vista há menos de 30 min: ainda tem alguém lá, espera.
    if v_dia = v_hoje and v_cam.ultima is not null and v_cam.ultimo_sinal > now() - interval '20 minutes'
       and v_cam.ultima > now() - interval '30 minutes' then
      continue;
    end if;

    v_aberto := coalesce(v_row.aberto_em, v_cam.primeira, (v_dia + coalesce(v_primeiro, time '08:00')) at time zone 'America/Sao_Paulo');
    if v_cam.ultima is not null and v_cam.ultima > v_aberto then
      v_fechado := v_cam.ultima; v_por := 'camera';
    else
      v_fechado := greatest(v_aberto, (v_dia + coalesce(v_ultimo, v_latest)) at time zone 'America/Sao_Paulo'); v_por := 'automatico';
    end if;

    insert into public.expediente (dia, aberto_em, aberto_por, fechado_em, fechado_por)
    values (v_dia, v_aberto,
            coalesce(v_row.aberto_por, case when v_cam.primeira is not null and v_row.aberto_em is null then 'camera' else 'automatico' end),
            v_fechado, v_por)
    on conflict (dia) do update
      set aberto_em = excluded.aberto_em,
          aberto_por = excluded.aberto_por,
          fechado_em = excluded.fechado_em,
          fechado_por = excluded.fechado_por,
          updated_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.expediente_fechar_automatico() from public;
grant execute on function public.expediente_fechar_automatico() to service_role;

notify pgrst, 'reload schema';
