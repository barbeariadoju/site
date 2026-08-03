-- Barbearia do Ju — v28.44.0
-- Central de Conteúdo (item novo, pedido do Juliano, 2026-08-02): geração diária de
-- rascunho de Status do WhatsApp com dados reais da agenda/serviços. Decisão explícita
-- do Juliano após avaliar o risco: NUNCA publica sozinho nesse número — o mesmo número
-- roda a JuIA, e publicar Status em horário fixo automaticamente cria um padrão de bot
-- fácil de detectar, arriscando suspensão do WhatsApp e derrubando o atendimento
-- automático junto. Todo rascunho fica pendente até aprovação humana explícita.

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'whatsapp_business' check (platform in ('whatsapp_business')),
  caption text not null,
  background_color text,
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','publicado','rejeitado')),
  source text not null default 'ia' check (source in ('ia','manual')),
  context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz,
  evolution_message_id text
);

comment on table public.content_posts is 'Rascunhos de Status do WhatsApp gerados pela Central de Conteúdo (IA) ou criados manualmente. Nunca publica sozinho — sempre exige status=aprovado (ação humana no admin) antes de virar publicado.';
comment on column public.content_posts.context is 'Dados reais usados pra gerar o rascunho (ex.: vaga aberta hoje, serviço em destaque) — guardado pra auditoria, nunca inventado.';

create or replace function public.touch_content_posts_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_posts_touch_updated_at on public.content_posts;
create trigger content_posts_touch_updated_at
before update on public.content_posts
for each row execute function public.touch_content_posts_updated_at();

alter table public.content_posts enable row level security;

drop policy if exists "admin_all_content_posts" on public.content_posts;
create policy "admin_all_content_posts" on public.content_posts
for all using (is_admin()) with check (is_admin());

revoke all on public.content_posts from public, anon;
grant select, update on public.content_posts to authenticated;
grant select, insert, update on public.content_posts to service_role;

-- RPC: pega o serviço em destaque do dia (rotaciona por dia do ano entre os serviços
-- ativos, pra não repetir sempre o mesmo) — usado pelo content-generate-daily quando
-- não há vaga urgente pra destacar. Preço/duração sempre reais de public.services.
create or replace function public.pick_featured_service()
returns table(name text, price numeric, duration_minutes int)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_total int;
  v_offset int;
begin
  select count(*) into v_total from public.services where active = true;
  if v_total = 0 then return; end if;
  v_offset := extract(doy from now() at time zone 'America/Sao_Paulo')::int % v_total;
  return query
    select s.name, s.price, s.duration_minutes
    from public.services s
    where s.active = true
    order by s.sort_order
    offset v_offset limit 1;
end;
$$;

revoke all on function public.pick_featured_service() from public, anon, authenticated;
grant execute on function public.pick_featured_service() to service_role;

notify pgrst, 'reload schema';
