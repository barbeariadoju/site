-- v29.242.0 (26/09/2026) — Abrir / Fechar a barbearia (expediente do dia).
--
-- Pedido do Juliano: "quando clicarmos abrir, a gente registra a hora que eu comecei a
-- trabalhar, e fechar a hora que eu parei; em dias que eu for embora mais cedo, ao fechar
-- tranca automaticamente a agenda".
--
-- 1) expediente: uma linha por dia (abriu/fechou quando, por quem, motivo, bloqueio criado).
-- 2) expediente_abrir / expediente_fechar / expediente_pendentes (painel, is_admin).
--    Fechar cria um schedule_blocks source='fechamento' de agora até o fim do dia: site,
--    JuIA e Senha Digital param de oferecer horário na mesma hora. Reabrir apaga o bloqueio.
-- 3) expediente_hoje(): leitura pública (anon) — /senha/ e a JuIA dizem "fechou hoje às 17h".
-- 4) expediente_lembrete_abrir / expediente_fechar_automatico (service_role) + cron
--    bdj-expediente a cada 15 min (8h–21h): lembra de abrir às 8h15 se há cliente marcado e
--    fecha sozinho 30 min depois do fim do expediente se ninguém clicou — dado marcado
--    'automatico', nunca vazio.

create table if not exists public.expediente (
  dia date primary key,
  aberto_em timestamptz,
  aberto_por text,            -- 'painel' | 'automatico'
  fechado_em timestamptz,
  fechado_por text,           -- 'painel' | 'automatico'
  motivo text,
  observacao text,
  bloqueio_id uuid,
  lembrete_abrir_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expediente enable row level security;
drop policy if exists "expediente admin" on public.expediente;
create policy "expediente admin" on public.expediente
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.expediente to authenticated;
grant all on public.expediente to service_role;

-- Horário local de Brasília como timestamp sem fuso (mesmo truque das outras funções).
create or replace function public.expediente_hoje()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select jsonb_build_object(
      'dia', e.dia,
      'aberto_em', e.aberto_em,
      'fechado_em', e.fechado_em,
      'aberto_por', e.aberto_por,
      'fechado_por', e.fechado_por,
      'motivo', e.motivo,
      'aberta', (e.aberto_em is not null and e.fechado_em is null)
    )
    from public.expediente e
    where e.dia = (timezone('America/Sao_Paulo', now()))::date
  ), jsonb_build_object('dia', (timezone('America/Sao_Paulo', now()))::date, 'aberta', false));
$$;
revoke all on function public.expediente_hoje() from public;
grant execute on function public.expediente_hoje() to anon, authenticated, service_role;

create or replace function public.expediente_pendentes()
returns table(id uuid, customer_name text, customer_phone text, start_time time, end_time time, service_name text, status text, channel text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.customer_name, b.customer_phone, b.start_time, b.end_time, b.service_name, b.status, b.channel
  from public.bookings b
  where public.is_admin()
    and b.booking_date = (timezone('America/Sao_Paulo', now()))::date
    and b.status in ('pending', 'confirmed')
    and b.end_time > (timezone('America/Sao_Paulo', now()))::time
  order by b.start_time;
$$;
revoke all on function public.expediente_pendentes() from public;
grant execute on function public.expediente_pendentes() to authenticated, service_role;

create or replace function public.expediente_abrir(p_observacao text default null)
returns public.expediente
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hoje date := (timezone('America/Sao_Paulo', now()))::date;
  v_row public.expediente;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;

  insert into public.expediente (dia, aberto_em, aberto_por, observacao)
  values (v_hoje, now(), 'painel', nullif(trim(p_observacao), ''))
  on conflict (dia) do update
    set aberto_em = coalesce(public.expediente.aberto_em, now()),
        aberto_por = coalesce(public.expediente.aberto_por, 'painel'),
        observacao = coalesce(nullif(trim(p_observacao), ''), public.expediente.observacao),
        updated_at = now()
  returning * into v_row;

  -- Reabrir depois de um fechamento mais cedo: some o bloqueio, volta a receber horário.
  if v_row.fechado_em is not null then
    delete from public.schedule_blocks s where s.id = v_row.bloqueio_id and s.source = 'fechamento';
    update public.expediente
       set fechado_em = null, fechado_por = null, motivo = null, bloqueio_id = null, updated_at = now()
     where dia = v_hoje
     returning * into v_row;
  end if;

  return v_row;
end;
$$;
revoke all on function public.expediente_abrir(text) from public;
grant execute on function public.expediente_abrir(text) to authenticated, service_role;

create or replace function public.expediente_fechar(p_motivo text default null)
returns public.expediente
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_hoje date := v_agora::date;
  v_hora time := date_trunc('minute', v_agora)::time;
  v_latest time;
  v_bloqueio uuid;
  v_primeiro time;
  v_row public.expediente;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;

  select latest_end into v_latest from public.closing_rule(v_hoje);

  -- Tranca a agenda de agora até o fim do dia (só se ainda há expediente pela frente).
  if v_hora < v_latest then
    insert into public.schedule_blocks (block_date, all_day, start_time, end_time, reason, source)
    values (v_hoje, false, v_hora, time '23:59', 'Barbearia fechada às ' || to_char(v_hora, 'HH24:MI') || coalesce(' — ' || nullif(trim(p_motivo), ''), ''), 'fechamento')
    returning id into v_bloqueio;
  end if;

  -- Abertura nunca fica vazia: se ninguém clicou em Abrir, vale o primeiro atendimento do dia.
  select min(b.start_time) into v_primeiro
    from public.bookings b
   where b.booking_date = v_hoje and b.status = 'completed';

  insert into public.expediente (dia, aberto_em, aberto_por, fechado_em, fechado_por, motivo, bloqueio_id)
  values (v_hoje,
          coalesce((v_hoje + v_primeiro) at time zone 'America/Sao_Paulo', now()),
          'automatico', now(), 'painel', nullif(trim(p_motivo), ''), v_bloqueio)
  on conflict (dia) do update
    set aberto_em = coalesce(public.expediente.aberto_em, excluded.aberto_em),
        aberto_por = coalesce(public.expediente.aberto_por, excluded.aberto_por),
        fechado_em = now(),
        fechado_por = 'painel',
        motivo = excluded.motivo,
        bloqueio_id = coalesce(excluded.bloqueio_id, public.expediente.bloqueio_id),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.expediente_fechar(text) from public;
grant execute on function public.expediente_fechar(text) to authenticated, service_role;

-- Lembrete de abrir: uma vez por dia, entre 8h15 e 8h59, terça a sábado, se há cliente marcado
-- e ninguém abriu. Devolve true quando o cron deve mandar o push (e já marca que mandou).
create or replace function public.expediente_lembrete_abrir()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_hoje date := v_agora::date;
  v_row public.expediente;
begin
  if extract(dow from v_hoje) in (0, 1) then return false; end if;
  if v_agora::time < time '08:15' or v_agora::time >= time '09:00' then return false; end if;
  select * into v_row from public.expediente where dia = v_hoje;
  if v_row.aberto_em is not null or v_row.lembrete_abrir_em is not null then return false; end if;
  if not exists (select 1 from public.bookings b where b.booking_date = v_hoje and b.status in ('pending', 'confirmed')) then return false; end if;

  insert into public.expediente (dia, lembrete_abrir_em) values (v_hoje, now())
  on conflict (dia) do update set lembrete_abrir_em = now(), updated_at = now();
  return true;
end;
$$;
revoke all on function public.expediente_lembrete_abrir() from public;
grant execute on function public.expediente_lembrete_abrir() to service_role;

-- Fechamento automático: 30 min depois do fim do expediente, se ninguém clicou em Fechar.
-- Dia sem abertura e sem atendimento concluído não vira registro (foi folga).
create or replace function public.expediente_fechar_automatico()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
  v_hoje date := v_agora::date;
  v_latest time;
  v_row public.expediente;
  v_primeiro time;
  v_ultimo time;
begin
  if extract(dow from v_hoje) in (0, 1) then return 0; end if;
  select latest_end into v_latest from public.closing_rule(v_hoje);
  if v_agora::time < v_latest + interval '30 minutes' then return 0; end if;

  select * into v_row from public.expediente where dia = v_hoje;
  if v_row.fechado_em is not null then return 0; end if;

  select min(b.start_time), max(b.end_time) into v_primeiro, v_ultimo
    from public.bookings b
   where b.booking_date = v_hoje and b.status = 'completed';
  if v_row.aberto_em is null and v_primeiro is null then return 0; end if;

  insert into public.expediente (dia, aberto_em, aberto_por, fechado_em, fechado_por)
  values (v_hoje,
          coalesce(v_row.aberto_em, (v_hoje + coalesce(v_primeiro, time '08:00')) at time zone 'America/Sao_Paulo'),
          coalesce(v_row.aberto_por, 'automatico'),
          greatest(coalesce(v_row.aberto_em, (v_hoje + coalesce(v_primeiro, time '08:00')) at time zone 'America/Sao_Paulo'),
                   (v_hoje + coalesce(v_ultimo, v_latest)) at time zone 'America/Sao_Paulo'),
          'automatico')
  on conflict (dia) do update
    set aberto_em = excluded.aberto_em,
        aberto_por = excluded.aberto_por,
        fechado_em = excluded.fechado_em,
        fechado_por = excluded.fechado_por,
        updated_at = now();
  return 1;
end;
$$;
revoke all on function public.expediente_fechar_automatico() from public;
grant execute on function public.expediente_fechar_automatico() to service_role;

select cron.unschedule('bdj-expediente') where exists (select 1 from cron.job where jobname = 'bdj-expediente');
select cron.schedule('bdj-expediente', '*/15 * * * *', $cron$
  select case when extract(hour from (now() at time zone 'America/Sao_Paulo')) between 8 and 21 then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/expediente-dia',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb
  )) end;
$cron$);

notify pgrst, 'reload schema';
