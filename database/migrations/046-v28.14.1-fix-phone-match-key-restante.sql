-- 046-v28.14.1-fix-phone-match-key-restante.sql
--
-- A migration 042 criou phone_match_key() para corrigir o bug do WhatsApp
-- (Baileys às vezes manda o remoteJid sem o "9" que precede o celular) e
-- aplicou nas 2 funções do caminho crítico da JuIA na época
-- (find_pending_experience_by_phone, get_customer_commercial_context).
-- Migrations 043/044/045 (cancelamento/reagendamento/troca de serviço/
-- produtos via WhatsApp) já nasceram usando phone_match_key.
--
-- Mas ficaram 4 funções mais antigas com o mesmo bug latente, comparando
-- telefone por dígitos exatos ou pelos últimos 11 caracteres (que não cobre
-- o caso do "9" faltando, porque aí os dois números têm tamanhos diferentes
-- e right(...,11) não alinha os dígitos locais corretamente):
--   - get_public_customer_summary: usada pelo widget "meu agendamento" do site.
--   - v27_customer_id_by_phone: liga um agendamento concluído ao customer_profile
--     certo para registrar na timeline/pesquisa de satisfação.
--   - customers_due_for_reactivation: decide quem entra na campanha de
--     reativação de clientes sumidos.
--   - upsert_customer_birthday: grava a data de aniversário coletada no
--     agendamento no customer_profile certo (ou cria um novo, se não achar).
-- Nas 4, um cliente com "9" no cadastro mas que chega sem o "9" (ou
-- vice-versa) podia não ser reconhecido — silenciosamente, sem erro.
--
-- Troca a comparação de telefone das 4 por phone_match_key(), mesmo padrão
-- já usado em toda parte do fluxo WhatsApp. Nenhuma outra lógica muda.

create or replace function public.get_public_customer_summary(p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_digits text:=regexp_replace(coalesce(p_phone,''),'\D','','g'); v_phone text; v_result jsonb;
begin
  if char_length(v_digits) not between 10 and 13 then return '{}'::jsonb; end if;
  v_phone := public.phone_match_key(p_phone);
  select jsonb_build_object(
    'found',true,
    'first_name',split_part(trim(c.name),' ',1),
    'points',coalesce(l.points,0),
    'rewards_available',coalesce(l.rewards_available,0),
    'completed_visits',(select count(*) from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status='completed'),
    'last_services',(select b.service_name from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
    'last_visit',(select b.booking_date from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
    'next_booking',(select jsonb_build_object('date',b.booking_date,'time',left(b.start_time::text,5),'services',b.service_name,'status',b.status) from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status in ('pending','confirmed') and b.booking_date>=current_date order by b.booking_date,b.start_time limit 1),
    'return_interval_days',c.return_interval_days
  ) into v_result
  from public.customer_profiles c left join public.loyalty_accounts l on l.customer_id=c.id
  where public.phone_match_key(c.phone)=v_phone and c.archived=false limit 1;
  return coalesce(v_result,jsonb_build_object('found',false));
end $$;

create or replace function public.v27_customer_id_by_phone(p_phone text)
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.customer_profiles
  where public.phone_match_key(phone)=public.phone_match_key(p_phone)
  order by archived asc, updated_at desc limit 1
$$;

create or replace function public.customers_due_for_reactivation(
  p_default_days integer default 45,
  p_grace_days integer default 10,
  p_cooldown_days integer default 40
)
returns table(customer_id uuid, name text, phone text, last_visit date, days_since integer)
language sql security definer set search_path=public as $$
  with ultimas as (
    select c.id, c.name, c.phone, c.return_interval_days,
           max(b.booking_date) filter (where b.status='completed') as ultima_visita
    from public.customer_profiles c
    join public.bookings b
      on public.phone_match_key(b.customer_phone) = public.phone_match_key(c.phone)
    where c.archived = false
      and length(regexp_replace(c.phone,'\D','','g')) >= 10
    group by c.id
  )
  select u.id, u.name, u.phone, u.ultima_visita,
         (current_date - u.ultima_visita) as days_since
  from ultimas u
  where u.ultima_visita is not null
    and (current_date - u.ultima_visita) >=
        coalesce(u.return_interval_days + p_grace_days, p_default_days)
    and not exists (
      select 1 from public.customer_outreach_log l
      where l.customer_id = u.id
        and l.kind = 'reactivation'
        and l.created_at > now() - make_interval(days => p_cooldown_days)
    )
  order by u.ultima_visita asc
  limit 100
$$;

create or replace function public.upsert_customer_birthday(
  p_phone text,
  p_name text,
  p_birth_date date
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
begin
  if p_birth_date is null then return; end if;
  if p_birth_date < date '1900-01-01' or p_birth_date > current_date then return; end if;
  if length(v_digits) < 10 then return; end if;

  select id into v_id
  from public.customer_profiles
  where public.phone_match_key(phone) = public.phone_match_key(p_phone)
  order by created_at asc
  limit 1;

  if v_id is not null then
    -- só preenche se ainda não houver data (não sobrescreve o que o admin colocou)
    update public.customer_profiles
      set birth_date = coalesce(birth_date, p_birth_date), updated_at = now()
    where id = v_id;
  else
    insert into public.customer_profiles (name, phone, birth_date, archived)
    values (nullif(trim(p_name),''), v_digits, p_birth_date, false)
    on conflict (phone) do update
      set birth_date = coalesce(public.customer_profiles.birth_date, excluded.birth_date),
          updated_at = now();
  end if;
end $$;

notify pgrst, 'reload schema';
