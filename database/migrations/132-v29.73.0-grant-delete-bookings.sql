-- v29.73.0 — botão "Excluir registro" do admin dava "permission denied for table bookings":
-- a policy RLS "admin delete cancelled bookings" (is_admin() + status='cancelled') existe
-- desde sempre, mas o GRANT de DELETE pra authenticated nunca foi dado — Postgres checa o
-- grant ANTES da policy. service_role idem (faltava DELETE). De quebra, revoga TRUNCATE
-- de anon/authenticated (TRUNCATE ignora RLS; ninguém do site/admin precisa disso).
grant delete on public.bookings to authenticated;
grant delete on public.bookings to service_role;
revoke truncate on public.bookings from anon;
revoke truncate on public.bookings from authenticated;
