-- get_advisors apontou notify_conversation_leads_slot_reopened() executável via RPC por
-- anon/authenticated (Postgres concede EXECUTE a PUBLIC por padrão em funções novas).
-- Na prática uma function RETURNS TRIGGER chamada fora de um trigger real já falha
-- sozinha ("trigger functions can only be called as triggers"), mas trava explícita
-- mesmo assim, mesmo padrão de hardening já aplicado no projeto (migration 047 etc.).
revoke all on function public.notify_conversation_leads_slot_reopened() from public, anon, authenticated;
