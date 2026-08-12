-- 105-v29.16.0-convite-retorno-pos-atendimento.sql
-- Convite de retorno pós-atendimento (ideia do Juliano, 12/08/2026): na manhã SEGUINTE a um
-- atendimento concluído, a JuIA convida o cliente que não tem agendamento futuro a já deixar
-- o retorno reservado (mesmo dia da semana e horário, 4 semanas depois). No dia seguinte de
-- propósito: a pesquisa de satisfação e o pedido de avaliação já saem logo depois do
-- atendimento, e emendar mais uma mensagem no mesmo dia cansaria (decisão do Juliano).
-- Esta migration cria a tabela de controle e o cron diário da function return-invite-dispatch.
-- A resposta do cliente (1/2/3 ou texto livre) é interpretada pelo whatsapp-webhook.

create table if not exists public.return_invites(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  phone text not null,
  customer_name text,
  service_name text,
  service_price numeric,
  duration_minutes integer,
  suggested_date date,
  suggested_time time,
  -- sent:     convite enviado, aguardando resposta (o dispatch expira em 72h)
  -- accepted: cliente respondeu 1/sim — agendamento criado (ver result_booking_id)
  -- counter:  cliente quis outro dia OU mudou de assunto — a conversa segue com a JuIA
  -- declined: recusa explícita (2 seguidas = pausa de 60 dias sem novos convites)
  -- expired:  sem resposta em 72h, ou o cliente já tinha marcado por outro caminho
  -- skipped:  não enviado (skip_reason explica o porquê — auditável no banco)
  status text not null default 'sent' check (status in ('sent','accepted','counter','declined','expired','skipped')),
  skip_reason text,
  result_booking_id uuid references public.bookings(id) on delete set null,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists return_invites_phone_sent_idx on public.return_invites(phone, sent_at desc);
create index if not exists return_invites_status_idx on public.return_invites(status);

alter table public.return_invites enable row level security;
grant select on public.return_invites to authenticated;
grant select,insert,update,delete on public.return_invites to service_role;
drop policy if exists "admin read return invites" on public.return_invites;
create policy "admin read return invites" on public.return_invites
  for select to authenticated using (true);

-- Cron diário às 10h de Brasília (13h UTC — pg_cron roda em UTC). cron.schedule com o mesmo
-- jobname substitui o job existente, então re-rodar esta migration é seguro.
select cron.schedule(
  'bdj-return-invite-dispatch',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/return-invite-dispatch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
