-- Barbearia do Ju — v28.47.0
-- Central de Conteúdo ganha Story do Facebook e do Instagram (além do feed já existente).

alter table public.content_posts drop constraint if exists content_posts_platform_check;
alter table public.content_posts add constraint content_posts_platform_check
  check (platform in ('whatsapp_business', 'facebook', 'instagram', 'facebook_story', 'instagram_story'));

notify pgrst, 'reload schema';
