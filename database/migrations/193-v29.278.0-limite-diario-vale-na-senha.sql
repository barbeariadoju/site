-- v29.278.0 (2ª parte) — o limite de 12 atendimentos por dia vale TAMBÉM na senha digital (pedido do Juliano,
-- 07/10/2026: "precisa por trava na senha digital, ela mesma pode dizer poxa hoje já lotou mas amanhã…").
-- A senha deixa de ser exceção; a function senha-digital confere antes (dia_lotado) e responde com o próximo
-- dia com vaga. Só o Juliano no painel (is_admin) segue podendo lançar acima do limite.
create or replace function public.bookings_limite_diario()
 returns trigger
 language plpgsql security definer
 set search_path to 'public'
as $$
begin
  if new.status not in ('pending', 'confirmed') then return new; end if;
  if tg_op = 'UPDATE' and new.booking_date is not distinct from old.booking_date
     and old.status in ('pending', 'confirmed', 'completed') then return new; end if;
  if public.is_admin() then return new; end if;
  if public.dia_lotado(new.booking_date, new.id) then
    raise exception 'Horário indisponível: a agenda de % já está completa (limite de % atendimentos no dia).',
      to_char(new.booking_date, 'DD/MM'), public.limite_atendimentos_dia();
  end if;
  return new;
end;
$$;
