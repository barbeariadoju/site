-- 128 — v29.65.0 (22/08/2026) — "Cliente já avaliou no Google" marcado no Concluir
--
-- Pedido do Juliano: um clique no modal de concluir que grava no cadastro que o cliente
-- já avaliou no Google, pra nunca mais pedir avaliação pra ele. O clique grava
-- customer_profiles.google_reviewed / google_reviewed_at / google_review_declared_at
-- (admin-booking-status, body.mark_google_reviewed).
--
-- Esta função é a única checagem que o webhook usa antes de mandar o link do Google
-- (whatsapp-webhook, pesquisa "1 = satisfeito"). Antes só contava quem tinha clicado no
-- NOSSO link (experience_requests.google_clicked_at) — o flag do perfil, que é onde o
-- "1 = já avaliei" do WhatsApp e agora o clique do admin gravam, era ignorado.
create or replace function public.customer_already_reviewed(p_customer_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.experience_requests
    where customer_id = p_customer_id and google_clicked_at is not null
  ) or exists(
    select 1 from public.customer_profiles
    where id = p_customer_id and (google_reviewed or google_review_declared_at is not null)
  )
$$;
