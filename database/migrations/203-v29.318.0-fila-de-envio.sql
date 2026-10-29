-- v29.318.0 — fila de envio programado (pedido do Juliano, 29/10/2026: "pode deixar pra enviar de forma
-- automática", "envia umas 5 por dia", "eu não vou lembrar de clicar").
--
-- Uma linha = uma mensagem pronta para um cliente, com o dia a partir do qual pode sair. O robô
-- outreach-queue-dispatch manda UMA por rodada, no máximo 5 por dia (todas as campanhas somadas), com pelo
-- menos 60 min entre uma e outra, terça a sábado, 9h às 17h. Nasceu para a recuperação dos clientes fiéis
-- atrasados (análise de outubro), mas serve para qualquer lista futura: é só carregar linhas com campaign nova.

create table if not exists public.outreach_queue (
  id bigint generated always as identity primary key,
  campaign text not null,
  customer_id uuid references public.customer_profiles(id) on delete set null,
  phone text not null,
  customer_name text,
  text text not null,
  send_on date not null,
  status text not null default 'fila' check (status in ('fila','enviado','pulado','falhou')),
  skip_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists outreach_queue_fila on public.outreach_queue (send_on, id) where status = 'fila';

alter table public.outreach_queue enable row level security;
-- Só o backend lê e grava (regra de 30/10/2026: GRANT explícito em tabela nova).
grant select, insert, update, delete on public.outreach_queue to service_role;
grant usage, select on sequence public.outreach_queue_id_seq to service_role;

-- A cada 20 min, terça a sábado; a janela 9h-17h e o teto diário ficam na function.
select cron.schedule('bdj-outreach-queue', '*/20 12-20 * * 2-6', $$
  select case when not public.juia_quiet_now() then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/outreach-queue-dispatch',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb
  )) end;
$$);
