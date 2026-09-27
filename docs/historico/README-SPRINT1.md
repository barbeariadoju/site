# Barbearia OS — Sprint 1

## Alterações
- Fresha removido de toda a experiência pública.
- Horário oficial alinhado: terça a sexta 08:00–19:00; sábado 08:00–15:00.
- Formulário duplicado removido da página de serviços.
- GTM e scripts duplicados corrigidos em agendar.html.
- Popup de boas-vindas limitado a uma vez a cada 30 dias.
- Vídeo configurado com `preload="none"` para evitar o download antecipado e melhorar o carregamento em redes móveis.
- CORS das funções `ju-ia-site` e `ju-ia-admin` restrito ao domínio oficial.
- Novo Modo Atendimento no painel e no PWA.

## Banco
Execute `database/migrations/014-sprint1-official-hours.sql`.
