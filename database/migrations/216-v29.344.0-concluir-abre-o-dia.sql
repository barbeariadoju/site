-- v29.344.0 — Concluir um atendimento de hoje abre o dia (Juliano, 04/11/2026: "se eu concluí
-- serviço é porque abri a barbearia").
--
-- O expediente era aberto pelo botão Abrir ou pela câmera. Com a câmera muda desde a noite de
-- 29/10 (o contador reconecta sem receber quadro), em 04/11 o painel dizia "Barbearia ainda não
-- aberta hoje" com 3 atendimentos concluídos. O fechamento automático já preenchia a abertura
-- pelo primeiro atendimento, mas só no fim do dia.
--
-- Agora, ao concluir um atendimento do dia, se o dia ainda não foi aberto, ele abre no horário de
-- início desse atendimento, com aberto_por='automatico' (o painel e o relatório já explicam essa
-- origem como "preenchida pelo primeiro atendimento do dia"). Se outro atendimento concluído
-- começou antes, a abertura recua para ele. Nunca mexe em dia aberto pelo botão, pela câmera ou
-- por ajuste, nem em dia já fechado.

create or replace function public.expediente_abrir_pelo_atendimento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_aberto timestamptz;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  if new.booking_date <> v_hoje or new.start_time is null then return new; end if;

  v_aberto := (new.booking_date + new.start_time) at time zone 'America/Sao_Paulo';

  insert into public.expediente (dia, aberto_em, aberto_por)
  values (v_hoje, v_aberto, 'automatico')
  on conflict (dia) do update
    set aberto_em = least(coalesce(public.expediente.aberto_em, excluded.aberto_em), excluded.aberto_em),
        aberto_por = 'automatico',
        updated_at = now()
    where public.expediente.fechado_em is null
      and (public.expediente.aberto_em is null or public.expediente.aberto_por = 'automatico');
  return new;
exception when others then
  -- abrir o dia nunca pode impedir a conclusão do atendimento
  raise warning 'expediente_abrir_pelo_atendimento: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.expediente_abrir_pelo_atendimento() from public, anon, authenticated;

drop trigger if exists trg_bookings_abre_expediente on public.bookings;
create trigger trg_bookings_abre_expediente
  after update of status on public.bookings
  for each row execute function public.expediente_abrir_pelo_atendimento();

-- 04/11/2026: o dia que motivou a mudança, aberto pelo primeiro atendimento concluído.
update public.expediente e
   set aberto_em = (e.dia + b.primeiro) at time zone 'America/Sao_Paulo', aberto_por = 'automatico', updated_at = now()
  from (select min(start_time) primeiro from public.bookings
         where booking_date = date '2026-11-04' and status = 'completed') b
 where e.dia = date '2026-11-04' and e.aberto_em is null and e.fechado_em is null and b.primeiro is not null;
