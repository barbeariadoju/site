-- Execute UMA VEZ no SQL Editor do Supabase para corrigir o painel administrativo.
grant usage on schema public to authenticated;
grant select, update on table public.bookings to authenticated;

-- Recria as políticas sem erro caso o script seja executado novamente.
drop policy if exists "admin read" on public.bookings;
drop policy if exists "admin update" on public.bookings;
create policy "admin read" on public.bookings for select to authenticated using (true);
create policy "admin update" on public.bookings for update to authenticated using (true) with check (true);
