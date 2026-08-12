-- v29.15.0 — O checkbox "já é cliente recorrente" vira campo "nº desta visita".
--
-- Motivo (caso John Maicon/Tatiane, 11-12/08/2026): o checkbox chutava prior_visits=6
-- pra qualquer cliente antigo. O Juliano pensa em "é a 2ª/6ª visita dele" (número total,
-- contando esta), não em "quantas visitas antes do sistema" — então a tela agora pergunta
-- exatamente isso e ESTA função converte pro prior_visits (migration 098) usado por
-- visitNumber() no admin: prior_visits = nº digitado − concluídos no sistema antes desta − 1.
--
-- GOTCHA (lição da migration 041): a lista de parâmetros MUDA, então o Postgres criaria
-- uma SOBRECARGA em vez de substituir — obrigatório dropar a assinatura antiga antes.
-- p_mark_recurring CONTINUA aceito (comportamento antigo, greatest(prior,6)) porque o
-- navegador/PWA do Juliano pode rodar JS antigo por horas (gotcha do ?v= de 12/08).

drop function if exists public.admin_apply_completion_extras(text, text, integer, boolean);

create or replace function public.admin_apply_completion_extras(
  p_phone text, p_customer_name text default null,
  p_loyalty_delta integer default 0, p_mark_recurring boolean default false,
  p_visit_number integer default null, p_booking_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_before integer;
  v_prior integer;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  v_phone := regexp_replace(p_phone,'\D','','g');
  if v_phone !~ '^[0-9]{10,13}$' then raise exception 'Telefone inválido.'; end if;
  if coalesce(p_loyalty_delta,0) = 0 and not coalesce(p_mark_recurring,false) and p_visit_number is null then return; end if;

  select cp.id into v_customer_id from public.customer_profiles cp
    where public.phone_match_key(cp.phone) = public.phone_match_key(v_phone) limit 1;
  if v_customer_id is null then
    insert into public.customer_profiles(name,phone)
      values (coalesce(nullif(trim(p_customer_name),''),'Cliente'), v_phone)
      returning id into v_customer_id;
  end if;

  if p_visit_number is not null then
    -- Concluídos ANTES desta reserva (mesma comparação estrita de data/hora do
    -- visitNumber() em admin-v15-4-core.js, pra etiqueta bater com o que ele digitou).
    -- Sem p_booking_id (balcão chama logo após criar a reserva concluída): todos os
    -- concluídos menos a própria, que acabou de entrar.
    if p_booking_id is not null then
      select count(*) into v_before
      from public.bookings b, public.bookings ref
      where ref.id = p_booking_id
        and b.status = 'completed'
        and public.phone_match_key(b.customer_phone) = public.phone_match_key(v_phone)
        and (b.booking_date < ref.booking_date
             or (b.booking_date = ref.booking_date and b.start_time < ref.start_time));
    else
      select greatest(count(*) - 1, 0) into v_before
      from public.bookings b
      where b.status = 'completed'
        and public.phone_match_key(b.customer_phone) = public.phone_match_key(v_phone);
    end if;
    v_prior := greatest(coalesce(p_visit_number,0) - v_before - 1, 0);
    update public.customer_profiles cp
      set prior_visits = v_prior, updated_at = now()
      where cp.id = v_customer_id;
  elsif coalesce(p_mark_recurring,false) then
    update public.customer_profiles cp
      set prior_visits = greatest(cp.prior_visits, 6), updated_at = now()
      where cp.id = v_customer_id;
  end if;

  if coalesce(p_loyalty_delta,0) <> 0 then
    perform public.admin_adjust_loyalty_points(v_customer_id, p_loyalty_delta, 'Ajuste na conclusão do atendimento');
  end if;
end $$;

revoke all on function public.admin_apply_completion_extras(text,text,integer,boolean,integer,uuid) from public;
grant execute on function public.admin_apply_completion_extras(text,text,integer,boolean,integer,uuid) to authenticated;
