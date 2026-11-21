-- v29.370.0 — faxina diária do histórico do pg_cron.
--
-- Em 21/11/2026 o banco passou do limite do plano Free (724 MB de 500 MB) e a
-- Supabase bloqueou às 00h33 toda chamada autenticada (painel em branco, JuIA
-- calada, robôs parados; erro PGRST303). 675 MB eram só cron.job_run_details:
-- o pg_cron grava uma linha por execução e nunca apaga (~6.300 linhas/dia).
-- A limpeza foi feita à mão (TRUNCATE mantendo 24 h; banco foi a 39 MB).
-- Este job impede a volta: todo dia às 06:30 UTC (03:30 de Brasília) apaga
-- o histórico com mais de 3 dias.

select cron.unschedule('faxina-historico-cron')
where exists (select 1 from cron.job where jobname = 'faxina-historico-cron');

select cron.schedule(
  'faxina-historico-cron',
  '30 6 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$
);
