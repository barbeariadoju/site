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
| **Produto vendido** | **15% sobre o valor da venda**, só do que ele vendeu no atendimento dele | Padrão de mercado é 10–20%, menor que serviço porque a margem do produto é diferente. 15% é o meio, e é o suficiente pra ele querer vender |
| **Desconto no balcão** | **Zero no primeiro mês.** Depois, até **10%** com motivo obrigatório registrado; acima disso, só com seu OK | Desconto é o vazamento de margem mais fácil de acontecer e mais difícil de auditar. No 50/50 ele já perde metade do desconto — o incentivo natural ajuda, mas controle no começo é sensato. O sistema marca **quem** deu |
| **Falta do cliente (no-show)** | Ninguém recebe, mas **registra por profissional** | Não é culpa dele, mas se as faltas se concentrarem na agenda dele, é um sinal (confirmação, atraso, atendimento) que só aparece com dado |
| **Gorjeta** | **100% de quem atendeu**, fora do rateio | Gorjeta é do trabalho, não da estrutura. Entrar no rateio azeda rápido |
| **Produto usado no serviço** (pomada, toalha, lâmina) | Custo **integral da casa**, nunca descontado dele | Já está no combinado "você dá tudo". Descontar insumo depois é o clássico que quebra a confiança |
| **Assinatura (quando o plano existir)** | ⚖️ **Decisão dependente do plano**: pagar **valor fixo por atendimento de assinante**, não 50% do preço cheio | Assinante paga mensalidade fixa e pode usar muito. Se o barbeiro receber 50% do valor cheio a cada visita, um assinante intenso vira prejuízo. Fixar o valor por atendimento (ex.: plano R$ 70 com 2 cortes → R$ 35/corte → R$ 17,50 pra ele) mantém a conta em pé. Fechar isso junto com a precificação do plano |
| **Cliente da casa × cliente dele** | **Não diferenciar** no início — 50% em tudo | Alguns modelos pagam menos por cliente que veio do marketing da casa. É mais justo na teoria e uma fonte de discussão infinita na prática. Registrar a origem do cliente desde o dia 1 (o sistema já faz) permite rever isso depois com dados, se fizer falta |

---

## 3. O módulo do barbeiro (acesso restrito)

Princípio: **ele vê o trabalho dele e o dinheiro dele. Nada mais.** Nenhum acesso a CRM
completo, Financeiro da casa, relatórios gerais, marketing, conteúdo ou configurações.

**Telas (4, só o essencial):**
1. **Minha agenda** — dia/semana, só os atendimentos dele. Bloquear horário pessoal.
2. **Novo agendamento** — encaixar cliente na cadeira dele (walk-in incluso).
3. **Atendimento / check-out** — concluir, registrar serviços + produtos + meio de pagamento.
   É o passo que alimenta a comissão; sem check-out não há comissão calculada.
4. **Meus ganhos** — semana corrente: atendimentos, bruto, taxas, líquido, **quanto ele
   recebe na segunda**. Histórico dos fechamentos anteriores. É esta tela que elimina a
   desconfiança.

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
5. **Cálculo de comissão** no check-out: grava `service_net_cents`, `fee_cents`,
   `commission_cents` no atendimento — **congelado no momento do atendimento** (mudar a taxa
   ou o percentual depois não pode reescrever o passado).
6. **`payouts`**: fechamentos semanais (período, staff, totais, status, pago_em).
7. **Módulo do barbeiro** (as 4 telas) + **aba Equipe** no seu admin.
8. **JuIA**: saber responder "com quem você quer agendar?" e distribuir a agenda.

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
