# Auditoria e Plano de Consolidação SEO — Barbearia do Ju
**Data:** 24/07/2026

## 1. Diagnóstico técnico (o que mudou)

O plano original suspeitava de bloqueio técnico (robots.txt travando o Google). **Não é o caso.** Auditoria ao vivo do site confirmou:

| Item | Status | Detalhe |
|---|---|---|
| `robots.txt` | ✅ OK | `Allow: /`, só bloqueia páginas de admin. Sem `Disallow: /` geral. |
| `sitemap.xml` | ✅ OK | Publicado, referenciado no robots.txt, 6 URLs públicas. |
| Meta `robots` (home) | ✅ OK | `index, follow` |
| Canonical | ✅ OK | Correto em todas as páginas públicas checadas, incluindo o caso mais delicado (`servicos.html` → canoniza pra `/agendar/` evitando conteúdo duplicado) |
| Redirects | ✅ OK | `http://` → `https://` (301) e domínio sem `www` → `www` (301), confirmado via headers ao vivo |
| Schema.org / JSON-LD | ✅ OK | `LocalBusiness` completo já implementado no `index.html` (endereço, telefone, horário, serviços, redes sociais) |
| Hospedagem | GitHub Pages | Confirmado via header `Server: GitHub.com` (não Netlify — o `_headers` no repo é resquício sem efeito, pode ser ignorado) |
| `whatsapp.html` / `instagram.html` | 🔧 Corrigido nesta sessão | Eram páginas de redirecionamento sem `noindex` — o Google podia indexar essas páginas "vazias" e diluir a relevância das páginas de conteúdo real. Adicionado `<meta name="robots" content="noindex,follow">` nas duas. |

**Conclusão:** a causa da não-indexação não é técnica — é que **o site nunca foi apresentado ao Google** (Search Console nunca configurado) e o domínio é novo/sem autoridade (poucos ou nenhum link externo apontando pra ele). O guia visual entregue junto (Search Console + Google Meu Negócio) resolve a primeira causa; o plano de backlinks abaixo ataca a segunda.

## 2. Arquivos alterados nesta sessão
- `whatsapp.html` — adicionado `noindex,follow`
- `instagram.html` — adicionado `noindex,follow`

Nenhuma outra alteração de código foi necessária: `robots.txt`, `sitemap.xml` e o Schema JSON-LD já estavam corretos.

**Sugestão de commit:**
```
fix(seo): noindex em páginas de redirecionamento (whatsapp/instagram)
```

## 3. Guia Search Console + Google Meu Negócio
Guia visual passo-a-passo publicado como artifact (link enviado no chat). Cobre: verificação de propriedade, envio do sitemap, solicitação de indexação das páginas principais, e checklist priorizado do Google Meu Negócio.

## 4. Rascunhos de blog (3 artigos)

> O site hoje não tem seção de blog. Estes são **rascunhos de conteúdo** pra revisão — quando aprovar o texto, me avise que eu monto as páginas HTML no estilo do site (mesmo padrão simples de `privacidade.html`) e adiciono ao `sitemap.xml`.

---

### Artigo 1 — Barboterapia: o que é e por que vale a pena

**Meta description sugerida:** Entenda o que é a barboterapia, quais são os benefícios pra pele e pra barba, e quando vale a pena incluir no seu corte.

A barboterapia é um tratamento completo pra barba que vai muito além de aparar os fios. Na Barbearia do Ju, o processo combina toalha quente, esfoliação, óleos específicos e massagem facial — pensado pra quem quer cuidar da barba com a mesma seriedade que cuida do cabelo.

**O que acontece durante o atendimento**
O primeiro passo é a aplicação de toalha quente, que abre os poros e amacia os fios, deixando a pele mais receptiva aos produtos aplicados depois. Em seguida vem a esfoliação, que remove células mortas e ajuda a prevenir pelos encravados — um dos problemas mais comuns de quem tem barba cheia. Por fim, óleos e cremes específicos hidratam tanto o fio quanto a pele por baixo dele.

**Por que a pele agradece**
Muita gente cuida só do "de cima" — corta, apara, penteia — e esquece que embaixo da barba tem pele, e ela também precisa de cuidado. Pele ressecada sob a barba causa coceira, caspa de barba e vermelhidão. A barboterapia ataca exatamente esse ponto.

**Com que frequência fazer**
Pra quem tem barba média a cheia, o ideal é intercalar a barboterapia com os cortes normais — a cada 3 a 4 semanas costuma manter o resultado sem pesar no bolso. Quem está deixando a barba crescer se beneficia ainda mais nesse período, porque é quando a pele mais sofre com o crescimento dos fios.

Quer sentir a diferença? Agende sua barboterapia na Barbearia do Ju, em Bragança Paulista.

---

### Artigo 2 — Barba encravada e ressecada: como evitar

**Meta description sugerida:** Pelos encravados e barba seca têm causa e solução conhecidas. Veja o que fazer no dia a dia e o que só a barbearia resolve.

Se a sua barba coça, resseca ou vive com pelos encravados, o problema quase sempre está em três pontos: fio cortado errado, falta de hidratação e falta de esfoliação. Nenhum dos três se resolve só com paciência.

**Por que o pelo encrava**
O pelo encravado acontece quando o fio, ao crescer, se curva e entra de volta na pele em vez de sair reto — comum em barbas mais cacheadas ou quando o corte é feito rente demais, contra o sentido natural do fio. Esfoliar a região regularmente ajuda a "abrir caminho" pro fio crescer pra fora.

**Cuidados no dia a dia**
- Lave a barba com produto próprio, não só com sabonete de corpo — a pele do rosto é mais sensível.
- Use óleo ou balm de barba depois do banho, quando o poro ainda está aberto.
– Escove a barba (mesmo curta) pra distribuir o óleo por igual e treinar o fio a crescer na direção certa.
- Evite secar com toalha esfregando — resseca e irrita.

**O que só o profissional resolve**
Quando já existe encravamento ativo ou a pele está irritada, esfoliação amadora pode piorar. Nesses casos, o ideal é uma barboterapia completa (veja o artigo acima) feita por quem entende a curva de cada fio.

---

### Artigo 3 — Produtos profissionais x produtos caseiros pra barba

**Meta description sugerida:** Óleo de barba, balm e produtos genéricos de supermercado: entenda as diferenças e quando cada um faz sentido.

É comum o cliente perguntar: "preciso mesmo de óleo de barba, ou serve o hidratante que já uso no rosto?" A resposta curta é que serve, mas não resolve o mesmo problema.

**O que muda na formulação**
Produtos genéricos de corpo e rosto são formulados pra pele lisa. Óleo e balm de barba são pensados pra dois alvos ao mesmo tempo: o fio (que é queratina, como o cabelo) e a pele por baixo dele. Um creme comum hidrata a superfície, mas não penetra no fio nem chega direito na pele coberta pela barba.

**Óleo x balm: qual usar**
- **Óleo de barba:** absorve rápido, ideal pra barbas curtas a médias e pro dia a dia.
- **Balm:** tem mais corpo, ajuda a modelar barbas maiores e segura os fios rebeldes, além de hidratar.

**Quando o produto caseiro é suficiente**
Pra barba bem rala ou por poucos dias sem fazer a barba, um hidratante comum não faz mal. O problema aparece com o tempo: barba que cresce e nunca recebe produto específico tende a ficar opaca, quebradiça e mais propensa a caspa de barba.

Na Barbearia do Ju trabalhamos com produtos profissionais e também vendemos as linhas que usamos no atendimento — pra manter o cuidado em casa entre uma visita e outra.

---

## 5. Plano de backlinks — próximos 30 dias

**Semana 1 — Diretórios e perfis próprios**
- [ ] Google Meu Negócio (prioridade máxima — já cobre no guia acima)
- [ ] Facebook Business (página com endereço, telefone e link pro site idêntico ao GMB)
- [ ] Bing Places for Business (bing.com/places) — verificação rápida, pouca gente faz e ajuda no Bing/Copilot
- [ ] Apple Maps Connect (mapsconnect.apple.com) — grátis, indexa no Maps da Apple/Siri

**Semana 2 — Diretórios locais e de nicho**
- [ ] Guia Bragança Paulista / portais de notícia e comércio local da cidade (pesquisar "guia comercial Bragança Paulista")
- [ ] Diretórios de barbearias e salões (ex.: portais tipo "encontre uma barbearia perto de você" — validar quais aceitam cadastro gratuito)
- [ ] Foursquare / Waze (cadastro de local comercial)

**Semana 3 — Link do próprio ecossistema**
- [ ] Bio do Instagram → link direto pro site (ou pro `/agendar/`)
- [ ] Destaque fixo nos Stories linkando o site
- [ ] Assinatura de e-mail (se usar) com link do site
- [ ] WhatsApp Business: campo "site" preenchido com a URL

**Semana 4 — Avaliações e prova social**
- [ ] Pedir avaliação no Google pra clientes recentes satisfeitos (o fluxo de `avaliacao.html` já existe no site — reforçar o convite verbalmente no balcão)
- [ ] Responder todas as avaliações existentes, boas e ruins
- [ ] Considerar parceria de troca de menção com um negócio local complementar (ex. barbearia + loja de roupas masculinas da região) — um linka o outro nas redes/site

**Contínuo**
- Cada novo conteúdo do blog vira um post de Instagram com link na bio — gera tráfego direto e sinaliza atividade pro Google.

## 6. Itens do plano original — status final

| # | Item | Status |
|---|---|---|
| 1 | robots.txt e bloqueios | ✅ Verificado, sem bloqueio — nada a corrigir |
| 2 | Search Console | 📋 Guia entregue, ação depende do Juliano (login Google) |
| 3 | Google Meu Negócio | 📋 Checklist entregue, ação depende do Juliano (login Google) |
| 4 | Conteúdo local (blog) | ✍️ 3 rascunhos prontos pra revisão, acima |
| 5 | Schema markup | ✅ Já implementado (LocalBusiness completo) — nada a fazer |
| 6 | Backlinks | 📋 Plano de 30 dias entregue, acima |
| 7 | Canônico e redirects | ✅ Verificado, tudo correto |
