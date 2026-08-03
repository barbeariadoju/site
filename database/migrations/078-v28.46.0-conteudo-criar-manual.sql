-- Barbearia do Ju — v28.46.0
-- Central de Conteúdo: admin autenticado passa a poder CRIAR um rascunho manual pela
-- própria tela (antes só existia via SQL direto). RLS (is_admin()) já cobria "for all",
-- só faltava o GRANT de base pro papel authenticated — mesma lição do bug de
-- services/products na migration 058 (RLS sozinha não basta sem o GRANT).

grant insert on public.content_posts to authenticated;

notify pgrst, 'reload schema';
