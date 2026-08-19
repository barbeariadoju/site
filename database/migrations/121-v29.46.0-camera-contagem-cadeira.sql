-- v29.46.0 (19/08/2026) — Câmera IP: contagem de sessões na cadeira
-- Contador roda no notebook da barbearia (C:\Users\julia\barbearia-camera\chair_counter.py),
-- lê o RTSP da câmera (192.168.15.5), detecta pessoa na zona da cadeira e grava aqui.
-- Só horários e contagem — NUNCA vídeo, frame ou rosto. Autenticação: segredo no Vault
-- ('camera_ingest_secret') conferido dentro da RPC, chamada com a chave anon.

create table if not exists public.chair_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer generated always as (case when ended_at is null then null else extract(epoch from (ended_at - started_at))::int end) stored,
  samples_occupied integer not null default 0,
  samples_total integer not null default 0,
  device text not null default 'barbearia-notebook',
  status text not null default 'open' check (status in ('open','closed','discarded')),
  matched_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chair_sessions_started_idx on public.chair_sessions (started_at desc);

create table if not exists public.camera_heartbeat (
  device text primary key,
  last_seen_at timestamptz not null default now(),
  fps numeric,
  note text
);

alter table public.chair_sessions enable row level security;
alter table public.camera_heartbeat enable row level security;
drop policy if exists chair_sessions_admin_read on public.chair_sessions;
create policy chair_sessions_admin_read on public.chair_sessions for select to authenticated using (true);
drop policy if exists camera_heartbeat_admin_read on public.camera_heartbeat;
create policy camera_heartbeat_admin_read on public.camera_heartbeat for select to authenticated using (true);

-- Ingestão: {type:'open'|'update'|'close'|'heartbeat', session_id, started_at, ended_at, samples_occupied, samples_total, device, fps}
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

-- Resumo do dia pro admin: sessões da câmera x atendimentos concluídos
create or replace function public.chair_day_summary(p_date date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'date', p_date,
    'chair_sessions', (select count(*) from chair_sessions s where s.status='closed' and (s.started_at at time zone 'America/Sao_Paulo')::date = p_date),
    'chair_open', (select count(*) from chair_sessions s where s.status='open' and (s.started_at at time zone 'America/Sao_Paulo')::date = p_date),
    'bookings_completed', (select count(*) from bookings b where b.status='completed' and b.booking_date = p_date),
    'camera_last_seen', (select max(last_seen_at) from camera_heartbeat),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('started_at', s.started_at, 'ended_at', s.ended_at, 'minutes', round(s.duration_seconds/60.0,1), 'status', s.status) order by s.started_at), '[]'::jsonb)
                 from chair_sessions s where (s.started_at at time zone 'America/Sao_Paulo')::date = p_date and s.status <> 'discarded')
  );
$$;
grant execute on function public.chair_day_summary(date) to authenticated, service_role;
