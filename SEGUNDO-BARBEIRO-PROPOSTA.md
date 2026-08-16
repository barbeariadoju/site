# Segunda cadeira: modelo 50/50 e o sistema que sustenta isso

Proposta escrita em 15/08/2026 a pedido do Juliano ("pensar juntos"), com base em como o
mercado brasileiro faz (Barba na Hora, Barbeiro.app, BarberCode, Frizzar, BestBarbers) e nos
dados reais da Barbearia do Ju. **Nada aqui está implementado** — é o desenho para decidir e
depois construir. Decisões que são do dono estão marcadas ⚖️.

---

## 1. O que o mercado faz (e onde a sua ideia se encaixa)

| Prática de mercado | O padrão | O seu caso |
|---|---|---|
| Faixa de comissão | 40–50% do que o profissional fatura; 45–55% para sênior; 50–60% para quem traz carteira própria | **50%** — no topo da faixa, coerente com "ele só executa, você dá toda a estrutura" |
| Base de cálculo | Quase todo mundo calcula sobre o **bruto** (mais simples, mas o dono absorve a taxa do cartão sozinho) | **Você quer sobre o líquido** — menos comum, mais justo, e exige que o sistema saiba a taxa de cada meio de pagamento |
| Produtos vendidos | Comissão **menor**, 10–20% (a margem do produto é diferente da do serviço) | ⚖️ definir — sugerido 15% |
| Frequência de pagamento | Semanal (o barbeiro prefere, dá mais controle), quinzenal (mais comum) ou mensal | **Semanal, toda segunda** — combina com o fechamento da semana |
| Maior fonte de briga | Cálculo manual em caderno/planilha: "cria desconfiança" | Por isso o sistema precisa mostrar **o mesmo número para os dois**, em tempo real |

**A lição mais repetida nas fontes:** a comissão não gera conflito pelo percentual — gera pela
**falta de transparência**. Um barbeiro que consegue ver, no próprio celular, o que fez e
quanto vai receber, não questiona o fechamento de segunda-feira.

---

## 2. A matemática do 50/50 líquido

Regra: **líquido = valor do serviço − taxa do meio de pagamento**. Metade para cada um.

| Meio de pagamento | Taxa aprox. | Corte de R$ 40 | Barbeiro | Você |
|---|---|---|---|---|
| Dinheiro | 0% | R$ 40,00 | R$ 20,00 | R$ 20,00 |
| Pix (chave) | 0% | R$ 40,00 | R$ 20,00 | R$ 20,00 |
| Pix (API PagBank) | ~0,99% | R$ 39,60 | R$ 19,80 | R$ 19,80 |
| Débito | ~1,99% | R$ 39,20 | R$ 19,60 | R$ 19,60 |
| Crédito à vista | ~3,50% | R$ 38,60 | R$ 19,30 | R$ 19,30 |

O sistema já tem `finance_fee_rates` (migration 098/099) — é ela que alimenta esse cálculo,
por meio de pagamento. **A taxa nunca é digitada na mão no fechamento**: sai do registro do
atendimento.

### As regras dos casos especiais — recomendação fechada (16/08/2026)

O Juliano pediu recomendação, não cardápio. Segue o que eu defenderia, com o porquê. O
princípio que orienta tudo: **o barbeiro nunca perde dinheiro por causa de um benefício que
quem decidiu dar foi a casa.** Benefício que ele não escolheu, ele não financia — senão ele
passa a torcer contra o próprio programa (deixa de estimular fidelidade, "esquece" de
oferecer o pezinho, empurra o vale pra outro dia).

| Situação | Recomendação | Por quê |
|---|---|---|
| **Fidelidade (10º grátis)** | A casa paga **integral**: ele recebe 50% do valor cheio, como se o cliente tivesse pago | O programa é ferramenta de retenção **sua**. Custo real: 1 em 10 atendimentos ≈ **5% do faturamento dele** em comissão sobre serviço não faturado. É o preço do programa, e é previsível. Se ele "perde" no 10º, ganha incentivo a sabotar a fidelidade |
| **Vale-presente** | Comissão **normal na execução**, sobre o valor do serviço | O dinheiro entrou antes, mas o trabalho é agora. E a taxa é zero (Pix), então é 50/50 limpo — inclusive melhor pra ele que crédito |
| **Ajuste sem custo (7 dias)** | **Sem comissão** — e a regra é: **ajuste é sempre de quem cortou** | É retrabalho, custo de qualidade de quem executou. Se por indisponibilidade o outro tiver que fazer, aí sim a casa paga 50% a quem executou (ninguém deve consertar corte alheio de graça) |
| **Pezinho cortesia** | **Sem comissão**, mas **registrado** como atendimento e só em horário vago | É rápido (5–10 min) e traz o cliente de volta — quem ganha com isso é a casa e ele, no próximo corte. Reavaliar em 60 dias com o volume real: se virar peso na agenda dele, vira valor fixo simbólico |
| **Produto vendido** | ✅ **DECIDIDO (16/08): 50% do lucro líquido** — `(preço de venda − custo do produto − taxa do meio de pagamento) ÷ 2` | Mais generoso que o mercado (10–20% da venda) e mais justo: ele ganha metade do que a operação realmente lucra, igual ao serviço. **Exige cadastrar o custo de cada produto** — sem isso o sistema não sabe calcular (ver seção 5) |
| **Desconto no balcão** | ✅ **DECIDIDO (16/08): não existe desconto.** Preço de tabela, ponto | Decisão do Juliano: *"se colocar desconto vira bagunça"*. Simplifica o sistema (não existe campo de desconto pra ninguém), elimina a auditoria mais chata e acaba com qualquer discussão de rateio sobre valor reduzido |
| **Isenção por insatisfação** | ✅ **DECIDIDO (16/08): só o Juliano isenta**, e o sistema pergunta o motivo: **(a) cortesia/insatisfação** → a casa absorve e o barbeiro **recebe normal**; **(b) refação de serviço dele** → sem nova comissão | O Juliano já isentou cliente quando errou, e vai continuar podendo. A separação por motivo é o que mantém a justiça: erro da casa não sai do bolso dele, e refação do próprio trabalho não é atendimento novo |
| **Falta do cliente (no-show)** | Ninguém recebe, mas **registra por profissional** | Não é culpa dele, mas se as faltas se concentrarem na agenda dele, é um sinal (confirmação, atraso, atendimento) que só aparece com dado |
| **Gorjeta** | **100% de quem atendeu**, fora do rateio | Gorjeta é do trabalho, não da estrutura. Entrar no rateio azeda rápido |
| **Produto usado no serviço** (pomada, toalha, lâmina) | Custo **integral da casa**, nunca descontado dele | Já está no combinado "você dá tudo". Descontar insumo depois é o clássico que quebra a confiança |
| **Assinatura** | ✅ **DECIDIDO (16/08): 50% sobre o valor recebido por atendimento do plano**, não sobre o preço de tabela. `valor do plano ÷ nº de atendimentos = valor do atendimento` | Confirmado pelo Juliano: *"se o cliente paga 70 por 2 cortes, logo recebemos 35 por corte"* → R$ 17,50 pra ele. É o único jeito de a conta não virar prejuízo com assinante intenso. **O sistema calcula sozinho** a partir do plano do cliente — o barbeiro nunca precisa saber de qual plano é |
| **De quem é o cliente** | ✅ **DECIDIDO (16/08): o cliente é da barbearia.** Vira política escrita e cláusula contratual (8ª e 9ª da minuta) | Todo cliente é captado pela marca, pelo marketing e pelo sistema da casa. Isso não é só discurso: a base de clientes é do CNPJ (inclusive para a LGPD), o agendamento passa só pelos canais oficiais, e o contrato veda extrair a base e aliciar clientes ⚖️ (prazo de 6 ou 12 meses a definir) |

---

## 3. O módulo do barbeiro (acesso restrito)

Princípio: **ele vê o trabalho dele e o dinheiro dele. Nada mais.** Nenhum acesso a CRM
completo, Financeiro da casa, relatórios gerais, marketing, conteúdo ou configurações.

**Telas (5, só o essencial):**
1. **Minha agenda** — dia/semana, só os atendimentos dele. Bloquear horário pessoal.
2. **Novo agendamento** — encaixar cliente na cadeira dele (walk-in incluso).
3. **Atendimento / check-out** — concluir, registrar serviços + produtos + meio de pagamento.
   É o passo que alimenta a comissão; sem check-out não há comissão calculada.
4. **Meus ganhos** — semana corrente: atendimentos, bruto, taxas, líquido, consumos
   descontados, **quanto ele recebe na segunda**. Histórico dos fechamentos anteriores. É esta
   tela que elimina a desconfiança.
5. **Meus consumos** — ele registra o que pegou (bebida do frigobar, produto para uso pessoal).
   O sistema calcula pelo preço de venda menos a comissão dele, dá baixa no estoque e desconta
   no fechamento. Transparente para os dois e sem constrangimento de "pedir" toda vez.

**O que ele NÃO pode fazer** (regra técnica, não confiança): ver dados de clientes de outros
profissionais, cancelar/editar atendimento já fechado, alterar preços do catálogo, aplicar
desconto acima do limite, ver faturamento da casa.

**Formato:** o mesmo Barbearia OS que já existe, instalado como app no celular dele (o admin
já é PWA). Não é um app separado — é o mesmo sistema com o menu filtrado pelo papel. Menos
código para manter, e ele nunca vê um item de menu que não pode abrir.

### Gerenciar equipe: entrar em 2 minutos, sair em 1 clique

Pedido literal do Juliano: *"eventualmente vem um cara, não dá certo, troco por outro — preciso
ter a segurança que com um clique eu exclua tudo o que ele acessa, e com muita facilidade
inclua outro"*. Isso vira a aba **Equipe** no admin:

- **Adicionar profissional**: nome, apelido que aparece pro cliente, e-mail de acesso,
  percentuais (serviço/produto), dias e horários que ele atende. O sistema cria o acesso e
  manda a senha provisória. ~2 minutos.
- **Primeiro acesso = aceite do contrato** (decisão do Juliano em 16/08): antes de qualquer
  tela de trabalho, ele lê o **Contrato de Parceria** integral (rolagem obrigatória até o
  fim), **assina com o dedo** na tela, tira uma **foto de conferência**, marca "li e concordo"
  e só então o módulo abre. O sistema guarda assinatura, foto, data/hora, IP, dispositivo e o
  **hash do texto do contrato** (prova de que o documento não mudou depois), e manda a via
  dele por WhatsApp/e-mail. Minuta e detalhes técnicos: `CONTRATO-PARCERIA-MINUTA.md`.
  ⚠️ Nomear como *foto de conferência*, **nunca** reconhecimento facial — biometria é dado
  sensível na LGPD e traz exigências que não precisamos assumir.
- **Desativar (o botão de pânico)**: um clique e o acesso morre **na hora** — as regras de
  segurança do banco (RLS) passam a negar tudo em nome dele, a sessão aberta no celular dele
  para de funcionar na próxima ação, e o nome dele some do site e da JuIA.
- **O que NÃO some**: o histórico de atendimentos, comissões e fechamentos dele. Isso é
  registro financeiro — você vai precisar dele para conferência, contabilidade e para saber
  quanto aquela cadeira rendeu. **"Cortar o acesso" e "apagar os dados" são coisas diferentes,
  e só a primeira deve ser de um clique.**
- **Transferir agenda** (o detalhe que evita a dor de cabeça): ao desativar, o sistema
  pergunta o que fazer com os agendamentos futuros dele — passar pra você, passar pro
  substituto, ou avisar os clientes para remarcar. Sem isso, sair um barbeiro no meio da
  semana vira telefonema para cada cliente.
- **Reativar / substituir**: cadastrar o próximo é o mesmo fluxo de 2 minutos. A cadeira
  continua existindo; muda quem senta nela.

---

## 3.5. Auditoria por câmera + IA: por que eu NÃO recomendo, e o que faz o mesmo trabalho melhor

O Juliano propôs (16/08) usar as câmeras IP para uma IA contar atendimentos e identificar
serviços, cruzando com a agenda para "validar a honestidade do cara" — especialmente nos dias
em que ele não estiver presente (segundas, viagens). **A necessidade é absolutamente legítima.
A solução por vídeo é a mais arriscada possível — e, ironicamente, a menos eficaz.**

**Por que é arriscada:**

1. **Destrói o contrato de parceria.** Fiscalizar produtividade por câmera é um dos indícios
   mais fortes de **subordinação** — o elemento central do vínculo empregatício. Todo o esforço
   das Cláusulas 2ª e 8.5 (autonomia, câmera só para segurança patrimonial) vai por água abaixo
   se existir um sistema que monitora quantos cortes ele fez e a que horas. Numa reclamação
   trabalhista, isso não é um detalhe: é **a prova** de que ele era fiscalizado como empregado.
2. **LGPD.** Câmera para segurança patrimonial tem base legal tranquila. Processar imagem por
   IA para inferir atividade de uma pessoa identificada é **outra finalidade**, com outro nível
   de exigência — e ainda envolve os **clientes**, que foram filmados sem imaginar que sua
   imagem seria analisada por um sistema. Isso é risco jurídico com terceiro inocente no meio.
3. **É cara, frágil e não prova nada.** Distinguir "corte + barba" de "corte + sobrancelha" em
   vídeo, com ângulo de câmera de segurança, exige visão computacional bem treinada — e ainda
   assim erra. E o erro é caro nos dois sentidos: acusar um profissional honesto por leitura
   errada da IA destrói a relação; e quem quiser fraudar aprende o ângulo cego em uma semana.

**O que resolve de verdade: fechar a torneira do dinheiro, não vigiar o barbeiro.**

O risco real não é ele "atender e não registrar" — é **receber por fora**. E isso morre com
controles que o sistema já tem ou terá:

| Controle | Como fecha a brecha |
|---|---|
| **Pagamento 100% centralizado** | Pix cai na **sua** chave, cartão na **sua** maquininha, dinheiro no caixa. Ele nunca recebe do cliente. Sem isso, nenhuma câmera adianta; com isso, quase nenhuma fraude é possível sem o cliente ser cúmplice |
| **Conciliação automática** | Extrato do Pix + maquininha **×** atendimentos registrados no sistema. Sobra dinheiro sem atendimento? Falta atendimento com dinheiro? O sistema aponta — todo dia, sem depender de olho humano |
| **Comprovante automático ao cliente** | Ao concluir, o cliente recebe no WhatsApp o resumo do atendimento (já temos a Evolution). Atendimento não registrado = cliente sem mensagem = ele estranha. É a auditoria mais barata que existe, feita por quem esteve lá |
| **Avaliação pós-atendimento** | Já existe no sistema (v27). Cliente avaliando confirma que foi atendido, quando e por quem |
| **Estoque conferido** | Produto que sai sem venda registrada aparece na contagem (ver seção 5) |
| **Câmera como está** | Continua ligada, para **segurança**. Se um cruzamento acusar algo concreto, você consulta aquele dia específico. Isso é investigação pontual, não vigilância — e é perfeitamente defensável |

**Proposta concreta: "Painel de Integridade" na aba Equipe.** Um quadro diário que cruza sozinho
agenda × check-outs × recebimentos × avaliações × estoque, e levanta a mão só quando algo não
bate: atendimento concluído sem pagamento, recebimento sem atendimento, horário com movimento
de caixa e agenda vazia, produto que sumiu do estoque sem venda, cliente que não recebeu
comprovante. **Você olha exceções, não vídeos.** Leva minutos por semana, funciona igual quando
você está viajando, é barato e não cria um único indício de subordinação.

### A versão que EU faria (escopo reduzido — decisão do Juliano em 16/08)

O Juliano reduziu o pedido depois do alerta: *"nem que fosse pra IA analisar quantas pessoas
sentaram na cadeira, isso já me daria segurança... é pra meu controle, não usaria isso
juridicamente"*. **Com esse escopo, muda tudo — e dá para fazer bem.** Contar ocupação é
métrica de operação; classificar serviços executados por uma pessoa identificada é vigilância
de desempenho. A distância entre as duas coisas é toda a diferença jurídica.

**As quatro condições que tornam isso seguro:**

1. **A saída é número, não imagem.** A IA responde apenas *"a cadeira X foi ocupada N vezes
   hoje, nestes horários"*. Nada de reconhecimento facial, identificação de cliente,
   classificação de serviço ou avaliação de tempo de execução por pessoa.
2. **Mede as DUAS cadeiras — inclusive a sua.** Essa é a mitigação mais importante e a mais
   barata: se o painel mostra a ocupação de todas as estações, incluindo a do dono, o sistema é
   **indicador operacional do negócio** (como contador de fluxo de loja), não fiscalização de um
   profissional. Medir só a cadeira dele é o que descaracterizaria.
3. **Processamento local, não em nuvem.** Ver "como fazer" abaixo — é mais barato, e imagem de
   cliente que não sai do estabelecimento é exposição que não existe.
4. **Segue valendo o que o contrato diz** (Cláusula 8.5): câmeras existem para segurança, e as
   imagens não são usadas para controle de jornada ou avaliação de desempenho. A contagem
   agregada é indicador de ocupação do espaço — e é assim que deve ser tratada e nomeada,
   inclusive na conversa com ele.

**⚠️ O alerta honesto que preciso deixar registrado:** o Juliano diz — e eu acredito — que não
usaria isso juridicamente. Mas numa eventual reclamação **quem usa a existência do sistema é o
outro lado**: "ele monitorava meus atendimentos por câmera". Não é o uso que ele faria; é o uso
que fariam contra ele. Por isso as condições 1 e 2 não são detalhe de implementação — são o que
sustenta a resposta "isso é indicador de ocupação das estações, aplicado igualmente a todas,
inclusive à minha".

**Como fazer, na prática (e barato):**

| Etapa | Recomendação | Por quê |
|---|---|---|
| Detecção | **Recurso nativo da câmera** (people counting / linha virtual / zona de detecção — Intelbras, Hikvision e Dahua têm) ou **Frigate** (open source) num mini PC no local | Já resolve "pessoa entrou na zona da cadeira". Custo zero ou muito baixo |
| Processamento | **Local**, no próprio equipamento/mini PC. A imagem é analisada e descartada; sai só o evento | Imagem de cliente não trafega nem fica armazenada em serviço externo. Menos custo, menos risco de LGPD |
| Envio | Webhook/MQTT do detector → uma Edge Function nova (`chair-events`) → tabela `chair_occupancy` (estação, horário do evento) | Padrão que o sistema já usa (o webhook do PagBank funciona assim) |
| Uso | O **Painel de Integridade** cruza: ocupações detectadas × atendimentos registrados, **por estação e por faixa de horário** | Diferença consistente vira alerta discreto. Diferença pontual é ruído (cliente que só esperou sentado, alguém que sentou pra conversar) — o painel precisa mostrar tendência, não incidente |

**Expectativa realista:** a contagem vai errar para mais (gente que senta e não é atendido) e
ocasionalmente para menos. Ela serve como **indicador de tendência** — "a cadeira foi ocupada
consistentemente mais vezes do que os atendimentos lançados, três semanas seguidas" —, nunca
como acusação de um dia específico. E, como o Juliano mesmo disse, a ação diante de um padrão
ruim é agradecer e encerrar a parceria, o que o contrato já permite com 30 dias de aviso.

**Nuvem:** se ainda quiser gravação em nuvem (útil para segurança, se levarem o gravador), use
o serviço do próprio fabricante com **retenção curta** (7–15 dias) e acesso só seu. Mas a
**análise** não precisa de nuvem — e é melhor que não passe por lá.

⚖️ Decisão sua, agora com o escopo certo: **contagem de ocupação por estação, processada
localmente, aplicada a todas as cadeiras** — isso eu implemento tranquilo, e é o que dá a
segurança que você quer sem trocar um risco pequeno por um grande.

## 3.6. O cliente da porta e o dinheiro em espécie (o ponto mais sensível de todos)

O Juliano identificou com precisão onde mora o risco (16/08): *"meu medo não é ele dar um
migué no pessoal que vem da agenda, mas no pessoal que vem da porta"*. Está certíssimo — o
walk-in é o único atendimento que **não deixa rastro antes de acontecer**. Ninguém marcou,
ninguém confirmou, o cliente não existe no sistema.

E aí veio a proposta: *"atendimento em dinheiro ele já pode ficar com o recebido, a ser
descontado do total da semana"*. **A intenção é ótima (menos dinheiro parado, menos dependência
de você estar presente), mas do jeito puro ela remove justamente o controle do walk-in:**

1. **Junta oportunidade e incentivo no mesmo ato.** Cliente da porta + dinheiro na mão + "esse
   dinheiro já é meu" = o único cenário em que não registrar o atendimento não dói em nada.
   Todos os outros controles (conciliação de extrato, comprovante ao cliente) **dependem do
   registro**; sem registro, não existe nada para conciliar.
2. **Inverte o fluxo contra você.** Numa semana com muito dinheiro, ele pode reter mais do que
   a cota-parte dele — e no fechamento **você vira credor**, cobrando de quem já gastou.
3. **Fragiliza o modelo do salão-parceiro.** A Lei nº 13.352/2016 estrutura a parceria sobre a
   **centralização dos recebimentos pelo salão** (Cláusula 4.1 do contrato). Dinheiro que nunca
   passa pelo caixa enfraquece exatamente o que sustenta a tese de que não há vínculo.

### O desenho que dá a mesma praticidade sem abrir a brecha

| Camada | Como funciona | Por que resolve |
|---|---|---|
| **1. Pix como padrão, inclusive no balcão** | O sistema gera o **Pix copia e cola com o valor exato** (mesma tecnologia do vale-presente, v29.25.0) ou QR na bancada. Cai direto na sua conta | Hoje a maioria paga por Pix. Isso sozinho tira o dinheiro da equação em boa parte dos walk-ins |
| **2. Registrar na chegada, não no fim** | Cliente da porta entra no sistema **antes** de sentar (20 segundos: nome + telefone + serviço). O check-out só fecha o que já existe | Registro deixa de ser burocracia pós-atendimento e vira a porta de entrada. Some o "esqueci de lançar" |
| **3. O cliente vira o auditor (sem saber)** | Placa no balcão: *"Todo atendimento gera um comprovante no seu WhatsApp. Não recebeu em 5 minutos? Avise: (11) 96707-3038"* | Genial pela simplicidade: atendimento não registrado = cliente sem mensagem = você fica sabendo. E, para o cliente, isso não parece controle — parece capricho |
| **4. Dinheiro com teto** | Ele **pode reter dinheiro**, sim — desde que **o atendimento esteja registrado no ato** e até o limite da **cota-parte já acumulada na semana**. O excedente vai pro cofre/envelope, também registrado | Dá a praticidade que o Juliano quer, mantém o registro como condição inegociável e nunca deixa você na posição de credor |
| **5. Fechamento acerta a diferença** | O extrato semanal já traz "retido em espécie" como adiantamento. Se reteve menos que a cota, recebe a diferença no Pix de segunda; se reteve o limite, o acerto é zero | Simples de conferir, sem discussão |

**A regra em uma frase, para o contrato e para a conversa com ele:** *"Reter dinheiro é
permitido; deixar de registrar o atendimento, não."* O que o sistema controla é o **registro** —
o dinheiro é só a forma de adiantar a cota-parte.

⚠️ **Se ainda assim você quiser liberar dinheiro sem teto**, dá para fazer — mas então
implemente antes as camadas 1, 2 e 3, que são as que realmente protegem o walk-in.

## 4. A sua tela de auditoria e fechamento

**Aba "Equipe" no admin**, com:

- **Fechamento semanal (segunda-feira)**: por barbeiro — nº de atendimentos, bruto, taxas
  por meio de pagamento, líquido, comissão de serviços, comissão de produtos, descontos
  concedidos, **total a pagar**. Um botão "Fechar semana" que congela o período, gera o
  registro e monta o **Pix copia e cola** com o valor exato (a mesma tecnologia do
  vale-presente da v29.25.0 — você só cola no banco).
- **Histórico de fechamentos**: semana, valor, data do pagamento, comprovante anexado.
  Fica o rastro para os dois lados.
- **Auditoria do dia a dia**: atendimentos concluídos sem pagamento registrado, descontos
  acima do limite, atendimentos editados depois de fechados, faltas por profissional,
  ticket médio por profissional, taxa de retorno dos clientes dele.
- **Comparativo**: você × ele — ocupação da cadeira, ticket médio, receita por hora.
  Serve para decidir se a segunda cadeira se paga.

---

## 5. O trabalho técnico (a parte que muda o motor)

**A mudança grande não é a comissão — é a agenda.** Hoje o sistema assume **um** profissional:
a disponibilidade de horário é global. Com duas cadeiras, tudo que consulta horário livre
precisa passar a considerar **por profissional**.

Ordem sugerida:

1. **Migration `staff`**: profissionais (nome, apelido público, ativo, `commission_percent`,
   `product_commission_percent`, `user_id` do Supabase Auth). Você entra como staff também —
   os relatórios ficam justos desde o primeiro dia.
2. **`bookings.staff_id`** + backfill de todos os agendamentos existentes para você.
3. **Motor de disponibilidade por profissional** — `get_available_slots` e o fluxo do site
   passam a receber `staff_id`. No site: "com qualquer profissional" (padrão, mostra a união
   dos horários) ou escolher. É o item de maior risco de regressão: os testes e2e existentes
   (26 no admin) precisam cobrir os dois profissionais.
4. **RLS por staff**: o barbeiro só enxerga as próprias linhas. Regra no banco, não na tela.
5. **Controle de estoque e custo dos produtos** (decisão de 16/08 — o frigobar acendeu a luz):
   hoje o catálogo só tem preço de venda e não existe controle de estoque. Entra:
   - `cost_cents` por produto — sem custo cadastrado o sistema **não** calcula comissão e avisa
     você. Ex.: pomada a R$ 50, custo R$ 28, no crédito (3,5% = R$ 1,75) → lucro R$ 20,25 →
     **R$ 10,12 para cada**;
   - **estoque por produto** com entrada (compra), saída (venda, consumo próprio, perda/quebra,
     cortesia) e **saldo atual**;
   - **alerta de estoque baixo** (o produto acaba antes de você perceber, e venda perdida é o
     prejuízo invisível);
   - **contagem periódica**: você informa o que contou, o sistema mostra a diferença para o
     saldo teórico. É esta conferência — não a câmera — que mostra produto saindo sem registro.

5.1. **Consumo do profissional (aba "Meus consumos" no módulo dele)** — regra definida pelo
   Juliano: ele lança o que consumiu e o valor é **descontado da cota-parte no fechamento**,
   pelo **preço de venda menos a comissão que ele teria naquele item**. Exemplo dele: energético
   comprado a R$ 10 e vendido a R$ 15 → lucro R$ 5 → comissão dele seria R$ 2,50 → ele paga
   **R$ 12,50**, e a barbearia mantém seu lucro de R$ 2,50. O lançamento dá baixa no estoque
   como qualquer venda, e aparece no extrato semanal como desconto — sem surpresa no fechamento.
6. **Cálculo de comissão** no check-out: grava `service_net_cents`, `fee_cents`,
   `commission_cents` no atendimento — **congelado no momento do atendimento** (mudar a taxa,
   o custo do produto ou o percentual depois não pode reescrever o passado).
7. **`payouts`**: fechamentos semanais (período, staff, totais, status, pago_em).
8. **Aceite do contrato**: tabela `staff_agreements` (versão do contrato, hash do texto,
   assinatura em imagem, foto de conferência, IP, dispositivo, data/hora). Acesso restrito a
   você — é documento de proteção, não dado de operação.
9. **Módulo do barbeiro** (as 4 telas) + **aba Equipe** no seu admin.
10. **JuIA**: saber responder "com quem você quer agendar?" e distribuir a agenda.

**Estimativa honesta:** os itens 1–2 e 5–7 são diretos. O item 3 é o que exige cuidado — é o
coração do sistema, e é onde um erro aparece como "cliente agendou em horário ocupado".

---

## 6. A demanda já existe — e está sendo perdida na porta

Informação do Juliano em 16/08/2026, que muda a natureza da decisão: **ele dispensa cliente
na porta em terça, sexta e sábado.** Salva o contato, entrega o cartão, mas *"não consigo
converter sozinho"*. Ou seja: a segunda cadeira não precisa **criar** demanda — ela precisa
**parar de recusar** a que já bate na porta. Some a isso o plano por assinatura, que aumenta
a frequência de visita dos mesmos clientes.

**Ação para começar hoje, antes de qualquer código novo:** o sistema já tem **Lista de espera**
(`admin-espera.html`, v28.x) e ela está subutilizada. Toda vez que alguém for dispensado,
cadastrar ali (nome + WhatsApp + o que queria). Isso resolve três coisas de uma vez:

1. **Converte agora**: quando abre uma vaga (falta, cancelamento), o sistema avisa quem está
   na fila — em vez de o horário morrer vazio.
2. **Mede a demanda perdida**: em 3–4 semanas você tem o número exato de quantos clientes por
   semana batem na porta e voltam. Esse número **é** o faturamento da segunda cadeira, com
   nome e telefone.
3. **Enche a agenda do novo barbeiro no dia 1**: a lista vira a primeira leva de convites
   ("abriu horário novo, com o profissional X"). Ninguém começa em cadeira vazia — que é o
   que costuma matar a segunda cadeira no primeiro mês.

**Ponto de equilíbrio, para ter na cabeça**: com 50% líquido, cada corte de R$ 40 em dinheiro
deixa R$ 20 para a casa. Estrutura, energia, produtos, aluguel proporcional e a sua gestão
saem daí. ⚖️ Com o número de dispensados em mãos, dá para calcular em uma conta só quantos
atendimentos/semana a cadeira precisa para se pagar — e provavelmente ela já se paga.

**Formalização**: 50/50 sem vínculo empregatício é comum no setor, mas o modelo importa
(autônomo com contrato de parceria, MEI prestador etc.). Isso é conversa com seu contador —
não é decisão de software, e escrever o combinado antes evita 90% dos problemas depois.
O que o sistema faz é dar o extrato: cada real, com data, meio de pagamento e taxa.

---

## 7. Como eu recomendo começar

**Fase 1 (fundação, sem risco):** `staff`, `bookings.staff_id`, cálculo e registro de
comissão no check-out, aba Equipe com o fechamento semanal e o Pix. Roda **só com você** por
uma ou duas semanas — os números aparecem, você confere, e nada muda para o cliente.

**Fase 2 (quando o barbeiro chegar):** agenda por profissional no site e na JuIA, módulo
restrito dele, RLS. É aqui que o cliente passa a escolher com quem cortar.

Assim o sistema já está pronto e testado no dia em que ele senta na cadeira — e o primeiro
fechamento de segunda-feira sai redondo, com os dois olhando o mesmo número.
