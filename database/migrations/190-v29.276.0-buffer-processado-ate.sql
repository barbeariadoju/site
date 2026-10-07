-- v29.276.0 — caso Samuel (07/10/2026, 06h26): "Sim" (06:26:04) reservou o horário; "Fica quanto tudo"
-- (06:26:11) chegou antes da resposta da reserva sair, e o webhook juntou de novo o "Sim" — que já tinha
-- sido respondido — ao texto novo. A JuIA leu "Sim / Fica quanto tudo" como sim à oferta da lavagem.
-- O webhook passa a gravar até onde já processou; as mensagens anteriores a isso não são juntadas de novo.
-- Tabela já existente: não precisa de GRANT novo (o aviso de 30/10/2026 vale só para tabela nova).
alter table public.whatsapp_conversations add column if not exists processed_until timestamptz;
