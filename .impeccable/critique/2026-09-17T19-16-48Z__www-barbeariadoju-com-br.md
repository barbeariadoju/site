---
target: homepage www.barbeariadoju.com.br
total_score: 25
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 3
target_identity: "url:https://www.barbeariadoju.com.br/"
timestamp: 2026-09-17T19-16-48Z
slug: www-barbeariadoju-com-br
---
Method: dual-agent, com uma ressalva declarada (Assessment B não rodou como subagente separado — usei minhas próprias evidências de detector+navegador, já levantadas na auditoria técnica anterior nesta mesma conversa, para não gastar outra rodada completa de scan; Assessment A rodou isolado, sem ver nada da auditoria).

## Nota de saúde do design (heurísticas de Nielsen)

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 3/4 | Formulário de contato tem status `aria-live`; botão "Enviar" sem estado de carregamento visível |
| 2 | Correspondência com o mundo real | 4/4 | Linguagem PT-BR real, preços e prazos exatos, garantia sem exagero |
| 3 | Controle e liberdade do usuário | 3/4 | Banner de cookies tem opção "Somente essenciais" real; mas as barras fixas no mobile não têm como ser dispensadas |
| 4 | Consistência e padrões | 3/4 | "Agendar horário" aparece em 3 tratamentos visuais diferentes ao mesmo tempo no mobile |
| 5 | Prevenção de erros | 3/4 | Formulário tem `required`/`minlength`/honeypot; sem validação de formato de telefone no cliente |
| 6 | Reconhecimento em vez de memorização | 4/4 | Preço e horário repetidos em todo ponto onde importam |
| 7 | Flexibilidade e eficiência de uso | n/a | Página de conversão (modo Persuade), não uma ferramenta |
| 8 | Design estético e minimalista | 2/4 | Hero com pouco contraste sobre a foto de fundo; 3 elementos fixos empilhados no rodapé mobile |
| 9 | Ajuda a reconhecer/diagnosticar/recuperar de erros | 3/4 | `novalidate` empurra toda validação pro JS, não auditado ao vivo |
| 10 | Ajuda e documentação | n/a | Página de marketing — o FAQ cumpre esse papel bem |

**Total: 25/32 (2 n/a) — Bom** (78%, banda "Good")

## Veredito de especificidade de design

**LLM (Assessment A)**: autoral, não genérico — a prova é concreta: foto real da fachada com a placa de horário real pregada na parede, legendas de galeria específicas ("mullet moderno com low fade"), avaliações reais e atribuídas, a formação dupla do Juliano incorporada até no JSON-LD. Nenhum SaaS genérico chegaria a esse nível de detalhe.

**Scan determinístico (Assessment B)**: o detector confirma o mesmo padrão no texto/estrutura, mas aponta 12 dos 13 templates escaneados usando o vocabulário visual decorativo típico de interface gerada por IA (glow radial atrás do hero, chip "eyebrow" acima do H1, borda lateral colorida de 3px, sombra larga com borda fina) — floreios de CSS, não de conteúdo. Também achei um falso positivo real: 3 dos alertas de "baixo contraste" do detector mediram 2,3–2,4:1 num elemento que, medido de verdade via `getComputedStyle` na página ao vivo, tem 12–13:1 — o detector confunde a cor declarada no gradiente CSS com a cor efetivamente pintada atrás de blur/opacidade.

## Impressão geral

O conteúdo e a estrutura comercial (preço, garantia, prova social) são de longe o ponto mais forte — texto e prova social fazem o trabalho pesado de conversão muito bem. O que trava a nota é quase inteiramente técnico e concentrado no mobile: duas barras fixas de "Agendar" competindo entre si, mais o banner de cookies cobrindo os CTAs no primeiro carregamento. A maior oportunidade não é reescrever nada — é resolver a bagunça de elementos fixos no rodapé do celular, porque é lá que a maioria de quem clica em anúncio chega.

## O que está funcionando

1. **`rating-strip` logo abaixo do hero**: 5 estrelas, "Nota 5,0 no Google · mais de 100 avaliações", duas citações reais nomeadas, CTA "Avaliar no Google" — tudo num cartão compacto antes do fim da primeira dobra. Responde a objeção "isso é sério?" antes que o visitante a formule.
2. **Preço + garantia sempre juntos, com a mesma frase exata** em todo lugar que o preço aparece (hero, FAQ, card pré-visita) — remove qualquer dúvida de "essa garantia vale só pra um serviço?".
3. **A seção "Olá, eu sou Juliano" tem a contenção certa**: apresenta a dupla formação uma vez, com calma, sem virar prova médica — exatamente a régua que o CLAUDE.md pede.

## Achados prioritários

**[P0] Duas barras fixas de "Agendar" se sobrepõem no mobile, ao mesmo tempo**
Confirmei ao vivo em 375px: `.mobile-cta` (3 botões: Agendar/WhatsApp/Rota, fixo em `bottom:10px`, z-index 45, [css/01-site-base.css:345](css/01-site-base.css:345)) e `.mobile-agendar` (barra dourada cheia "✂️ Agendar horário", fixo em `bottom:0`, z-index 80, [css/02-site-interactions.css:546](css/02-site-interactions.css:546)) renderizam simultaneamente em qualquer largura ≤620px — que é a maioria dos celulares reais. Medi: `.mobile-cta` ocupa y=718–802, `.mobile-agendar` ocupa y=759–812 — 43px de sobreposição real, com a barra de cima cobrindo o terço inferior dos 3 botões de baixo. Resultado: a ação de agendar aparece 3 vezes na tela ao mesmo tempo (hero + 2 barras fixas), com uma delas fisicamente cortando a outra.
**Por que importa**: cada uma dessas barras existe pra facilitar o agendamento; competindo entre si, atrapalham mais do que ajudam, bem na zona onde o polegar do usuário naturalmente descansa.
**Correção**: manter só uma barra fixa (a dourada cheia lê melhor) e mover os links de WhatsApp/Rota pra dentro dela como ícones menores, ou pro fluxo de conteúdo.
**Comando sugerido**: `/impeccable adapt`

**[P0] Banner de cookies cobre os dois CTAs do hero no primeiro carregamento mobile**
(Já detalhado na auditoria técnica.) Some depois que o usuário decide, mas até lá bloqueia literalmente o primeiro passo do funil de agendamento — pra quem chega pela primeira vez, que é quem mais precisa ver o CTA rápido.
**Comando sugerido**: `/impeccable adapt`

**[P1] Texto do hero disputa espaço visual com a própria sinalização da foto de fundo**
O overlay do hero é `linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.74) 55%,#080808)` — só 18% de preto no topo, onde ficam o chip "BRAGANÇA PAULISTA • CENTRO" e o topo do H1. A foto da fachada tem texto branco de verdade (a placa "HORÁRIO DE ATENDIMENTO", a assinatura "BARBEARIA DO JU" gravada duas vezes) quase no mesmo peso visual do H1, sem `text-shadow` separando as camadas — no mobile dá um efeito de dupla exposição real (visível no screenshot: "CUIDAR DA SUA IMAGEM..." e "TERÇA A SEXTA 08h às 19h00" legíveis um sobre o outro).
**Correção**: escurecer o topo do gradiente (`.28`–`.35` em vez de `.18`) ou adicionar `text-shadow` ao título.
**Comando sugerido**: `/impeccable typeset`

**[P1] Dois grids de 10-11 links cada, sem sub-agrupamento**
"Acesso rápido" (11 cartões: agendamento, minha área, WhatsApp, e-mail, Instagram, mapa, avaliar, salvar contato, produtos, na-barbearia, vale-presente) e "Serviços em destaque" (10 cartões) — ambos violam bastante a regra de ≤4 opções por decisão, lado a lado, sem hierarquia entre "próxima ação" e "link de utilidade".
**Correção**: dividir em 2-3 sub-grupos rotulados (Agendar / Falar com a gente / Utilidades), ou reduzir pra uma fileira de ícones e mover o resto pro rodapé.
**Comando sugerido**: `/impeccable layout`

**[P1] Texto de consentimento LGPD do chat da JuIA: pequeno e com contraste insuficiente**
(Já detalhado na auditoria técnica — 9,5px, contraste 3,77:1, precisa 4,5:1, aparece em praticamente todo o site.)
**Comando sugerido**: `/impeccable typeset`

**[P2] H1 do hero e todo H2 de seção usam exatamente a mesma regra tipográfica**
`.hero h1,.section h2{font-family:'Bebas Neue'...font-size:clamp(2rem,5.5vw,4.2rem)}` — rolar da home não dá nenhum sinal tipográfico de "saiu do hero", só a posição de scroll e a cor de fundo avisam.
**Comando sugerido**: `/impeccable typeset`

## Alertas por persona

**Jordan (nunca agendou barbearia online antes)**: entra, vê "Agendar horário"/"Fale com o barbeiro" no hero — claro. Mas esbarra no banner de cookies cobrindo o hero, depois chega nos 21 links somados de "Acesso rápido" + "Serviços em destaque" sem saber qual é o próximo passo real. A resposta pra "atende sem hora marcada?" (que resolveria a dúvida dele de vez) está enterrada como pergunta 6 de 12 no FAQ.

**Casey (mobile, uma mão, pouca paciência)**: é quem mais sente o P0 — as duas barras empilhadas comem exatamente a zona onde o polegar dela descansa, mostrando "Agendar" duas vezes em estilos ligeiramente diferentes. Do lado positivo: os CTAs do hero são full-width no mobile (`@media(max-width:520px){.hero-actions .btn{width:100%}}`) e o `.floating` (botão extra de WhatsApp) já é escondido abaixo de 620px — alguém já pensou em não empilhar demais, o que faz o bug das duas barras parecer descuido, não decisão.

**Cliente típico do PRODUCT.md (homem de ~40 anos, Bragança Paulista, decidindo no intervalo do trabalho)**: vê preço e garantia batendo de cara — exatamente a "nenhuma surpresa no balcão" que importa pra ele. Mas é justamente o público de tela pequena que bate de frente no P0, e a exceção "pai e filho pode somar dois cortes" (regra do Juliano) não aparece em lugar nenhum da home — só depois de já ter decidido agendar, dentro do `/agendar/`.

## Observações menores

- Emoji como ícone de UI (✂️ 🪒 🎁 📅 ☕ 💌) por toda a home — não conflita com a regra `sem-emoji.ts` (que é só pra mensagem de WhatsApp do cliente), mas destoa um pouco do tom "formal e cordial" do texto.
- `alt` da galeria é específico de verdade ("Resultado real: low fade na régua com acabamento limpo"), não genérico — fácil de não notar, mas é acessibilidade bem feita.
- `:focus-visible` definido globalmente uma vez só, aplicado no site inteiro pela cadeia de `@import` — boa base de navegação por teclado.
- No screenshot mobile, o emoji 💬 (WhatsApp) dentro do botão do meio de `.mobile-cta` não renderizou (apareceu como um círculo branco vazio) — pode ser só do navegador de teste; vale conferir num celular de verdade.

## Perguntas provocativas

- Se o `rating-strip` já prova confiança rápido logo abaixo do hero, pra que serve o grid de 6 avaliações completas (`id="avaliacoes"`) na posição atual, depois do blog e do vale-presente — não funcionaria melhor como o fechamento da página, em vez de "horário de funcionamento"?
- As duas barras fixas do mobile fazem sentido cada uma isoladamente — alguém chegou a testar as duas juntas num celular de verdade, ou cada uma foi validada só contra o próprio breakpoint?
