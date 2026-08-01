-- Achado testando o item 4 (lista de espera pelo WhatsApp): join-waitlist sempre gravava
-- source='site' mesmo quando a entrada vinha do WhatsApp (a constraint só aceitava
-- 'site'/'admin'), então essas entradas apareciam com a etiqueta errada no admin. Adiciona
-- 'whatsapp' como valor válido — join-waitlist agora recebe o canal real do chamador.
alter table public.waitlist drop constraint waitlist_source_check;
alter table public.waitlist add constraint waitlist_source_check check (source = any (array['site','admin','whatsapp']));
