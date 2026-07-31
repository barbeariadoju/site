-- Barbearia do Ju — V28.29.1 (parte 2)
-- Advisor "Function Search Path Mutable": funções sem search_path fixo são
-- vulneráveis a um ataque onde alguém com permissão de criar objeto em outro
-- schema poderia "sequestrar" uma chamada não qualificada (ex. criando uma função
-- homônima em outro schema que entre antes de `public` na busca). Fixar o
-- search_path elimina esse vetor, sem mudar nenhum comportamento das funções.
alter function public.waitlist_touch_updated_at() set search_path = public, pg_temp;
alter function public.phone_match_key(p_phone text) set search_path = public, pg_temp;
alter function public.touch_contact_messages_updated_at() set search_path = public, pg_temp;
