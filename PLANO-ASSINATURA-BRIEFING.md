# Plano por assinatura — briefing pra começar (escrito em 15/08/2026, no PC de casa)

O Juliano vai implantar o clube de assinatura NESTA SEMANA. Este arquivo é o "mastigado"
pra iniciar o trabalho — decisões abertas estão marcadas com ⚖️ (decidir COM ele, não por ele).

## Por que agora
- A Fase 2 do PagBank (v29.22.0) criou a infraestrutura de cobrança online (checkout + webhook).
- Benchmark validado: a Barbearia Hermanos (SP) abre o site com os planos de assinatura
  (R$ 34,90–199,89/mês, "Planos Infinite") — modelo provado no mercado desde 2018.
- Receita recorrente amortece a sazonalidade e aumenta frequência de visita.

## Precificação e estrutura dos planos
JÁ DEFINIDAS entre o Juliano e você (Claude do notebook) na conversa original do projeto —
recupere do seu histórico/memória. Este briefing deliberadamente NÃO sugere planos nem
preços (pedido do Juliano em 15/08): aqui é só a parte técnica/infraestrutura.

## Cobrança — decisão técnica em 2 fases
- **FASE A (dá pra lançar esta semana, sem depender do PagBank):** assinatura = registro
  interno + cobrança mensal via link de Checkout PagBank (quando a allowlist sair) ou, até lá,
  Pix por chave com o ciclo manual existente (declare/confirm). A JuIA manda o link/lembrete
  todo mês (cron, padrão dos robôs existentes). Simples, zero dependência nova.
- **FASE B (recorrência automática de verdade):** API "Pagamento Recorrente" do PagBank.
  ATENÇÃO: a homologação do chamado 1430398600 pediu só Orders + Checkout — o Juliano foi
  orientado (15/08) a responder o e-mail do chamado pedindo pra INCLUIR a API de Pagamento
  Recorrente. Confirmar se ele enviou; se não, mandar.

## Esqueleto de banco sugerido (adaptar ao padrão das migrations)
- `subscription_plans` (id, name, description, price_cents, services_included jsonb,
  visits_per_month, active)
- `subscriptions` (id, customer_phone/customer_id, plan_id, status
  [active|paused|past_due|cancelled], started_at, next_billing_date, notes)
- `subscription_payments` (id, subscription_id, amount_cents, method, status, paid_at,
  pagbank_checkout_id/charge_id → reaproveitar a tabela `payments` (migration 106) com uma
  coluna subscription_id é alternativa válida)
- Uso no fluxo: booking de assinante não cobra na conclusão (marcar origem; ver
  `fee_passed_to_customer`/Financeiro pra não distorcer faturamento — decidir como contar
  receita: na cobrança mensal, não no atendimento).

## Frentes de implementação (ordem sugerida)
1. Migration + tela admin simples (criar/pausar/cancelar assinatura, ver próximas cobranças).
2. Regra no fluxo de conclusão: assinante ativo = atendimento coberto pelo plano.
3. Robô mensal de cobrança/lembrete via JuIA (seguir padrão dos crons existentes; respeitar
   horário de silêncio 20h–8h).
4. Seção na home (nobre, estilo Hermanos) + página /assinatura com os planos. A home acabou
   de ser refeita na v29.23.0 (hero com 1 CTA, avaliações reais) — manter a hierarquia.
5. JuIA oferecer o plano no momento certo (ex.: cliente que agendou 2+ vezes no mês).
6. Financeiro: receita de assinatura como categoria própria.

## Regras de negócio pra fechar com o Juliano ⚖️
- Inadimplência: quantos dias de tolerância antes de pausar? Aviso pela JuIA?
- Visitas não usadas: acumulam? (sugestão: não — simplicidade)
- Cancelamento: imediato ou fim do ciclo? Fidelidade (pontos) convive com assinatura?
- Meta de lançamento: quantos assinantes no 1º mês? (pra saber se divulga nos anúncios)
