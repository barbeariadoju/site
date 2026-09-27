# V28.9.0 e V28.10.0 — Correções da JuIA + dois serviços novos

## O que muda

**Correções na JuIA (V28.9.0):**
1. Ela não pede mais o WhatsApp de novo quando a conversa já é pelo próprio WhatsApp — ela já sabe o número de quem está falando com ela.
2. Corrigida a mensagem contraditória (dizer "confirmado" e logo depois "ainda precisa confirmar") — era uma corrida entre duas mensagens do cliente chegando quase juntas.
3. Ela passou a entender "raspar a cabeça", "no zero", "com máquina/navalha" como pedido de corte.

**Dois serviços novos (V28.10.0), R$ 40 cada, 30 min:**
- **Raspar a cabeça** — com ou sem navalha.
- **Corte de cabelo infantil** — pensado pra passar confiança pros pais.

Aparecem no site (página de serviços e agendamento), no admin (Novo agendamento) e a JuIA já sabe oferecer os dois certinho.

## O que já foi feito no Supabase (não precisa repetir)

- Migration `040-v28.9.0-whatsapp-fixes.sql` já aplicada (nova coluna na tabela de conversas do WhatsApp).
- Funções `whatsapp-webhook`, `ju-ia-site`, `admin-booking-status`* e `manage-booking`* já publicadas com as correções.

*admin-booking-status e manage-booking foram atualizadas antes, no recurso da Lista de Espera (V28.8.0) — mencionado aqui só pra registro, nenhuma mudança nova neles.

## Como publicar o site

Só o commit/push de sempre. Arquivos alterados: `services-catalog-v7.js`, `servicos.html`, e o cache (`?v=`) do catálogo em 8 páginas do admin/site.

## Um aviso importante sobre os testes

Testei a JuIA de verdade (mandando mensagens direto pra função dela, sem passar pelo WhatsApp) pra confirmar as 3 correções e os 2 serviços novos — são chamadas que **não enviam nada pra ninguém**, só simulam a pergunta e leem a resposta da IA. Isso teve um custo pequeno de uso da API da OpenAI (a mesma que já é usada em produção), nada fora do comum.

Durante um dos testes, apareceu por 3 chamadas um erro passageiro "502" da infraestrutura da Supabase — recuperou sozinho em segundos e o sistema seguiu funcionando normalmente (confirmei nos logs).

## Testar depois de publicar

1. Mande uma mensagem pro WhatsApp da barbearia pedindo pra agendar — confira que a JuIA não pede seu WhatsApp de novo.
2. Peça "quero raspar a cabeça" — deve reconhecer como o serviço "Raspar a cabeça", R$ 40.
3. Pergunte "vocês cortam cabelo de criança?" — deve reconhecer "Corte de cabelo infantil", R$ 40.
4. No site (`agendar.html` ou `servicos.html`), confira que os dois serviços novos aparecem na lista.
