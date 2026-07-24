# V28.7.0 — Relatórios do negócio (novo painel de leitura)

O que muda:

- Nova tela **Relatórios** no admin (ícone 📈 na barra lateral e um atalho na Visão geral). É uma tela **só de leitura** — não envia nenhuma mensagem e não altera nada no banco.
- Mostra o resumo do mês em uma tela só:
  - **Faturamento**, **atendimentos concluídos**, **ticket médio** (quanto cada cliente gasta em média), **clientes atendidos**, **taxa de satisfação** e **faltas** (quem não apareceu).
  - **Serviços mais vendidos** — ranking do que mais saiu no mês, com quantas vezes e quanto rendeu.
  - **Novos vs. recorrentes** — quantos clientes vieram pela primeira vez e quantos já tinham vindo antes.
  - **De onde vem o dinheiro** — quanto foi de serviços e quanto foi de produtos.
- Dá pra voltar meses com as setas **‹ ›** no topo para comparar. A seta de avançar fica desligada quando você já está no mês atual.

## Como publicar

**Não tem nada pra fazer no Supabase desta vez** — nenhuma migration nova, nenhum secret, nenhuma Edge Function. É só publicar os arquivos do site (o commit/push de sempre; o GitHub Pages atualiza sozinho).

Arquivos novos: `admin-relatorios.html` e `admin-relatorios-v28.js`.
Arquivos alterados: só o menu lateral das telas do admin ganhou o link "Relatórios" (e a Visão geral ganhou um atalho).

## Como as contas são feitas (pra não ter dúvida nos números)

- **Faturamento e ticket médio** contam apenas agendamentos marcados como **concluídos** — pendentes, confirmados e cancelados não entram.
- **Cliente recorrente** = já teve um atendimento concluído **antes** do mês que você está olhando. Se a primeira vez dele foi neste mês, ele conta como **novo**. Cada pessoa é contada uma vez, pelo telefone.
- **Taxa de satisfação** = dos clientes que **responderam** a pesquisa, quantos marcaram "satisfeito" (satisfeitos ÷ respostas). Ao lado, mostra quantas pesquisas foram enviadas e quantas voltaram.

## Testar

1. Entre no admin e clique em **Relatórios** (📈) no menu.
2. Confira que aparece o mês atual no topo e os números do mês (faturamento, atendimentos, ticket, clientes, satisfação, faltas).
3. Clique na seta **‹** pra ver um mês anterior e **›** pra voltar — a seta de avançar fica apagada no mês atual.
