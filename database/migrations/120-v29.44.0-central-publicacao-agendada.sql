-- v29.44.0 (18/08/2026) — Central de Conteúdo: PUBLICAÇÃO AGENDADA
--
-- Motivação: todo conteúdo com hora certa ("Reel às 18h", "teaser sábado 17h30", "publicar
-- sábado 9h") dependia de alguém clicar na Central na hora — e o lembrete por scheduled task
-- tem jitter de ~9 min e só roda com o app aberto. Agora um rascunho pode ficar com
-- status 'agendado' + scheduled_for; o cron abaixo chama content-publish-scheduled a cada
-- 5 min e o que venceu é publicado sozinho (mesmo fluxo Meta/Evolution dos botões).
--
-- Status possíveis de content_posts a partir daqui:
--   rascunho → (botão) aprovado → publicado | rejeitado
--   rascunho → (⏰ Agendar) agendado → (cron) aprovado → publicado
--   agendado → (Cancelar agendamento) rascunho
-- Nunca se publica 'rascunho' automaticamente — só 'agendado', ato explícito do Juliano.

alter table public.content_posts
  add column if not exists scheduled_for timestamptz;

-- O check de status (migration 076) não conhecia 'agendado' — descoberto no primeiro UPDATE.
alter table public.content_posts drop constraint if exists content_posts_status_check;
alter table public.content_posts add constraint content_posts_status_check
  check (status = any (array['rascunho'::text, 'aprovado'::text, 'publicado'::text, 'rejeitado'::text, 'agendado'::text]));

comment on column public.content_posts.scheduled_for is
  'v29.44.0 — quando status=agendado, hora (UTC) em que o cron content-publish-scheduled deve publicar. Status do WhatsApp respeita o horário de silêncio (20h-8h BRT) e sai na primeira rodada depois das 8h.';

create index if not exists content_posts_agendado_idx
  on public.content_posts (scheduled_for)
  where status = 'agendado';

-- Cron a cada 5 minutos. cron.schedule com o mesmo jobname substitui o job existente
-- (re-rodar esta migration é seguro). A function fica com verify_jwt=true: o anon key
-- (público, é o mesmo do site) passa no gateway; quem autoriza de verdade é o
-- x-webhook-secret lido do Vault.
select cron.schedule(
  'bdj-content-publish-scheduled',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/content-publish-scheduled',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa3FsdWF4aHFzeG5ld3VuaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Mjk0NzQsImV4cCI6MjA5OTQwNTQ3NH0.E1ObOSpxrzCBO_4WzAv_Dh2A5d2XofzpImS3U4XxyWY',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa3FsdWF4aHFzeG5ld3VuaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Mjk0NzQsImV4cCI6MjA5OTQwNTQ3NH0.E1ObOSpxrzCBO_4WzAv_Dh2A5d2XofzpImS3U4XxyWY',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
