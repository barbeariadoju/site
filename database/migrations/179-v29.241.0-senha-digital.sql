-- v29.241.0 (26/09/2026) — Senha Digital: quem chega sem agendamento aponta o celular pro QR da
-- parede, informa nome/WhatsApp/serviço e vira um agendamento no próximo horário livre de hoje
-- (canal 'porta'). A agenda fecha o horário sozinha e o cliente recebe a senha e a previsão no
-- WhatsApp; um cron avisa "você é o próximo".
--
-- Origem: sábado 26/09 o Juliano atendia o Sérgio com a agenda vazia, entraram dois clientes
-- sem hora, e qualquer agendamento online naquele instante cairia em cima deles. A câmera não
-- resolve (vê corpos, não intenção — o acompanhante é o caso clássico).
--
-- 1) canal 'porta' no check e na guarda de cliente bloqueado;
-- 2) bookings.senha_numero (contador do dia, o que aparece na tela) e proximo_avisado_at
--    (marca do "você é o próximo", um por agendamento);
-- 3) senha_digital_criar: lock + primeiro horário livre + create_public_booking_v15 (herda todas
--    as validações e gatilhos) + canal 'porta'. Só o service_role executa (function senha-digital).
-- 4) cron bdj-senha-proximo a cada minuto, 8h–19h de Brasília.

alter table public.bookings drop constraint if exists bookings_channel_check;
alter table public.bookings add constraint bookings_channel_check
  check (channel = any (array['site','balcao','juia_whatsapp','juia_chat','rebooking','porta']));

alter table public.bookings add column if not exists senha_numero integer;
alter table public.bookings add column if not exists proximo_avisado_at timestamptz;

create or replace function public.bookings_block_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(new.channel, 'site') in ('site', 'juia_whatsapp', 'porta')
     and not public.is_admin()
     and public.is_customer_blocked_v2(new.customer_phone, new.customer_email) then
    raise exception 'cliente_bloqueado';
  end if;
  return new;
end;
$function$;

drop function if exists public.senha_digital_criar(text, text, text, numeric, integer);
create or replace function public.senha_digital_criar(
  p_nome text, p_telefone text, p_servico text, p_preco numeric, p_duracao integer
)
returns table(booking_id uuid, booking_date date, start_time time, end_time time, senha_numero integer, posicao integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hoje date := (timezone('America/Sao_Paulo', now()))::date;
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_existente uuid;
  v_slot time;
  v_id uuid;
  v_num integer;
  v_pos integer;
  v_end time;
begin
  -- Dois QR ao mesmo tempo: o segundo espera e pega o horário seguinte, em vez de colidir.
  perform pg_advisory_xact_lock(hashtext('senha-digital'));

  -- Uma senha ativa por telefone por dia (anti-trote e anti-duplicidade).
  select b.id into v_existente
    from public.bookings b
   where b.booking_date = v_hoje
     and b.channel = 'porta'
     and b.status in ('pending', 'confirmed')
     and public.phone_match_key(b.customer_phone) = public.phone_match_key(v_tel)
   limit 1;
  if v_existente is not null then
    raise exception 'senha_existente:%', v_existente;
  end if;

  select s.slot_time into v_slot
    from public.get_available_slots_excluding(v_hoje, p_duracao, null) s
   order by s.slot_time
   limit 1;
  if v_slot is null then
    raise exception 'sem_horario';
  end if;

  v_id := public.create_public_booking_v15(
    p_nome, v_tel, null, p_servico, p_preco, p_duracao, v_hoje, v_slot,
    'Senha digital: chegou sem agendamento', '[]'::jsonb, 0
  );

  select coalesce(max(b.senha_numero), 0) + 1 into v_num
    from public.bookings b
   where b.booking_date = v_hoje and b.channel = 'porta';

  -- arrival_route_sent_at: a pessoa já está na barbearia, não precisa da rota do Maps.
  update public.bookings b
     set channel = 'porta', senha_numero = v_num, arrival_route_sent_at = now(), updated_at = now()
   where b.id = v_id
   returning b.end_time into v_end;

  select count(*)::integer into v_pos
    from public.bookings b
   where b.booking_date = v_hoje
     and b.status in ('pending', 'confirmed')
     and b.start_time < v_slot;

  return query select v_id, v_hoje, v_slot, v_end, v_num, v_pos;
end;
$function$;

revoke all on function public.senha_digital_criar(text, text, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.senha_digital_criar(text, text, text, numeric, integer) to service_role;

-- "Você é o próximo": a cada minuto no expediente (8h–19h de Brasília; sábado a function mesma
-- para às 16h porque não há senha depois do fechamento). Exceção estreita ao juia_quiet_now(),
-- como o aviso de chegada: é resposta a uma ação do cliente, no mesmo dia, dentro da loja.
select cron.unschedule('bdj-senha-proximo') where exists (select 1 from cron.job where jobname = 'bdj-senha-proximo');
select cron.schedule('bdj-senha-proximo', '* * * * *', $cron$
  select case when extract(hour from (now() at time zone 'America/Sao_Paulo')) between 8 and 19 then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/senha-proximo',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb
  )) end;
$cron$);

notify pgrst, 'reload schema';
