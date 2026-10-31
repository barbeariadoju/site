-- v29.330.0 — pedido do Juliano (31/10/2026): "a regra dos 4 atendimentos pode excluir, deixa lotar, eu tô mais rápido,
-- consigo descansar uns minutinhos entre um atendimento e outro — quero lotar esta agenda". E: "do Lucas Red Bull dá pra
-- saber que horas estava previsto o término e que horas eu terminei?".
--
-- 1) A regra do descanso (v29.185.0, migração 152) sai. Ela está ligada em 8 funções (agenda, site, JuIA, painel,
--    remarcações, senha digital); desligar a própria regra libera as 8 juntas, sem mexer nelas. A assinatura fica
--    para nenhuma chamada quebrar. O limite de 12 atendimentos por dia (dia_lotado, migração 192) continua.
create or replace function public.descanso_ok(p_date date, p_start_time time, p_duration_minutes integer, p_exclude_booking_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_duration_minutes is not null and p_duration_minutes > 0
$function$;

-- 2) Hora real de término. Hoje só existia o horário previsto (end_time) e o updated_at, que muda com qualquer edição.
--    completed_at = a hora do Concluir (o mesmo momento em que sai o comprovante). Em 31/10 o Lucas estava previsto até
--    12:30 e foi concluído às 11:40: 50 minutos de cadeira livre que a agenda não mostrava.
alter table public.bookings add column if not exists completed_at timestamptz;

create or replace function public.bookings_marca_conclusao()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status is distinct from 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_bookings_marca_conclusao on public.bookings;
create trigger trg_bookings_marca_conclusao
  before insert or update of status on public.bookings
  for each row execute function public.bookings_marca_conclusao();

-- Os de hoje já concluídos: a hora do Concluir ficou no updated_at (nenhuma edição depois).
update public.bookings
   set completed_at = updated_at
 where status = 'completed' and completed_at is null
   and booking_date = (timezone('America/Sao_Paulo', now()))::date;

-- 3) Buracos para o painel (só admin): a mesma conta da encaixes_possiveis (migração 206). Atendimento concluído já sai
--    da conta, então quem termina antes abre o buraco na hora.
create or replace function public.admin_encaixes(p_date date, p_min_minutes integer default 30)
returns table(inicio time, fim time, minutos integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  return query select e.inicio, e.fim, e.minutos from public.encaixes_possiveis(p_date, p_min_minutes) e order by e.inicio;
end;
$function$;

revoke all on function public.admin_encaixes(date, integer) from public, anon;
grant execute on function public.admin_encaixes(date, integer) to authenticated, service_role;
