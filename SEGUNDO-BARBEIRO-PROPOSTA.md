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

### Casos que precisam de regra ⚖️ (a maior fonte de discussão depois)

| Situação | Pergunta | Sugestão |
|---|---|---|
| Fidelidade: 10º serviço grátis | Quem paga o barbeiro? | A casa paga 50% do valor cheio ao barbeiro (o benefício é seu, não dele) |
| Vale-presente | Comissão quando? | Na **execução** do atendimento, sobre o valor do serviço (o dinheiro entrou antes, mas o trabalho é agora) |
| Ajuste sem custo (7 dias) / pezinho cortesia | Recebe? | Não gera comissão — é retrabalho/cortesia. Se o ajuste for de corte feito por VOCÊ, também não onera ele |
| Falta do cliente (no-show) | Recebe algo? | Não. Mas o sistema deve **registrar** para você ver se as faltas se concentram na agenda dele |
| Desconto dado no balcão | Sobre o quê incide? | Sobre o valor efetivamente cobrado — e o sistema marca **quem** deu o desconto |
| Produto vendido | Percentual? | 15% (padrão de mercado 10–20%) |
| Gorjeta | De quem é? | 100% de quem atendeu, fora do rateio |

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
desconto acima de um limite ⚖️ (sugestão: até 10%; acima disso pede sua liberação), ver
faturamento da casa.

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

## 6. Antes de contratar: os números que decidem ⚖️

Vale a pena rodar com os dados que já temos, antes de qualquer linha de código:

- **Ocupação atual**: agosto teve ~51 agendamentos online (~R$ 2.400/quinzena em serviços).
  Quantos clientes você recusa ou empurra para outro dia por falta de horário? Se a resposta
  for "poucos", a segunda cadeira não nasce cheia — ela precisa de demanda nova (anúncios,
  assinatura), não só de espaço.
- **Ponto de equilíbrio**: com 50% líquido, cada corte de R$ 40 no dinheiro deixa R$ 20 para
  a casa. Estrutura, produtos, energia, aluguel proporcional e as suas horas de gestão saem
  daí. ⚖️ Vale calcular quantos atendimentos/semana ele precisa fazer para a cadeira se pagar.
- **Formalização**: 50/50 sem vínculo empregatício é comum no setor, mas o modelo importa
  (autônomo com contrato de parceria, MEI prestador etc.). Isso é conversa com seu contador —
  não é decisão de software, e escrever o combinado antes evita 90% dos problemas depois.

---

## 7. Como eu recomendo começar

**Fase 1 (fundação, sem risco):** `staff`, `bookings.staff_id`, cálculo e registro de
comissão no check-out, aba Equipe com o fechamento semanal e o Pix. Roda **só com você** por
uma ou duas semanas — os números aparecem, você confere, e nada muda para o cliente.

**Fase 2 (quando o barbeiro chegar):** agenda por profissional no site e na JuIA, módulo
restrito dele, RLS. É aqui que o cliente passa a escolher com quem cortar.

Assim o sistema já está pronto e testado no dia em que ele senta na cadeira — e o primeiro
fechamento de segunda-feira sai redondo, com os dois olhando o mesmo número.
