-- Barbearia do Ju — V28.9.0
-- Trava de processamento por telefone: evita que duas mensagens do WhatsApp chegando
-- quase ao mesmo tempo sejam processadas em paralelo, lendo o estado da conversa
-- antes uma da outra terminar (causava respostas contraditórias, ex.: "confirmado"
-- seguido de "ainda precisa ser confirmado no sistema").

alter table public.whatsapp_conversations
  add column if not exists processing_locked_until timestamptz;

notify pgrst, 'reload schema';
