# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Homens de Bragança Paulista/SP e região que buscam corte de cabelo e barba com
hora marcada, atendidos por um único barbeiro (sem fila, sem rodízio de
profissional). O cliente típico valoriza previsibilidade de preço e horário,
ambiente limpo/organizado, e reconhece — mesmo sem buscar por isso — que quem o
atende tem formação técnica incomum para o setor.

## Product Purpose

Site institucional + sistema de agendamento (não é e-commerce, não é blog
genérico) para a Barbearia do Ju: apresentar os serviços, converter visita em
agendamento (`/agendar/`), e sustentar SEO local (23 páginas de serviço, guias
de barba, FAQ) para quem pesquisa barbearia em Bragança Paulista. Sucesso =
ocupar as janelas vazias da agenda e subir o ticket médio de quem já agenda —
não aumentar tráfego bruto (capacidade é ~215 atendimentos/mês, terça a
sábado, um barbeiro só).

## Positioning

Juliano Bruno Lopes Padilha é farmacêutico (especialista em Farmácia Clínica e
Prescrição Farmacêutica, USF) **e** barbeiro — dono e único profissional. Essa
dupla formação é o diferencial que nenhum concorrente em Bragança pode copiar
de verdade, e é usada em conteúdo sobre pele, couro cabeludo, composição de
produto e segurança de química capilar. A régua deliberada é "barbearia com
conhecimento técnico", não site médico: todo tema de saúde termina com
encaminhamento ao dermatologista, nunca com diagnóstico ou tratamento.

## Operating Context

- Endereço único: Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista/SP.
  Terça a sábado, um barbeiro, um cliente por vez — nunca landing page por
  bairro/cidade (seria doorway page).
- Preços fixos e visíveis (corte R$ 40, barba na navalha R$ 40, combo R$ 80 —
  sobem em 01/10/2026, ver `CHANGELOG.md`), sem surpresa no balcão.
- Regra das famílias de serviço: nunca somar dois serviços da mesma família
  num atendimento (1 corte + 1 barba; Barboterapia e Barba Express são
  alternativas entre si; pezinho já vem no corte). Fonte única:
  `assets/js/service-rules.js`.
- Site estático sem build (CSS em `css/01..05` agregado por `@import` em
  `style.css`), publicado via GitHub Pages atrás de Cloudflare (proxy, CSP,
  cache de borda ~10 min em CSS/JS). Agendamento e área do cliente rodam sobre
  Supabase; atendimento assistido por WhatsApp (Evolution API + IA, endereços
  e credenciais fora do repo).
- Cadastro já existe em Google Business Profile, Apple Business Connect, Bing
  Places, Solutudo, Guia de Bragança e Facebook — o trabalho pendente é
  consistência de NAP, não criação de novas citações.

## Capabilities and Constraints

- Confirmado: agendamento online com pré-seleção de serviço (`?servico=slug`,
  idempotente), funil de conversão completo no GA4/GTM
  (`clique_agendamento` → `service_selected` → `checkout_step_horario` →
  `booking_confirmed`), 23 páginas de serviço, guia pilar de barba amarrando 7
  artigos, FAQ com 23 perguntas, avaliações reais na home.
- Restrição técnica: qualquer serviço externo novo (pixel, embed, CDN, API
  chamada do navegador) precisa entrar na Content-Security-Policy do
  Cloudflare antes de ir pro ar, senão o navegador bloqueia em silêncio.
- Restrição técnica: mudança em `.js`/`.css` exige bump do `?v=` nas páginas
  que carregam o arquivo e no `style.css` — cache de borda não invalida
  sozinho.
- Indecidido/explicitamente fora de escopo: migrar URLs do blog para
  `/blog/slug/` (não vale o custo de redirect); reduzir menções textuais de
  "barboterapia" na home (canibalização já resolvida por link interno).

## Brand Commitments

- Nome: Barbearia do Ju. Tom: formal e cordial, nunca superlativo ("a melhor
  barbearia") — sempre esforço + prova verificável (nota, nº de avaliações).
- Nenhuma mensagem para cliente leva emoji (único permitido: 🙏, só em
  agradecimento) — quem assina o WhatsApp é o Juliano, não uma marca visível
  de IA. Fonte única: `supabase/functions/_shared/sem-emoji.ts`.
- Barba Express é feita só na máquina; navalha e toalha quente são exclusivas
  da Barboterapia. Toda oferta de barba repete esse resumo.
- Nunca autodeclarar `AggregateRating` no schema (a nota vem do Google);
  nunca adicionar categorias secundárias falsas no GBP.

## Evidence on Hand

- Nota 5,0 no Google, 108 avaliações em 17/09/2026 (era 81 em 16/08), 100%
  respondidas — texto e prova reais, não fabricados. Meta 200 em 12 meses;
  concorrente direto (Fígaro) tem 467.
- 4 artigos com referência de PubMed/ANVISA (DOI) já publicados; toda citação
  científica nova precisa ser levantada na fonte, nunca de memória.
- Depoimento real na home (ex.: "Barbearia muito bem arrumada, limpa e
  organizada..."), preços claros na primeira dobra, garantia declarada no
  hero.
- Sem referência visual/paleta pendente de confirmação — o sistema visual
  incumbente (`css/01..05`) é a autoridade até uma decisão explícita de
  redesign.

## Product Principles

1. O gargalo é ocupação de agenda e ticket médio, não volume de tráfego —
   toda proposta de "mais conteúdo" ou "mais alcance" precisa justificar como
   isso enche uma janela vazia específica, não só trazer visita.
2. A dupla formação farmacêutico+barbeiro é o ativo de posicionamento; usar
   sem virar site médico, e sempre fechar tema de saúde com encaminhamento
   profissional externo.
3. Confiança se prova, não se declara: preço fixo, nota real do Google,
   depoimento real, garantia explícita — nunca superlativo nem métrica
   inventada.
4. Mudança técnica no site vive num ecossistema com mais peças que o
   repositório (Cloudflare CSP, cache de borda, Supabase, WhatsApp) — uma
   peça nova precisa ser registrada nas outras antes de ir pro ar.

<!-- Fatos derivados do CLAUDE.md do projeto (briefing interno, checked into
o repo) e do código/copy existentes (package.json, index.html). Nenhuma
pergunta ao usuário foi necessária: a evidência do repositório já respondia
com força suficiente aos gaps que o passo 3 do init pede para checar. -->
