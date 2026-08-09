-- v29.9.0 — 2 decisões do Juliano na mesma sessão:
-- (1) Cartão de fidelidade passa a pontuar QUALQUER serviço concluído, não só "corte"
--     (decisão tomada via pergunta direta — cartão único, 1 carimbo por visita, sem
--     trilhas separadas por serviço, mantém o modelo simples que a JuIA já anuncia
--     "seu Nº atendimento...").
-- (2) admin_apply_completion_extras: RPC única pra ele ajustar pontos de fidelidade extra
--     (carimbos do cartão de papel de antes do sistema) e marcar "cliente recorrente"
--     (prior_visits, migration 098) NO MOMENTO de concluir o atendimento — tanto no
--     "Concluir" da Agenda quanto no registro do Balcão — em vez de precisar ir na tela
--     de Fidelidade depois. Cria o customer_profiles se ainda não existir (mesmo padrão
--     do admin_register_walkin_visit).

create or replace function public.v21_sync_loyalty_on_completed_booking()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_points integer; v_rewards integer;
begin
  if new.status='completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed') then
    select id into v_customer from public.customer_profiles
      where phone=regexp_replace(new.customer_phone,'\D','','g') and archived=false limit 1;
    if v_customer is not null then
      insert into public.loyalty_accounts(customer_id) values(v_customer)
        on conflict(customer_id) do nothing;
      insert into public.loyalty_events(customer_id,booking_id,event_type,points_delta,description)
        values(v_customer,new.id,'earn',1,'Atendimento concluído')
        on conflict do nothing;
      if found then
        update public.loyalty_accounts
          set points=points+1,lifetime_points=lifetime_points+1,updated_at=now()
          where customer_id=v_customer
          returning points,rewards_available into v_points,v_rewards;
        if v_points >= 10 then
          update public.loyalty_accounts
            set points=points-10,rewards_available=rewards_available+1,updated_at=now()
            where customer_id=v_customer;
        end if;
      end if;
    end if;
  end if;
  return new;
end
$$;

create or replace function public.admin_apply_completion_extras(
  p_phone text, p_customer_name text default null,
  p_loyalty_delta integer default 0, p_mark_recurring boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare v_phone text; v_customer_id uuid;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  v_phone := regexp_replace(p_phone,'\D','','g');
  if v_phone !~ '^[0-9]{10,13}$' then raise exception 'Telefone inválido.'; end if;
  if coalesce(p_loyalty_delta,0) = 0 and not coalesce(p_mark_recurring,false) then return; end if;

  select id into v_customer_id from public.customer_profiles
    where public.phone_match_key(phone) = public.phone_match_key(v_phone) limit 1;
  if v_customer_id is null then
    insert into public.customer_profiles(name,phone)
      values (coalesce(nullif(trim(p_customer_name),''),'Cliente'), v_phone)
      returning id into v_customer_id;
  end if;

  if coalesce(p_mark_recurring,false) then
    update public.customer_profiles set prior_visits = greatest(prior_visits,6), updated_at = now() where id = v_customer_id;
  end if;

  if coalesce(p_loyalty_delta,0) <> 0 then
    perform public.admin_adjust_loyalty_points(v_customer_id, p_loyalty_delta, 'Ajuste na conclusão do atendimento');
  end if;
end $$;

revoke all on function public.admin_apply_completion_extras(text,text,integer,boolean) from public;
grant execute on function public.admin_apply_completion_extras(text,text,integer,boolean) to authenticated;
