// v29.194.0 (16/09/2026) — Cliente de porta na cadeira = bloqueio automático da agenda.
//
// Roda pelo cron bdj-camera-walkin-guard a cada minuto (Bearer anon + x-webhook-secret, igual
// ao tuya-watch). A decisão inteira mora na RPC camera_walkin_guard() (migration 155): esta
// function só a chama e, quando um bloqueio NASCE, avisa o Juliano por push — informação, não
// pedido de confirmação (regra dele: "preciso que aconteça sem minha confirmação"). Desfazer é
// o "Liberar" da tela Agenda, que segura o robô por 90 min.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const hhmm = (t: unknown) => String(t || '').slice(0, 5)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || req.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))
  const dryRun = body?.dry_run === true

  const { data, error } = await admin.rpc('camera_walkin_guard', { p_dry_run: dryRun })
  if (error) {
    console.error('[camera-walkin-guard] rpc', error)
    return json({ error: error.message }, 500)
  }
  const result = (data || {}) as Record<string, unknown>
  console.log('[camera-walkin-guard]', JSON.stringify(result))

  if (result.action === 'criado') {
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret) {
      const proximo = result.next_time
        ? `Próximo marcado: ${result.next_name || 'cliente'} às ${hhmm(result.next_time)}.`
        : 'Nenhum outro horário marcado hoje.'
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({
          custom: {
            title: '💈 Cliente sem hora na cadeira',
            body: `Agenda bloqueada até ${hhmm(result.until)} e vai acompanhando a cadeira. ${proximo} Pra desfazer: Agenda → Liberar.`,
            url: '/admin-agenda.html?app=1',
            tag: `camera-walkin-${result.block_id}`,
          },
        }),
      }).catch((e) => console.error('[camera-walkin-guard] push', e))
    }
  }
  return json({ ok: true, ...result })
})
