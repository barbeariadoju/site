-- v29.48.0 (19/08/2026) — Monitor do alarme EKASA/Tuya (central Barbearia; Pastrana e Itararé quando migrarem)
-- Function tuya-watch (cron 10 min) lê a nuvem Tuya (shadow + logs) e grava aqui. Alertas: central offline,
-- sensor sem prova de vida, bateria fraca no registro, alarme disparado.

create table if not exists public.alarm_hubs (
  device_id text primary key,
  name text not null,
  online boolean,
  mode text,                     -- 'armado' | 'casa' | 'desarmado' | valor bruto
  alarm_on boolean,
  rssi integer,
  last_sensor_event text,
  last_sensor_event_at timestamptz,
  last_action text,
  last_action_at timestamptz,
  sensors jsonb not null default '[]'::jsonb,   -- [{idx,mode,name,last_event_at}]
  raw jsonb,
  last_seen_at timestamptz,
  offline_since timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.alarm_events (
  id bigserial primary key,
  device_id text not null references public.alarm_hubs(device_id) on delete cascade,
  event_at timestamptz not null,
  kind text not null,            -- 'sensor' | 'action' | 'online' | 'offline' | 'alarm' | 'mode'
  sensor_name text,
  text text,
  created_at timestamptz not null default now(),
  unique (device_id, event_at, kind, text)
);
create index if not exists alarm_events_dev_time on public.alarm_events (device_id, event_at desc);

create table if not exists public.alarm_alerts (
  id bigserial primary key,
  device_id text not null,
  kind text not null,            -- 'offline' | 'sensor_silent' | 'low_battery' | 'alarm' | 'armed_out_of_hours'
  subject text,                  -- nome do sensor, quando houver
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (device_id, kind, subject, resolved_at)
);

alter table public.alarm_hubs enable row level security;
alter table public.alarm_events enable row level security;
alter table public.alarm_alerts enable row level security;
drop policy if exists alarm_hubs_admin_read on public.alarm_hubs;
create policy alarm_hubs_admin_read on public.alarm_hubs for select to authenticated using (true);
drop policy if exists alarm_events_admin_read on public.alarm_events;
create policy alarm_events_admin_read on public.alarm_events for select to authenticated using (true);
drop policy if exists alarm_alerts_admin_read on public.alarm_alerts;
create policy alarm_alerts_admin_read on public.alarm_alerts for select to authenticated using (true);

create or replace function public.alarm_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hubs', (select coalesce(jsonb_agg(jsonb_build_object(
        'device_id', h.device_id, 'name', h.name, 'online', h.online, 'mode', h.mode, 'alarm_on', h.alarm_on,
        'last_seen_at', h.last_seen_at, 'last_sensor_event', h.last_sensor_event, 'last_sensor_event_at', h.last_sensor_event_at,
        'sensors', h.sensors, 'offline_since', h.offline_since) order by h.name), '[]'::jsonb) from alarm_hubs h),
    'open_alerts', (select coalesce(jsonb_agg(jsonb_build_object('device_id', a.device_id, 'kind', a.kind, 'subject', a.subject, 'message', a.message, 'created_at', a.created_at) order by a.created_at desc), '[]'::jsonb)
                    from alarm_alerts a where a.resolved_at is null)
  );
$$;
grant execute on function public.alarm_summary() to authenticated, service_role;

select cron.unschedule(jobname) from cron.job where jobname = 'bdj-tuya-watch';
select cron.schedule(
  'bdj-tuya-watch',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/tuya-watch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa3FsdWF4aHFzeG5ld3VuaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Mjk0NzQsImV4cCI6MjA5OTQwNTQ3NH0.E1ObOSpxrzCBO_4WzAv_Dh2A5d2XofzpImS3U4XxyWY',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa3FsdWF4aHFzeG5ld3VuaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Mjk0NzQsImV4cCI6MjA5OTQwNTQ3NH0.E1ObOSpxrzCBO_4WzAv_Dh2A5d2XofzpImS3U4XxyWY',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- v29.48.1 — GRANTs (bug recorrente: tabela nova sem grant pro service_role → 42501 na function)
grant select, insert, update, delete on public.alarm_hubs, public.alarm_events, public.alarm_alerts to service_role;
grant usage, select on sequence public.alarm_events_id_seq, public.alarm_alerts_id_seq to service_role;
grant select on public.alarm_hubs, public.alarm_events, public.alarm_alerts to authenticated;
grant select, insert, update on public.chair_sessions, public.camera_heartbeat to service_role;
grant select on public.chair_sessions, public.camera_heartbeat to authenticated;

-- v29.48.2 — prova de vida DIÁRIA por dias de funcionamento (pedido do Juliano: 8 dias é muito)
alter table public.alarm_hubs add column if not exists open_days integer[] not null default '{2,3,4,5,6}';
alter table public.alarm_hubs add column if not exists created_at timestamptz not null default now();
