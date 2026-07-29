-- Barbearia do Ju — V28.17.0
-- Atendimento de balcão (clientes que vêm direto na porta, sem passar pelo site) +
-- forma de pagamento por atendimento concluído (site ou balcão).
--
-- Contexto: o Juliano anotava na agenda de papel quem vinha direto na porta — não
-- entrava no faturamento nem no CRM. Esta migration cria o suporte de banco para uma
-- tela nova no admin que registra esses atendimentos já como "concluído" (entra no
-- relatório de faturamento igual um agendamento do site) e adiciona forma de pagamento
-- a qualquer atendimento concluído (site ou balcão).

alter table public.bookings
  add column if not exists payment_method text
    check (payment_method in ('pix','debito','credito','dinheiro','fidelidade')),
  add column if not exists channel text not null default 'site'
    check (channel in ('site','balcao'));

comment on column public.bookings.payment_method is 'Forma de pagamento do atendimento concluído: pix, debito, credito, dinheiro ou fidelidade (bônus). Nulo em atendimentos ainda não concluídos ou concluídos antes desta migration.';
comment on column public.bookings.channel is 'Origem do atendimento: site (agendado pelo cliente via site/WhatsApp/JuIA) ou balcao (registrado manualmente pelo admin, cliente que veio direto na porta).';

-- RPC análoga a admin_create_booking, mas específica pro balcão: sempre cria já como
-- 'completed' (é um registro retroativo do que já aconteceu), sem checar disponibilidade
-- de horário (não faz sentido bloquear o registro de algo que já ocorreu), e devolve se
-- o cliente já existia no CRM (via phone_match_key, mesmo padrão usado pra evitar o bug
-- do "9" no telefone) para a tela decidir se dispara a mensagem de boas-vindas via
-- WhatsApp só pra quem é realmente novo.
create or replace function public.admin_register_walkin_visit(
  p_customer_name text,
  p_customer_phone text,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_booking_date date,
  p_start_time time without time zone,
  p_payment_method text,
  p_notes text default null::text
)
returns table(booking_id uuid, is_new_customer boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_phone text := regexp_replace(p_customer_phone, '\D', '', 'g');
  v_is_new boolean;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Informe o nome do cliente.'; end if;
  if v_phone !~ '^[0-9]{10,13}$' then raise exception 'Telefone inválido.'; end if;
  if p_payment_method not in ('pix','debito','credito','dinheiro','fidelidade') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select not exists(
    select 1 from public.customer_profiles c
    where public.phone_match_key(c.phone) = public.phone_match_key(v_phone)
  ) into v_is_new;

  insert into public.bookings(
    customer_name, customer_phone, service_name, service_price, duration_minutes,
    booking_date, start_time, notes, status, payment_method, channel
  ) values (
    trim(p_customer_name), v_phone, p_service_name, p_service_price, p_duration_minutes,
    p_booking_date, p_start_time, nullif(trim(p_notes), ''), 'completed', p_payment_method, 'balcao'
  ) returning id into v_id;

  return query select v_id, v_is_new;
end;
$function$;

notify pgrst, 'reload schema';
