-- Barbearia do Ju — V28.8.0
-- Lista de espera / encaixe. Guarda quem quer um horário quando o dia está cheio,
-- com preferências flexíveis (dia específico ou dias da semana, turno, faixa de horário,
-- e uma janela "disposto a esperar de/até"). Quando abre uma vaga (cancelamento),
-- o dono é avisado e pode encaixar a pessoa com 1 clique.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,13}$'),
  customer_email text,
  -- serviço desejado (opcional; ajuda a pré-preencher o encaixe)
  service_name text,
  service_price numeric check (service_price is null or service_price >= 0),
  duration_minutes integer check (duration_minutes is null or (duration_minutes between 10 and 240)),
  -- QUANDO a pessoa quer
  preferred_date date,                                    -- dia específico (opcional)
  preferred_weekdays integer[] not null default '{}',     -- dias da semana desejados (0=dom..6=sáb; ter=2..sáb=6). vazio = qualquer
  preferred_period text not null default 'qualquer'
    check (preferred_period in ('manha','tarde','qualquer')),
  preferred_time_start time,                              -- faixa de horário (opcional)
  preferred_time_end time,
  window_start date,                                      -- disposto a esperar a partir de (semana/mês)
  window_end date,                                        -- ...até
  notes text,
  source text not null default 'admin' check (source in ('site','admin')),
  status text not null default 'esperando'
    check (status in ('esperando','avisado','encaixado','cancelado','expirado')),
  booking_id uuid references public.bookings(id) on delete set null,  -- preenchido quando encaixado
  notified_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_status_idx on public.waitlist (status, created_at);
create index if not exists waitlist_preferred_date_idx on public.waitlist (preferred_date) where preferred_date is not null;

-- updated_at automático
create or replace function public.waitlist_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_waitlist_touch on public.waitlist;
create trigger trg_waitlist_touch before update on public.waitlist
  for each row execute function public.waitlist_touch_updated_at();

-- RLS: admin (autenticado) gerencia tudo; o site grava via Edge Function (service_role).
alter table public.waitlist enable row level security;
grant select, insert, update, delete on public.waitlist to service_role;

drop policy if exists "admin manage waitlist" on public.waitlist;
create policy "admin manage waitlist" on public.waitlist
  for all to authenticated using (is_admin()) with check (is_admin());

-- Dado um horário que abriu (data + hora de início), retorna quem na lista de espera
-- "casa" com aquele dia/turno. Usado no aviso de vaga (cancelamento) e na tela de encaixe.
create or replace function public.waitlist_matches_for_slot(p_date date, p_start_time time)
returns setof public.waitlist
language sql stable security definer set search_path=public as $$
  select w.*
  from public.waitlist w
  where w.status = 'esperando'
    -- casa o dia: dia específico, OU dia-da-semana desejado, OU sem preferência de dia
    and (
      w.preferred_date = p_date
      or (array_length(w.preferred_weekdays, 1) is not null
          and extract(dow from p_date)::int = any(w.preferred_weekdays))
      or (w.preferred_date is null and coalesce(array_length(w.preferred_weekdays,1),0) = 0)
    )
    -- dentro da janela "disposto a esperar de/até" (quando informada)
    and (w.window_start is null or p_date >= w.window_start)
    and (w.window_end is null or p_date <= w.window_end)
    -- casa o horário: faixa explícita tem prioridade; senão o turno; senão qualquer
    and (
      case
        when w.preferred_time_start is not null and w.preferred_time_end is not null
          then p_start_time >= w.preferred_time_start and p_start_time < w.preferred_time_end
        when w.preferred_period = 'manha' then p_start_time < time '12:00'
        when w.preferred_period = 'tarde' then p_start_time >= time '12:00'
        else true
      end
    )
  order by w.created_at asc
$$;

grant execute on function public.waitlist_matches_for_slot(date, time) to service_role, authenticated;

notify pgrst, 'reload schema';
