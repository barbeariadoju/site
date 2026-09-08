-- 142 — v29.150.0 (08/09/2026) — Unifica o histórico de quem chegava sem o nono dígito
--
-- A v29.149.0 passou a canonizar o JID do WhatsApp na entrada do webhook (554688887777 →
-- 5546988887777, ver _shared/telefone-whatsapp.ts). A partir dali, esses clientes passam a
-- existir só no formato de 13 dígitos — mas o que já estava gravado com 12 ficaria órfão:
-- estado da conversa (pending_*), leads em follow-up e o histórico de mensagens que o painel
-- agrupa por telefone (mostraria a mesma pessoa em duas conversas).
--
-- Esta migração é de DADOS, não de esquema: move as linhas de 12 pra 13 dígitos. Onde as
-- duas versões já coexistiam em whatsapp_conversations (a de 13 nasceu dos upserts do
-- return-invite-dispatch, quase sempre com state vazio), a de 13 fica e herda da de 12 o
-- que faltava: state, takeover mais recente, última mensagem.
--
-- Só celular: 12 dígitos, começando em 55, com o número local iniciando em 6-9. Fixo não
-- ganha nono dígito. Mesma regra da function TS.

create or replace function public.canon_wa_phone(p text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when length(d) = 12 and d like '55%' and substr(d, 5, 1) between '6' and '9'
      then substr(d, 1, 4) || '9' || substr(d, 5)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;
grant execute on function public.canon_wa_phone(text) to service_role;

-- 1) whatsapp_conversations: funde gêmeas (13 herda da 12) e depois renomeia as solteiras.
update public.whatsapp_conversations t
   set state = case when t.state::text = '{}' then o.state else t.state end,
       human_takeover = case when coalesce(o.human_takeover_at, 'epoch') > coalesce(t.human_takeover_at, 'epoch') then o.human_takeover else t.human_takeover end,
       human_takeover_at = greatest(o.human_takeover_at, t.human_takeover_at),
       last_message_at = greatest(o.last_message_at, t.last_message_at),
       updated_at = now()
  from public.whatsapp_conversations o
 where o.phone <> public.canon_wa_phone(o.phone)
   and t.phone = public.canon_wa_phone(o.phone);

delete from public.whatsapp_conversations o
 where o.phone <> public.canon_wa_phone(o.phone)
   and exists (select 1 from public.whatsapp_conversations t where t.phone = public.canon_wa_phone(o.phone));

update public.whatsapp_conversations
   set phone = public.canon_wa_phone(phone), updated_at = now()
 where phone <> public.canon_wa_phone(phone);

-- 2) conversation_leads: sem gêmeas hoje (conferido), mas a regra cobre o caso.
delete from public.conversation_leads o
 where o.phone <> public.canon_wa_phone(o.phone)
   and exists (select 1 from public.conversation_leads t where t.phone = public.canon_wa_phone(o.phone));

update public.conversation_leads
   set phone = public.canon_wa_phone(phone), updated_at = now()
 where phone <> public.canon_wa_phone(phone);

-- 3) whatsapp_messages: o histórico inteiro passa pro telefone canônico (sem chave única).
update public.whatsapp_messages
   set phone = public.canon_wa_phone(phone)
 where phone <> public.canon_wa_phone(phone);
