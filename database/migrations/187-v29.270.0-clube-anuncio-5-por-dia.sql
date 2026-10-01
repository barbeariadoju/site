-- v29.270.0 — Anúncio do Clube em conta-gotas, depois da restrição do WhatsApp de 01/10/2026.
-- 01/10 o lançamento mandou 50 mensagens frias em 4 horas (até 3 por rodada de 10 min) e o número foi
-- restringido por "mensagens automáticas ou em massa". Pedido do Juliano: 5 por dia, a base inteira em
-- um mês. Dois controles novos no club_settings:
--   anuncio_por_dia  — teto diário (o clube-ciclo manda 1 por rodada e espera ~1h50 entre uma e outra);
--   anuncio_a_partir — o envio só começa nesta data (quarentena depois da restrição).
alter table public.club_settings
  add column if not exists anuncio_por_dia integer not null default 5,
  add column if not exists anuncio_a_partir date;

-- As 10 que bateram na restrição não chegaram: voltam para a fila.
update public.club_announcements set status = 'fila', sent_at = null, error = null where status = 'falhou';

-- Ordem da fila: quem falou com a barbearia no WhatsApp mais recentemente vai primeiro (conversa
-- conhecida pesa menos que número frio); quem nunca escreveu fica para o fim.
with ult as (
  select a.phone_mkey,
         (select max(m.created_at) from public.whatsapp_messages m
           where m.direction = 'in' and right(m.phone, 8) = right(a.phone_mkey, 8)) as ultimo
  from public.club_announcements a where a.status = 'fila'
), ordem as (
  select phone_mkey, row_number() over (order by ultimo desc nulls last) as n from ult
)
update public.club_announcements a
   set queued_at = now() + make_interval(secs => o.n)
  from ordem o where o.phone_mkey = a.phone_mkey;

-- Liga já com a quarentena: começa em 09/10 (a restrição acaba ~13h de 02/10, e mais uma semana de uso
-- normal antes de voltar a abrir conversa).
update public.club_settings set anuncio_por_dia = 5, anuncio_a_partir = date '2026-10-09', anuncio_por_rodada = 1, anuncio_ativo = true where id = 1;
