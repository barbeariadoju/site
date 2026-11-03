-- v29.337.0 (caso Bruno, 03/11/2026) — comprovante corrigido quando o atendimento muda DEPOIS do Concluir.
--
-- O Juliano concluiu o atendimento como "Corte de cabelo" e trocou para "Corte + Barba Express" 23 s
-- depois. O banco ficou certo (R$ 80), mas o cupom de R$ 50 já estava no WhatsApp do cliente. Pedido
-- dele: o comprovante sai de novo, sozinho, sempre que um atendimento concluído for alterado.
--
-- O gatilho só pede o reenvio; quem decide é o satisfaction-dispatch ({reenvio:true}): espera 20 s,
-- confere se nada mudou de novo (vários ajustes seguidos = um comprovante só), se o cupom original
-- já saiu (senão o envio normal já leva o valor certo) e respeita a mesma janela de horário do Concluir.
-- A tabela não tem updated_at automático, então o gatilho é BEFORE e carimba receipt_changed_at:
-- é esse carimbo que a function compara para saber se veio outro ajuste depois.
-- Só olha os campos que aparecem no cupom; trocar observação interna ou horário não reenvia nada.

alter table public.bookings add column if not exists receipt_changed_at timestamptz;

create or replace function public.bookings_comprovante_corrigido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'completed' and new.status = 'completed'
     and new.booking_date >= current_date - 1
     and (new.service_name, new.service_price, new.products_price, new.selected_products, new.payment_method,
          new.products_payment_method, new.discount_amount, new.discount_reason, new.tip_amount, new.courtesy,
          new.loyalty_discount, new.credit_amount, new.client_note)
         is distinct from
         (old.service_name, old.service_price, old.products_price, old.selected_products, old.payment_method,
          old.products_payment_method, old.discount_amount, old.discount_reason, old.tip_amount, old.courtesy,
          old.loyalty_discount, old.credit_amount, old.client_note)
     and exists (select 1 from public.experience_requests e where e.booking_id = new.id and e.sent_at is not null)
  then
    new.receipt_changed_at := clock_timestamp();
    perform net.http_post(
      url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/satisfaction-dispatch',
      headers := jsonb_build_object('Content-Type','application/json',
        'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='bdj_email_webhook_secret' limit 1)),
      body := jsonb_build_object('reenvio',true,'booking_id',new.id,'updated_at',new.receipt_changed_at),
      timeout_milliseconds := 60000
    );
  end if;
  return new;
end;
$$;

revoke all on function public.bookings_comprovante_corrigido() from public, anon, authenticated;

drop trigger if exists trg_bookings_comprovante_corrigido on public.bookings;
create trigger trg_bookings_comprovante_corrigido
  before update on public.bookings
  for each row execute function public.bookings_comprovante_corrigido();
