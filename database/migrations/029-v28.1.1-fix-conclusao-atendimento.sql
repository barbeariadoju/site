-- Barbearia do Ju — V28.1.1
-- Corrige falha ao marcar agendamento como concluído.
--
-- Causa: as migrations 027-v27-1-crm-premium-experiencia.sql e
-- 027-v27-1-experiencia-crm-real.sql descrevem duas versões incompatíveis da
-- tabela public.experience_requests, e ambas acabaram sendo aplicadas ao banco
-- em momentos diferentes. A tabela ficou com o formato da primeira (colunas
-- customer_name/customer_email obrigatórias), mas o trigger
-- v27_queue_experience_after_completion (da segunda) nunca preenche essas
-- colunas — então toda tentativa de concluir um agendamento de cliente com
-- e-mail cadastrado violava a restrição not-null e a atualização inteira
-- falhava (erro genérico "Não foi possível concluir esta ação" no admin).
--
-- O código em produção (avaliacao-v27.js, get_experience_context,
-- submit_experience_response) já usa o contrato da segunda versão (status
-- pending/sent/opened/satisfied/feedback/review_clicked/expired/failed, sem
-- depender de customer_name/customer_email na tabela). Este script alinha o
-- schema da tabela a esse contrato, em vez de mudar o código já publicado.

alter table public.experience_requests
  alter column customer_name drop not null,
  alter column customer_email drop not null;

alter table public.experience_requests
  drop constraint if exists experience_requests_status_check,
  add constraint experience_requests_status_check
    check (status = any (array['pending','sent','opened','satisfied','feedback','review_clicked','expired','failed']));

notify pgrst, 'reload schema';
