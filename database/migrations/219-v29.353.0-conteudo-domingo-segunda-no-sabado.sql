-- v29.353.0 (10/11/2026) — Conteúdo de domingo e de segunda gerado no sábado.
-- Já aplicado em produção pelo conector do Supabase em 10/11/2026; este arquivo é o registro.
-- O crivo que agenda os posts roda no computador da barbearia, desligado nos dois dias em que ela fecha.
-- No sábado, depois do post do dia (11:00 UTC = 8h), o gerador é chamado mais duas vezes com "adiante":
-- 1 = domingo, 2 = segunda. A function só aceita "adiante" quando o dia-alvo é domingo ou segunda.

select cron.schedule('bdj-content-generate-domingo', '3 11 * * 6', $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/content-generate-daily',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{"adiante":1}'::jsonb, timeout_milliseconds := 25000);
$$);

select cron.schedule('bdj-content-generate-segunda', '6 11 * * 6', $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/content-generate-daily',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{"adiante":2}'::jsonb, timeout_milliseconds := 25000);
$$);
