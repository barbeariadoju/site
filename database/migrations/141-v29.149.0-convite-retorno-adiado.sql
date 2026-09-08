-- 141 — v29.149.0 (08/09/2026) — Convite de retorno adiado a pedido do cliente
--
-- Caso Pedro (08/09/2026, 10h21): respondeu ao convite de retorno "Decidir depois, me chama
-- daqui 14 dias". Nenhuma regra cobria "me chama daqui X dias"; a mensagem caiu na IA livre,
-- que respondeu que "não consegue iniciar uma mensagem daqui a 14 dias" — falso, e joga fora
-- um cliente que acabou de dizer quando quer voltar.
--
-- Agora o convite tem um quarto destino: 'deferred' (adiado). O webhook grava a data pedida
-- em remind_at e, no dia, o cron return-invite-dispatch (já existente, 10h, respeitando a
-- janela de contato) manda o lembrete e devolve o convite a 'sent' — daí em diante o fluxo
-- é o de sempre (1 = quero, 2 = agora não). reminded_at registra que o lembrete saiu.
-- Se o cliente marcar por conta própria antes do dia, o lembrete não sai (expired).

alter table public.return_invites
  add column if not exists remind_at date,
  add column if not exists reminded_at timestamptz;

alter table public.return_invites drop constraint if exists return_invites_status_check;
alter table public.return_invites add constraint return_invites_status_check
  check (status in ('sent','accepted','counter','declined','expired','skipped','deferred'));

create index if not exists return_invites_remind_idx
  on public.return_invites(remind_at) where status = 'deferred';

comment on column public.return_invites.remind_at is
  'v29.149.0: dia em que o cliente pediu pra ser chamado de novo (status deferred). O return-invite-dispatch manda o lembrete e volta o convite a sent.';
