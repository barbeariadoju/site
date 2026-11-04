-- v29.341.0 — pedido do Juliano (04/11/2026): na 2ª falta (no_show) do telefone, o cliente passa a agendar só com
-- pagamento antecipado pelo Pix. Até aqui o bloqueio (blocked_customers) era sempre manual, como o do Venilson em 31/10.
-- Agora, quando um atendimento vira no_show e o telefone soma 2 ou mais faltas, entra sozinho em blocked_customers.
-- O bookings_block_guard já recusa o agendamento direto (site, JuIA, porta) e a JuIA apresenta a política do Pix.
-- Se o Juliano desfizer a falta (marcou por engano) e o total voltar a menos de 2, o bloqueio AUTOMÁTICO sai;
-- bloqueio manual nunca é mexido aqui.
create or replace function public.bookings_auto_block_on_no_show()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total integer;
begin
  if new.customer_phone is null then
    return new;
  end if;
  v_total := public.phone_no_show_count(new.customer_phone);
  if new.status = 'no_show' and (tg_op = 'INSERT' or old.status is distinct from 'no_show') then
    if v_total >= 2 and not public.is_customer_blocked_v2(new.customer_phone, null) then
      insert into public.blocked_customers (customer_phone, customer_name, reason)
      values (new.customer_phone, new.customer_name,
        'Automático: 2ª falta (' || to_char(new.booking_date, 'DD/MM/YYYY') || ' às ' || to_char(new.start_time, 'HH24:MI')
        || '). Regra do Juliano de 04/11/2026: só agenda com pagamento antecipado pelo Pix.');
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'no_show' and new.status is distinct from 'no_show' and v_total < 2 then
    delete from public.blocked_customers b
    where b.reason like 'Automático: 2ª falta%'
      and public.phone_match_key(b.customer_phone) = public.phone_match_key(new.customer_phone);
  end if;
  return new;
end;
$function$;

revoke all on function public.bookings_auto_block_on_no_show() from public, anon, authenticated;

drop trigger if exists trg_bookings_auto_block_on_no_show on public.bookings;
create trigger trg_bookings_auto_block_on_no_show
after insert or update of status on public.bookings
for each row execute function public.bookings_auto_block_on_no_show();
