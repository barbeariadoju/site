-- Barbearia do Ju — v28.45.0
-- Central de Conteúdo passa a suportar Facebook e Instagram (Meta Graph API), além do
-- Status do WhatsApp. Mesmo princípio de segurança do v28.44.0: nada publica sozinho,
-- sempre exige aprovação humana explícita no admin antes de virar 'publicado'.

alter table public.content_posts drop constraint if exists content_posts_platform_check;
alter table public.content_posts add constraint content_posts_platform_check
  check (platform in ('whatsapp_business', 'facebook', 'instagram'));

alter table public.content_posts add column if not exists meta_post_id text;
comment on column public.content_posts.meta_post_id is 'ID do post/mídia retornado pela Meta Graph API (Facebook Page post ID ou Instagram media ID) após publicação bem-sucedida.';

notify pgrst, 'reload schema';
