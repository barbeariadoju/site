-- v29.194.0 (16/09/2026) — Cliente de porta na cadeira = bloqueio automático da agenda.
--
-- Pedido do Juliano (16/09/2026): "eventualmente estou parado sem agendamento e chega alguém
-- da porta e entra, aí começo a atender, e neste momento existe o risco de alguém agendar um
-- serviço e vir pra barbearia (…) preciso que aconteça sem minha confirmação". Regras fechadas
-- com ele: cadeira ocupada há 2 minutos com 2 pessoas no quadro e nenhum agendamento cobrindo
-- o horário → bloqueio de 25 min criado na hora; enquanto a cadeira seguir ocupada o bloqueio
-- se estende (sempre 10 min livres à frente); ao esvaziar, encolhe pro fim real + 5 min; sem
-- sinal da câmera por 3 min, o bloqueio é liberado. Push só informa; "Liberar" no admin desfaz
-- e segura o robô por 90 min. Site e JuIA já respeitam schedule_blocks (get_available_slots).
--
-- Sinal: o contador da câmera (chair_counter.py, no notebook da barbearia) passa a mandar o
-- heartbeat a cada 30 s (era 5 min) e na troca de estado, com occupied/people — só contagem,
-- nunca vídeo ou rosto, como desde a v29.46.0.

-- 1) Histórico de estado da câmera (o heartbeat só guardava o último; o robô precisa de janela).
create table if not exists public.camera_state_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  device text not null default 'barbearia-notebook',
  occupied boolean not null,
  people integer not null default 0
);
create index if not exists camera_state_log_at_idx on public.camera_state_log (at desc);
alter table public.camera_state_log enable row level security;
drop policy if exists camera_state_log_admin_read on public.camera_state_log;
create policy camera_state_log_admin_read on public.camera_state_log for select to authenticated using (true);

-- 2) Origem do bloqueio: o robô só mexe nos dele.
alter table public.schedule_blocks add column if not exists source text not null default 'manual';

-- 3) Diário do robô (auditoria + supressão depois do "Liberar").
create table if not exists public.camera_walkin_guard_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  action text not null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists camera_walkin_guard_log_at_idx on public.camera_walkin_guard_log (at desc);
alter table public.camera_walkin_guard_log enable row level security;
drop policy if exists camera_walkin_guard_log_admin_read on public.camera_walkin_guard_log;
create policy camera_walkin_guard_log_admin_read on public.camera_walkin_guard_log for select to authenticated using (true);

-- "Liberar" no admin apaga o bloqueio; se foi do robô, ele fica quieto por 90 min (senão
-- recriaria no minuto seguinte com a cadeira ainda ocupada).
create or replace function public.camera_block_released()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.source = 'camera' then
    insert into camera_walkin_guard_log (action, details)
    values ('released_by_admin', jsonb_build_object('block_id', old.id, 'until', now() + interval '90 minutes', 'block_end', old.end_time));
  end if;
  return old;
end $$;
drop trigger if exists trg_camera_block_released on public.schedule_blocks;
create trigger trg_camera_block_released before delete on public.schedule_blocks
  for each row execute function public.camera_block_released();

-- 4) camera_ingest: heartbeat com occupied/people também alimenta o histórico; retenção de 2 dias.
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

-- 5) O robô. Roda a cada minuto (cron → function camera-walkin-guard → esta RPC).
-- p_dry_run = true só diz o que faria, sem gravar nada (usado no teste de publicação).
create or replace function public.camera_walkin_guard(p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_now timestamp := timezone('America/Sao_Paulo', now());
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_time time := (timezone('America/Sao_Paulo', now()))::time;
  v_close time; v_latest time;
  v_last_at timestamptz;
  v_block record;
  v_tot int; v_occ int; v_people int; v_last_occupied boolean; v_recent_empty boolean;
  v_ocupada boolean;
  v_new_end time;
  v_block_id uuid;
  v_next record;
  v_result jsonb;
begin
  select nominal_close, latest_end into v_close, v_latest from public.closing_rule(v_today);
  if extract(dow from v_today) in (0, 1) or v_time < time '07:45' or v_time > v_latest then
    return jsonb_build_object('action', 'fora_do_horario');
  end if;

  select max(at) into v_last_at from camera_state_log;
  select * into v_block from schedule_blocks
    where source = 'camera' and block_date = v_today and not all_day and end_time > v_time
    order by created_at desc limit 1;

  -- Sem sinal da câmera há 3 min: nunca deixa bloqueio fantasma.
  if v_last_at is null or v_last_at < now() - interval '3 minutes' then
    if v_block.id is not null then
      if not p_dry_run then
        update schedule_blocks set end_time = greatest(start_time, v_time) where id = v_block.id;
        insert into camera_walkin_guard_log (action, details) values ('liberado_sem_sinal', jsonb_build_object('block_id', v_block.id, 'last_signal', v_last_at));
      end if;
      return jsonb_build_object('action', 'liberado_sem_sinal', 'block_id', v_block.id);
    end if;
    return jsonb_build_object('action', 'sem_sinal', 'last_signal', v_last_at);
  end if;

  -- Janela de 2 min: ocupada em pelo menos 75% das amostras (mínimo 3), última amostra ocupada,
  -- e 2 pessoas no quadro em algum momento (o Juliano sentado sozinho não conta).
  select count(*), count(*) filter (where occupied), coalesce(max(people), 0)
    into v_tot, v_occ, v_people
    from camera_state_log where at > now() - interval '2 minutes';
  select occupied into v_last_occupied from camera_state_log order by at desc limit 1;
  select not exists (select 1 from camera_state_log where at > now() - interval '60 seconds' and occupied)
     and exists (select 1 from camera_state_log where at > now() - interval '60 seconds')
    into v_recent_empty;
  v_ocupada := v_tot >= 3 and v_occ * 4 >= v_tot * 3 and coalesce(v_last_occupied, false) and v_people >= 2;

  if v_block.id is not null then
    if coalesce(v_last_occupied, false) then
      -- estende: sempre 10 min livres à frente, em passos de 5, nunca além do fim estendido do dia
      v_new_end := least(v_latest, (date_trunc('hour', v_now + interval '10 minutes')
                   + make_interval(mins => 5 * ceil(extract(minute from v_now + interval '10 minutes') / 5.0)::int))::time);
      if v_new_end > v_block.end_time then
        if not p_dry_run then
          update schedule_blocks set end_time = v_new_end where id = v_block.id;
          insert into camera_walkin_guard_log (action, details) values ('estendido', jsonb_build_object('block_id', v_block.id, 'until', v_new_end));
        end if;
        return jsonb_build_object('action', 'estendido', 'block_id', v_block.id, 'until', v_new_end);
      end if;
      return jsonb_build_object('action', 'mantido', 'block_id', v_block.id, 'until', v_block.end_time);
    elsif v_recent_empty then
      -- cadeira vazia há 1 min: encolhe pro agora + 5 (cobrar e despedir)
      v_new_end := least(v_block.end_time, (v_now + interval '5 minutes')::time);
      if v_new_end < v_block.end_time then
        if not p_dry_run then
          update schedule_blocks set end_time = greatest(start_time, v_new_end) where id = v_block.id;
          insert into camera_walkin_guard_log (action, details) values ('encolhido', jsonb_build_object('block_id', v_block.id, 'until', v_new_end));
        end if;
        return jsonb_build_object('action', 'encolhido', 'block_id', v_block.id, 'until', v_new_end);
      end if;
      return jsonb_build_object('action', 'mantido', 'block_id', v_block.id, 'until', v_block.end_time);
    end if;
    return jsonb_build_object('action', 'mantido', 'block_id', v_block.id, 'until', v_block.end_time);
  end if;

  if not v_ocupada then
    return jsonb_build_object('action', 'nada', 'amostras', v_tot, 'ocupadas', v_occ, 'pessoas', v_people);
  end if;

  -- Agendamento cobrindo agora (10 min de tolerância pra quem chega cedo) = é o cliente marcado.
  if exists (
    select 1 from bookings b
     where b.booking_date = v_today and b.status in ('pending', 'confirmed')
       and b.start_time - interval '10 minutes' <= v_time and b.end_time >= v_time
  ) then
    return jsonb_build_object('action', 'atendimento_marcado');
  end if;

  -- Juliano liberou um bloqueio do robô há pouco: fica quieto.
  if exists (
    select 1 from camera_walkin_guard_log g
     where g.action = 'released_by_admin' and (g.details->>'until')::timestamptz > now()
  ) then
    return jsonb_build_object('action', 'suprimido');
  end if;

  -- Perto demais do fim do dia não vale a pena.
  if v_time + interval '5 minutes' >= v_latest then
    return jsonb_build_object('action', 'fim_do_dia');
  end if;

  select b.customer_name, b.start_time into v_next from bookings b
   where b.booking_date = v_today and b.status in ('pending', 'confirmed') and b.start_time > v_time
   order by b.start_time limit 1;

  v_new_end := least(v_latest, (v_now + interval '25 minutes')::time);
  if p_dry_run then
    return jsonb_build_object('action', 'criaria', 'from', date_trunc('minute', v_now)::time, 'until', v_new_end,
      'next_name', v_next.customer_name, 'next_time', v_next.start_time);
  end if;
  insert into schedule_blocks (block_date, all_day, start_time, end_time, reason, source)
  values (v_today, false, date_trunc('minute', v_now)::time, v_new_end, 'Atendimento sem hora marcada (câmera)', 'camera')
  returning id into v_block_id;
  v_result := jsonb_build_object('action', 'criado', 'block_id', v_block_id, 'from', date_trunc('minute', v_now)::time, 'until', v_new_end,
    'next_name', v_next.customer_name, 'next_time', v_next.start_time);
  insert into camera_walkin_guard_log (action, details) values ('criado', v_result);
  return v_result;
end $$;
revoke all on function public.camera_walkin_guard(boolean) from public;
grant execute on function public.camera_walkin_guard(boolean) to service_role;

-- 6) Cron a cada minuto (criado direto no banco em 16/09/2026, jobid 29 — registrado aqui pra
-- ficar versionado). Bearer anon + x-webhook-secret do Vault, igual ao bdj-tuya-watch.
-- select cron.schedule('bdj-camera-walkin-guard', '* * * * *', $cmd$
--   select net.http_post(
--     url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/camera-walkin-guard',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer <chave anon>',
--       'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
--     body := '{}'::jsonb, timeout_milliseconds := 15000);
-- $cmd$);
