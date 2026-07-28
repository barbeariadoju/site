-- 047-v28.14.2-trava-permissao-funcoes-telefone.sql
--
-- Achado ao revisar as 4 funções corrigidas na migration 046: 3 delas nunca
-- tiveram um "revoke all ... from public" (só ganharam "grant ... to
-- service_role" ADICIONAL) — e o Postgres concede EXECUTE a PUBLIC por padrão
-- toda vez que uma função é criada. Resultado: qualquer cliente com a chave
-- anônima do site (publicamente embutida no JS) conseguia chamar essas
-- SECURITY DEFINER functions direto via PostgREST/RPC, sem passar por
-- nenhuma edge function:
--   - customers_due_for_reactivation: devolvia nome + telefone + última
--     visita de até 100 clientes — vazamento real de dado de cliente.
--   - upsert_customer_birthday: permitia criar/alterar customer_profiles
--     (nome, telefone, data de nascimento) de qualquer telefone.
--   - v27_customer_id_by_phone: menos sensível (só devolve um uuid), mas
--     sem uso legítimo fora do trigger que já roda com privilégio próprio.
--
-- Mesma classe de brecha já corrigida na migration 044 para
-- phone_upcoming_bookings/whatsapp_cancel_booking. Confirmado nesta sessão
-- que as 3 só são chamadas por edge functions que já usam
-- SUPABASE_SERVICE_ROLE_KEY (create-public-booking, customer-reactivation) —
-- nenhum caminho do site usa a chave anônima para chamá-las, então travar
-- para service_role não quebra nada.
--
-- get_public_customer_summary NÃO entra aqui: ela é intencionalmente
-- pública (widget "meu agendamento" do site chama com a chave anônima) e já
-- foi corretamente restrita a anon/authenticated/service_role desde a
-- migration 015.

revoke all on function public.customers_due_for_reactivation(integer,integer,integer) from public;
grant execute on function public.customers_due_for_reactivation(integer,integer,integer) to service_role;

revoke all on function public.upsert_customer_birthday(text,text,date) from public;
grant execute on function public.upsert_customer_birthday(text,text,date) to service_role;

revoke all on function public.v27_customer_id_by_phone(text) from public;
