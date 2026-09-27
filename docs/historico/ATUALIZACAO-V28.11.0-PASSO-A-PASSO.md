# V28.11.0 — JuIA menos "chata" + você pode agendar fora do horário

## O que muda

**1. A JuIA para de mandar mensagem redundante.** Quando você assume uma conversa no WhatsApp e depois de 2 minutos sem responder ela volta a atender — ela mandava um "Oi! Ainda estou por aqui..." mesmo quando a conversa já tinha acabado (cliente só respondeu com uma figurinha ou "valeu!"). Agora ela reconhece isso e fica quieta, sem mandar mensagem à toa.

**2. Você (admin) pode agendar fora do horário de funcionamento.** Apareceu uma caixinha nova **"Permitir fora do horário de funcionamento"**:
- Na tela **Novo agendamento**.
- No **Encaixar** da tela **Lista de espera**.

Marcando essa caixinha, você consegue marcar antes das 8h, depois das 19h (ou 15h de sábado), ou até domingo/segunda. **Só funciona porque é você, logado como admin** — o site e a JuIA continuam só oferecendo o horário normal pros clientes, sem exceção. E mesmo com a caixinha marcada, se aquele horário já tiver um bloqueio seu ou outro agendamento, continua não deixando — a ideia é só abrir o horário, não criar choque de agenda sem querer.

## O que já foi feito no Supabase (não precisa repetir)

- Migration `041-v28.11.0-admin-fora-do-horario.sql` já aplicada.
- Função `whatsapp-reactivation-watchdog` já publicada com a correção.

## Como publicar o site

Só o commit/push de sempre. Arquivos alterados: `admin-agendamento.html`, `admin-v15-4.js`, `admin-espera.html`, `admin-espera-v28.js`, `style.css`.

## Testar depois de publicar

1. Vá em **Novo agendamento**, marque a caixinha e tente um horário fora do normal (ex.: domingo) — deve deixar salvar.
2. Sem marcar a caixinha, tente de novo fora do horário — deve continuar bloqueando como sempre.
3. A correção da JuIA só dá pra perceber com o uso normal do WhatsApp ao longo dos próximos dias — não tem uma tela pra conferir na hora.
