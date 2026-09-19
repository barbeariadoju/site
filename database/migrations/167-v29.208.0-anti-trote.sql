-- v29.208.0 (19/09/2026) — Anti-trote (caso Luiz, 19/09: agendou pelo site, número sem
-- WhatsApp, e-mail estranho, ligação não completa, não veio).
--
-- 1) bookings.whatsapp_unreachable_at: a confirmação do agendamento (booking-email) não
--    entrou no WhatsApp. O sinal já existia (notification_log 'whatsapp_fallback_email' —
--    1 em 80 nos últimos 60 dias) mas ninguém era avisado. Agora o painel mostra no cartão e o
--    Juliano recebe push. NÃO bloqueia: existe cliente de verdade sem WhatsApp.
-- 2) blocked_customers.customer_email: bloqueio passa a valer também pelo e-mail. O guard de
--    INSERT em bookings confere telefone OU e-mail (mesma regra: só barra site/JuIA; admin passa).

alter table public.bookings add column if not exists whatsapp_unreachable_at timestamptz;
alter table public.blocked_customers add column if not exists customer_email text;

create or replace function public.is_customer_blocked_v2(p_phone text, p_email text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.blocked_customers b
    where (p_phone is not null and b.customer_phone is not null
           and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone))
       or (nullif(trim(p_email), '') is not null and b.customer_email is not null
           and lower(trim(b.customer_email)) = lower(trim(p_email)))
  );
$$;
revoke all on function public.is_customer_blocked_v2(text, text) from public, anon;

create or replace function public.bookings_block_guard()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if coalesce(new.channel, 'site') in ('site', 'juia_whatsapp')
     and not public.is_admin()
     and public.is_customer_blocked_v2(new.customer_phone, new.customer_email) then
    raise exception 'cliente_bloqueado';
  end if;
  return new;
end;
$$;

update public.blocked_customers set customer_email = 'luizinhosinuca123321@gmail.com'
where customer_phone = '11931786046' and customer_email is null;
update public.bookings set whatsapp_unreachable_at = created_at
where id = 'f97c2cca-13e5-4da5-8ff0-8d6f70e1081f' and whatsapp_unreachable_at is null;
