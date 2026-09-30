-- v29.266.0 (30/09/2026) — Clube do Ju: cobrança automática no cartão (API de Pagamentos Recorrentes).
--
-- O PagBank liberou a recorrência em produção em 30/09 (chamado 1450423315). A assinatura com cartão
-- nasce com payment_method = 'cartao_auto' (o CHECK já aceitava desde a 171) e guarda aqui o que
-- precisa para conferir as faturas e cancelar do lado do PagBank. Número e CVV do cartão NUNCA chegam
-- ao banco: o cartão é criptografado no navegador; só a bandeira e os 4 últimos dígitos ficam.

alter table public.club_subscriptions
  add column if not exists pagbank_plan_id text,
  add column if not exists pagbank_cancelled_at timestamptz,
  add column if not exists card_brand text,
  add column if not exists card_last4 text;

alter table public.club_charges
  add column if not exists pagbank_invoice_id text;
create unique index if not exists club_charges_invoice_uniq on public.club_charges (pagbank_invoice_id) where pagbank_invoice_id is not null;

-- Contrato v3 = v2 + cobrança automática no cartão (cláusulas 3.2, 3.5 e 12.2).
insert into public.club_terms (version, sha256, url)
values ('v3', 'b316b7f82e7669095544dad6833fe83f38a1524e72a67382d434f945d727ad94', 'https://www.barbeariadoju.com.br/clube/contrato/v3.txt')
on conflict (version) do nothing;
update public.club_settings set terms_version = 'v3', updated_at = now() where id = 1;

-- Registro das chamadas à API de recorrência (é o que o PagBank pede na validação final). Cartão
-- criptografado, CVV e CPF saem mascarados antes de gravar.
create table if not exists public.club_pagbank_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  subscription_code text,
  method text not null,
  url text not null,
  status integer,
  request jsonb,
  response jsonb
);
create index if not exists club_pagbank_log_at_idx on public.club_pagbank_log (at desc);
alter table public.club_pagbank_log enable row level security;
drop policy if exists club_pagbank_log_admin_read on public.club_pagbank_log;
create policy club_pagbank_log_admin_read on public.club_pagbank_log for select to authenticated using (public.is_admin());
grant select on public.club_pagbank_log to authenticated;
grant all on public.club_pagbank_log to service_role;

notify pgrst, 'reload schema';
