# V28.7.1 — Relatórios: filtro por semana (terça a sábado)

O que muda:

- Na tela **Relatórios** agora tem um botão **Mês / Semana** no topo.
- Em **Semana**, o resumo considera de **terça a sábado** (os dias que você abre). As setas ‹ › andam de semana em semana; em **Mês**, de mês em mês.
- Serve pra você acompanhar de perto, sem esperar fechar o mês.

## Como publicar

**Nada no Supabase** — só front-end. É o commit/push de sempre (o site atualiza sozinho). Nenhuma migration, nenhum banco, nenhuma mensagem enviada.

Arquivos alterados: `admin-relatorios.html` e `admin-relatorios-v28.js`.

## Testar

1. Abra **Relatórios** no admin.
2. Clique em **Semana** — o topo deve mostrar algo como "21/07 a 25/07" e os números da semana.
3. Use as setas ‹ › pra ver semanas anteriores; volte pra **Mês** e confira que volta a andar de mês em mês.
