-- v29.147.0 (06/09/2026) — Avaliações do Google sincronizadas pelo conector do Windsor.ai.
--
-- Contexto: a tela admin-avaliacoes.html existe desde a v28.33.0, mas a tabela google_reviews
-- ficou VAZIA de 01/08 a 06/09 porque os secrets da API direta do Google
-- (GOOGLE_REVIEWS_*) nunca foram cadastrados e, por isso, nunca houve cron pra
-- google-reviews-sync. O conector google_my_business do Windsor.ai (já autorizado pelo
-- Juliano em 05/08) lê e responde avaliações — é o caminho que a v29.147.0 liga na function.
--
-- Cron a cada 2 horas. Sem o secret WINDSOR_API_KEY a function responde
-- {skipped:'nenhuma_fonte_configurada'} e não faz nada — agendar antes do secret é seguro.
-- cron.schedule com o mesmo jobname substitui o job existente, então re-rodar é seguro.
select cron.schedule(
  'bdj-google-reviews-sync',
  '20 */2 * * *',
  $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/google-reviews-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
