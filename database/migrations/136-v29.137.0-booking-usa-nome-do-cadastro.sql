-- 136 — v29.137.0 — caso "Sou eu juliano" (05/09/2026, 1º atendimento do dia)
--
-- O cliente Joao victor agendou pelo site e digitou "Sou eu juliano" no campo nome. Na
-- agenda pareceu cliente novo, e o Juliano pediu "uma trava baseada no telefone".
--
-- A trava JA EXISTIA e funcionou: v27_customer_for_booking casa o agendamento ao cadastro
-- por phone_match_key e ignora o nome. Conferido na hora: 1 perfil para aquele telefone,
-- 165 perfis na base, ZERO telefones duplicados, zero perfis sem phone_key. O cadastro
-- nunca duplicou.
--
-- O que faltava era o NOME: o texto digitado no site ia direto para a agenda sem passar
-- pelo cadastro. Agora, quando o telefone ja tem cadastro ativo com nome, o agendamento
-- nasce com o nome do cadastro.
--
-- No trigger da tabela, e nao numa funcao de criacao, para valer nos TRES caminhos de uma
-- vez: site, JuIA e balcao.
--
-- BEFORE INSERT de proposito: editar o nome na agenda (UPDATE) continua livre -- foi assim
-- que o agendamento das 08:00 de hoje foi corrigido na mao.
--
-- A ordem de escolha do perfil e a MESMA da v27_customer_for_booking (quem tem fidelidade
-- primeiro, depois o mais antigo). Se divergisse, o nome exibido poderia nao ser o do
-- cadastro ao qual o agendamento fica vinculado.
--
-- Testado com insert real desfeito por raise exception:
--   telefone conhecido "Sou eu juliano de novo" -> "Joao victor"
--   telefone novo      "Cliente Novo Qualquer"  -> preservado

create or replace function public.v29_booking_nome_do_cadastro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_nome text;
begin
  if coalesce(btrim(new.customer_phone), '') = '' then
    return new;
  end if;

  select btrim(c.name) into v_nome
  from public.customer_profiles c
  where public.phone_match_key(c.phone) = public.phone_match_key(new.customer_phone)
    and c.archived = false
    and coalesce(btrim(c.name), '') <> ''
  order by (exists (select 1 from public.loyalty_accounts la where la.customer_id = c.id)) desc,
           c.created_at asc
  limit 1;

  -- só troca quando realmente diverge, para não sujar o log com no-op
  if v_nome is not null
     and lower(v_nome) is distinct from lower(btrim(coalesce(new.customer_name, ''))) then
    new.customer_name := v_nome;
  end if;

  return new;
end
$function$;

drop trigger if exists trg_bookings_nome_do_cadastro on public.bookings;
create trigger trg_bookings_nome_do_cadastro
before insert on public.bookings
for each row execute function public.v29_booking_nome_do_cadastro();

comment on function public.v29_booking_nome_do_cadastro is
  'Agendamento de telefone ja cadastrado nasce com o nome do cadastro. Ver CHANGELOG v29.137.0 (caso "Sou eu juliano", 05/09/2026).';
