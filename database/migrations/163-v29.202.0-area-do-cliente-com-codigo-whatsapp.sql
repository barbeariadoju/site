-- v29.202.0 (17/09/2026) — Área do cliente (cliente.html) só abre com código enviado pelo WhatsApp.
--
-- Auditoria de 17/09 (item 3 da decisão do Juliano, "vamos arrumar os três casos"): a RPC
-- get_public_customer_summary(telefone) era executável pelo anon e devolvia nome, pontos, último
-- serviço e PRÓXIMO HORÁRIO só com o número — quem soubesse o telefone de um cliente via quando ele
-- ia à barbearia. Agora: a Edge Function cliente-area manda um código de 6 dígitos pro WhatsApp do
-- número, o cliente digita, e só então a function (service_role) chama a RPC e devolve o resumo.
-- O anon perde EXECUTE na RPC; o site não a chama mais direto.
--
-- Anti-abuso: no máximo 3 códigos por telefone por hora e 1 a cada 60 s; 5 tentativas por código;
-- código vale 10 min; sessão (token) vale 12 h. Telefone sem cadastro recebe a MESMA resposta do
-- com cadastro ("se este número tiver cadastro, o código chega") — sem enumeração.

create table if not exists public.customer_area_otp (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null,
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  session_token text,
  session_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_area_otp_phone_key on public.customer_area_otp (phone_key, created_at desc);
create index if not exists idx_customer_area_otp_session on public.customer_area_otp (session_token) where session_token is not null;
alter table public.customer_area_otp enable row level security;
-- Sem policy de propósito: só service_role (Edge Function) lê e escreve.
revoke all on table public.customer_area_otp from anon, authenticated;
comment on table public.customer_area_otp is 'Códigos de acesso à área do cliente (cliente.html), v29.202.0. Só a function cliente-area toca.';

revoke execute on function public.get_public_customer_summary(text) from anon, public;
grant execute on function public.get_public_customer_summary(text) to service_role;

-- Limpeza: códigos com mais de 2 dias não servem pra nada.
select cron.unschedule(jobid) from cron.job where jobname = 'bdj-customer-area-otp-cleanup';
select cron.schedule('bdj-customer-area-otp-cleanup', '15 4 * * *', $cron$delete from public.customer_area_otp where created_at < now() - interval '2 days'$cron$);
