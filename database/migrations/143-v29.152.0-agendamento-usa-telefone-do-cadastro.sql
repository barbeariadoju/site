-- 143 — v29.152.0 (08/09/2026) — caso Helder: o mesmo cliente com o telefone em dois formatos
--
-- O Juliano viu "Helder" duas vezes na busca do Novo agendamento: "(11) 97484-5870" e
-- "5511974845870". NÃO era cadastro duplicado — customer_profiles tem UMA ficha dele
-- (11974845870) e o índice único uq_customer_profiles_phone_key já impede a segunda. O que
-- estava em dois formatos era bookings.customer_phone: os três primeiros agendamentos vieram
-- do site com 11 dígitos; os dois últimos vieram da JuIA com o JID do WhatsApp, 13 dígitos.
-- O painel agrupava clientes pelos dígitos exatos, então via duas pessoas.
--
-- Conferido no banco antes desta migração: 17 telefones com agendamentos em mais de um
-- formato, 22 agendamentos gravados num formato diferente do da ficha do cliente.
--
-- Duas frentes, esta é a do banco (a do painel é o phoneKey em admin-v15-4-core.js):
--
-- 1) Trigger: o agendamento de telefone já cadastrado nasce com o TELEFONE da ficha, além do
--    nome (v29.137.0). Vale nos três caminhos de uma vez — site, JuIA e balcão — sem depender
--    de cada function lembrar de canonizar. BEFORE INSERT só, como antes: editar na agenda
--    continua livre. Substitui v29_booking_nome_do_cadastro (mesma ordem de escolha da ficha
--    que v27_customer_for_booking: quem tem fidelidade primeiro, depois a mais antiga).
--
-- 2) Dados: os 22 agendamentos divergentes passam pro telefone da ficha. Só customer_phone;
--    phone_key é coluna gerada e acompanha. Nenhum trigger de UPDATE dispara (todos são
--    condicionados a status/data/hora). updated_at fica como está — é correção de formato,
--    não um evento do atendimento.
--
-- Por que alinhar à ficha e não escolher um formato "oficial" (11 ou 13 dígitos) pra tudo:
-- o formato da ficha é o que o CRM edita, o que o admin_save_customer_v23 usa pra reapontar
-- agendamentos e o que várias telas comparam. Trocar o formato de 48 fichas e 70 agendamentos
-- de uma vez é um risco sem ganho — o que importa é que ficha e agendamentos batam entre si.
--
-- Testado com insert real desfeito por raise exception (ver CHANGELOG v29.152.0).

create or replace function public.v29_booking_dados_do_cadastro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_nome text; v_phone text;
begin
  if coalesce(btrim(new.customer_phone), '') = '' then
    return new;
  end if;

  select btrim(c.name), c.phone into v_nome, v_phone
  from public.customer_profiles c
  where public.phone_match_key(c.phone) = public.phone_match_key(new.customer_phone)
    and c.archived = false
  order by (exists (select 1 from public.loyalty_accounts la where la.customer_id = c.id)) desc,
           c.created_at asc
  limit 1;

  if v_phone is null then
    return new;  -- telefone novo: nome e número ficam como vieram
  end if;

  -- telefone: sempre os dígitos da ficha (11974845870, não 5511974845870)
  if new.customer_phone is distinct from v_phone then
    new.customer_phone := v_phone;
  end if;

  -- nome: só troca quando realmente diverge, para não sujar o log com no-op
  if coalesce(v_nome, '') <> ''
     and lower(v_nome) is distinct from lower(btrim(coalesce(new.customer_name, ''))) then
    new.customer_name := v_nome;
  end if;

  return new;
end
$function$;

drop trigger if exists trg_bookings_nome_do_cadastro on public.bookings;
drop trigger if exists trg_bookings_dados_do_cadastro on public.bookings;
create trigger trg_bookings_dados_do_cadastro
before insert on public.bookings
for each row execute function public.v29_booking_dados_do_cadastro();

drop function if exists public.v29_booking_nome_do_cadastro();

comment on function public.v29_booking_dados_do_cadastro is
  'Agendamento de telefone ja cadastrado nasce com o nome E o telefone (mesmos digitos) da ficha. Ver CHANGELOG v29.137.0 (nome, caso "Sou eu juliano") e v29.152.0 (telefone, caso Helder).';

-- Dados: agendamentos gravados noutro formato passam pro telefone da ficha.
update public.bookings b
   set customer_phone = c.phone
  from public.customer_profiles c
 where c.archived = false
   and public.phone_match_key(c.phone) = public.phone_match_key(b.customer_phone)
   and b.customer_phone <> c.phone;
