import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v29.242.0 — rotina do expediente (Abrir/Fechar a barbearia). Cron bdj-expediente a cada
// 15 min, 8h–21h de Brasília (migração 180). Duas tarefas, ambas decididas no banco:
//   1) expediente_lembrete_abrir(): 8h15–8h59 com cliente marcado e ninguém clicou em Abrir
//      -> push "Abrir a barbearia?" (uma vez por dia).
//   2) expediente_fechar_automatico(): 30 min depois do fim do expediente sem Fechar -> registra
//      o fechamento pelo fim do último atendimento, marcado 'automatico', e avisa no push.
// Só fala com o Juliano (push do painel); nunca com cliente.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || request.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const push = async (title: string, body: string, tag: string) => {
    if (!pushSecret) return false
    const r = await fetch(`${url}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title, body, url: '/admin.html?app=1', tag } }),
    }).catch(() => null)
    return Boolean(r?.ok)
  }

  const out: Record<string, unknown> = {}

  const { data: lembrar, error: e1 } = await admin.rpc('expediente_lembrete_abrir')
  if (e1) console.error('[expediente-dia] lembrete', e1)
  if (lembrar === true) {
    out.lembrete = await push('Abrir a barbearia?', 'Tem cliente marcado hoje e o dia ainda não foi aberto no painel. Toque em Abrir na tela Hoje para registrar o começo do expediente.', 'expediente-abrir')
  }

  const { data: fechados, error: e2 } = await admin.rpc('expediente_fechar_automatico')
  if (e2) console.error('[expediente-dia] fechar automatico', e2)
  if (Number(fechados) > 0) {
    out.fechamento_automatico = await push('Fechamento registrado automaticamente', 'Ninguém clicou em Fechar hoje: o expediente foi encerrado pelo fim do último atendimento. Se saiu em outro horário, ajuste no painel.', 'expediente-fechar-auto')
  }

  return json({ ok: true, ...out })
})
