-- v29.233.1 (24/09/2026) — Lançamento do Clube do Ju em 01/10/2026, autorizado pelo Juliano
-- ("dia 01/10 pode disparar a mensagem automaticamente pra todos os clientes"). Aplicada como
-- clube_lancamento_01_10_2026. Quinta 01/10 às 08:00 de Brasília: abre as vendas, monta a fila
-- (club_fill_announcements: 192 clientes em 24/09) e liga o envio; o clube-ciclo manda ~12 por hora
-- das 9h às 19h. O job se desagenda sozinho.
create or replace function public.club_lancamento()
returns text language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if (timezone('America/Sao_Paulo', now()))::date <> date '2026-10-01' then
    perform cron.unschedule('bdj-clube-lancamento');
    return 'fora da data';
  end if;
  update public.club_settings set vendas_abertas = true, updated_at = now() where id = 1;
  n := public.club_fill_announcements();
  update public.club_settings set anuncio_ativo = true, updated_at = now() where id = 1;
  perform cron.unschedule('bdj-clube-lancamento');
  return format('vendas abertas; %s clientes na fila da mensagem', n);
end $$;
revoke all on function public.club_lancamento() from public, anon, authenticated;

select cron.unschedule('bdj-clube-lancamento') where exists (select 1 from cron.job where jobname = 'bdj-clube-lancamento');
select cron.schedule('bdj-clube-lancamento', '0 11 1 10 *', $cron$ select public.club_lancamento(); $cron$);
