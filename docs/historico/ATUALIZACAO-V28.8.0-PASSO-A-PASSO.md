# V28.8.0 — Lista de espera / encaixe + alerta de WhatsApp desconectado

## O que muda

**Lista de espera:**
- Nova tela **Lista de espera** (⏳) no menu do admin. Mostra quem está esperando vaga, com filtros por dia da semana, turno (manhã/tarde), semana e mês.
- No site, quando o cliente escolhe um dia que está cheio, aparece a opção **"Queria mesmo esse dia? Entrar na lista de espera"** — pede nome, WhatsApp, e-mail (opcional) e turno.
- Quando você cancela um agendamento (ou o cliente cancela pelo link dele), o sistema confere se tem alguém esperando aquele dia/horário e te avisa por notificação — com o nome da pessoa, pronto pra você chamar no WhatsApp.
- Na tela de Lista de espera, o botão **Encaixar** já cria o agendamento direto (você só escolhe data/horário e confirma).

**Alerta de WhatsApp:**
- Se a JuIA cair do WhatsApp (desconectar), você recebe um aviso por notificação e e-mail. Quando reconectar, avisa que voltou também.
- Isso te dá segurança pra **desligar as mensagens automáticas de saudação e de ausência do próprio WhatsApp Business** (a JuIA já faz esse papel, e agora você fica sabendo se ela cair). Essa parte de desligar é feita no aplicativo WhatsApp Business do seu celular (Configurações → Ferramentas comerciais), não tem nada pra fazer aqui no código.

## O que já foi feito no Supabase (não precisa repetir)

- Migration `039-v28.8.0-waitlist.sql` já aplicada (tabela `waitlist` criada).
- Funções `join-waitlist` (nova) e as atualizações em `notifications-watchdog`, `admin-booking-status` e `manage-booking` já publicadas.

## Como publicar o site

Só o commit/push de sempre — o GitHub Pages atualiza sozinho. Arquivos novos: `admin-espera.html`, `admin-espera-v28.js`. Alterados: `agendar.html`, `agenda-v15.js`, `style.css` e o menu das telas do admin.

## Um aviso importante

Durante os testes desta sessão, o Supabase (a pedido meu, pra verificar se a função de lista de espera estava funcionando) **enviou 2 notificações reais de teste pro seu celular/PC**, com nomes como "TESTE Lista de Espera" — eram só verificações técnicas, já apaguei os registros de teste do banco. Se você viu essas notificações e ficou com dúvida, era isso.

## Testar depois de publicar

1. No admin, abra **Lista de espera** — deve aparecer vazia (nenhum pedido ainda).
2. No site, escolha os serviços e tente marcar um dia que já esteja sem horários (ou peça pra alguém testar) — deve aparecer a opção de entrar na lista de espera.
3. Adicione alguém manualmente pela tela do admin (botão "＋ Adicionar à lista") pra ver o card aparecer com os filtros.
4. Quando quiser testar o aviso de vaga: cancele um agendamento de um dia em que exista alguém esperando — deve chegar uma notificação "🎉 Vaga aberta".
