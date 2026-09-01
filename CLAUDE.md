# Barbearia do Ju — briefing do projeto

Leia antes de tocar em qualquer coisa. Cobre o estado atual, as decisões tomadas
e as armadilhas que já custaram retrabalho.

---

## 1. Confirme que você está no repositório certo

**Não confie em caminho escrito em documento.** O caminho muda de máquina para
máquina (o PC de casa e o notebook da barbearia usam pastas diferentes). O
identificador confiável é o remote:

```bash
git remote -v
# tem que apontar para: https://github.com/barbeariadoju/site.git
```

Outros sinais de que é o repo certo: existem `CHANGELOG.md`, `VERSAO.md`, a pasta
`agendar/` e um `package.json` com vitest e playwright.

⚠️ **Existem cópias antigas espalhadas** (arquivos de julho/2026, algumas
renomeadas para `_ARQUIVO-...-NAO-EDITAR`). Se o remote não bater, é cópia —
editar lá é trabalho perdido.

---

## 2. O negócio

Barbearia do Ju — Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista/SP.
Dono e único barbeiro: **Juliano Bruno Lopes Padilha**, farmacêutico
(especialista em Farmácia Clínica e Prescrição Farmacêutica, USF) e barbeiro.

Isso condiciona tudo: é **um barbeiro, um cliente por vez, terça a sábado**,
capacidade de ~215 atendimentos/mês. Estratégias desenhadas para resolver falta
de volume (escrever 50 artigos, campanha de massa) atacam um problema que ele não
tem. O gargalo é **ocupação das janelas vazias e ticket médio**, não tráfego bruto.

A dupla formação é o diferencial inimitável em Bragança. Use em conteúdo sobre
pele, couro cabeludo, composição de produto e segurança de química capilar.
**Não transforme o site em site médico**: a régua é "barbearia com conhecimento
técnico", e todo tema de saúde termina com encaminhamento ao dermatologista.

---

## 3. Como o projeto funciona

- Site estático, **sem build**. CSS dividido em `css/01..05`, agregado por
  `@import` no `style.css`.
- Publicação: `git push origin main` → GitHub Pages leva ~1 minuto.
  **Confirme no ar com curl** antes de dizer que está feito.
- Testes reais: `npm test` = 17 unit (vitest) + 46 e2e (playwright).
  **Rode sempre antes de publicar.**
- ⚠️ **Nunca** rode `npm run test:e2e:live` — grava no Supabase de produção.

Identificadores: GTM `GTM-T9KR76KB` · GA4 `G-4XZTP0550B` (propriedade `545112517`)
· Supabase project `rpkqluaxhqsxnewunhfm`.

---

## 4. Armadilhas que já custaram retrabalho

**Cache.** Ao alterar qualquer `.js` ou `.css`, **bumpe o `?v=`** nas páginas que
o carregam *e* no `style.css`. Já aconteceu de publicar código novo atrás de cache
velho: o evento simplesmente não existia na página em produção.

**Service worker.** O `sw.js` recarrega a página no `controllerchange`. Qualquer
coisa que leia parâmetro de URL precisa ser **idempotente** — o `?servico=`
somava o serviço duas vezes (2× Barboterapia, R$ 80) até ganhar guarda.

**Testes e2e.** Hook instalado via `page.evaluate()` morre nesse reload. Use
`addInitScript` + `sessionStorage` para capturar o `dataLayer`.

**Scripts de edição em massa.** Casar formato de linha falha em silêncio. A página
pilar ficou fora do sitemap por um dia porque o script imprimiu "adicionada" sem
ter adicionado. **Sempre confira a contagem depois.**

**Google Business Profile.** O upload de foto trava em qualquer automação (input
dentro de iframe, janela de arquivo nativa) — use o app no celular. E a interface
abre sozinha o overlay *"Escolha o elemento para o qual você está enviando
feedback"* quando o clique erra o alvo: **nunca interaja com ele**, recarregue.

---

## 5. Decisões que NÃO devem ser revertidas

Se uma auditoria apontar estes itens como pendência, a auditoria está errada.

- **Não criar landing pages por bairro ou cidade.** Um endereço, uma cidade, um
  barbeiro = seriam doorway pages, e a penalidade atinge o domínio inteiro.
- **Não autodeclarar `AggregateRating`** no schema. A nota vem do Google.
- **Não adicionar categorias secundárias no GBP.** "Barbeiro" e "Salão de beleza
  masculino" não existem na lista em português; as alternativas são falsas
  (Escola de barbearia, Loja de produtos para barbeiro) ou mais genéricas que a
  principal (Salão de Beleza). Categoria falsa é pior que categoria ausente.
- **Não remover as UTMs do link da postagem do GBP** (`utm_medium=gbp`). São
  intencionais: separam no GA4 o que veio de post do tráfego normal do Maps.
- **Não incluir `booking_confirmed` no regex do acionador de funil do GTM.** Ele
  já tem tag própria e entraria duplicado na conversão.
- **Não migrar as URLs do blog** para `/blog/slug/`. Custa redirect e risco sem
  ganho proporcional; breadcrumbs resolvem a maior parte.
- **Não reduzir as menções de "barboterapia" na home.** Das 10, só ~4 são texto
  visível; o resto é meta e schema, legítimos. Canibalização se resolve com link
  interno de âncora comercial, e já foi feito.
- **Não deixar somar dois serviços da mesma família num atendimento** (regra do
  Juliano, 22/08/2026): 1 corte + 1 barba; Barboterapia e Barba Express são
  alternativas; combos "Corte + X" já incluem a barba; pezinho já vem no corte.
  Única exceção: corte adulto + corte infantil (pai e filho). Fonte única:
  `assets/js/service-rules.js` (+ cópia TS em `supabase/functions/_shared/`).
- **Nenhuma mensagem para cliente leva emoji** (regra do Juliano, 01/09/2026): quem
  aparece como remetente do WhatsApp é ele, o cliente não sabe que quem responde é uma
  IA, e piscadinha entre homens é lida como outra coisa. Tom formal e cordial, simpatia
  na palavra escrita. Único permitido: 🙏, e só em agradecimento. Fonte única:
  `supabase/functions/_shared/sem-emoji.ts`, aplicado na SAÍDA de toda function que
  escreve no WhatsApp. Nunca aplicar na entrada — as regex que detectam emoji do cliente
  (👍, 🤝) precisam do texto original.
- **Barba Express é feita SÓ na máquina.** Navalha e toalha quente são da Barboterapia;
  a com vaporizador de ozônio é a mais completa. Toda oferta de barba (JuIA e site) sai
  com esse resumo entre parênteses. Já saiu errado uma vez, vendido a cliente
  (01/09/2026), porque o `sales_pitch` no banco dizia "com navalha no acabamento".
- **`admin-version.json` e a constante `ADMIN_VERSION` são separados de propósito**
  da versão do site. É o que decide o reload do painel aberto durante atendimento.

---

## 6. Estado do SEO (16/08/2026)

Feito e no ar: hub de serviços com 24 páginas, 0 páginas órfãs, página-mãe de
corte masculino, guia pilar da barba amarrando 7 artigos, 4 artigos com
referência de PubMed e ANVISA (com DOI), página de perguntas frequentes com 23
questões, bloco de avaliações reais na home, hero com preço e garantia na primeira
dobra, popup que deixou de bloquear o próprio CTA, pré-seleção de serviço por
`?servico=slug` e funil completo no GA4 (`clique_agendamento` →
`service_selected` → `checkout_step_horario` → `booking_confirmed`).

**O que ainda limita a nota, e não é código:**

- **Autoridade externa.** Nenhuma citação local foi criada. As cinco mais baratas
  seguem em aberto: Apple Business Connect, Bing Places, Solutudo, guiadebraganca
  e Facebook. É a maior alavanca parada.
- **Cadência no perfil.** Meta: 3 fotos + 1 post por semana, com pelo menos uma
  de ambiente (a foto do interior tem 2,21 mil visualizações, muito acima das de
  resultado).
- **Avaliações.** 81 hoje, nota 5,0, 100% respondidas. Meta de 15+/mês, alvo 200
  em 12 meses. O concorrente Fígaro tem 467 — é o principal gap competitivo.
  **Nunca** ofereça desconto ou brinde em troca de avaliação: viola diretriz.

⚠️ O recurso de **Perguntas e Respostas do GBP foi descontinuado** pelo Google em
03/11/2025. Não existe mais onde publicar; o conteúdo vive em
`perguntas-frequentes.html`, de onde a IA do Google puxa as respostas.

---

## 7. Como trabalhar aqui

- **Leia o código antes de afirmar que algo falta.** Uma auditoria feita por
  rastreamento externo apontou como pendências várias coisas que já estavam
  prontas: schema correto, imagens otimizadas, 23 páginas de serviço.
- Antes de publicar: `npm test`, validar JSON-LD, checar links quebrados e
  páginas sem link de entrada.
- Registre no `CHANGELOG.md` no estilo da casa: o que mudou, **por quê**, e o que
  foi decidido contra a recomendação óbvia, com o motivo.
- Referência científica: levante **na fonte** (PubMed, ANVISA) e cite com DOI.
  Nunca escreva citação de memória.
- Quando errar, diga. O CHANGELOG deste projeto registra os próprios erros de
  propósito — é o que evita repeti-los.
