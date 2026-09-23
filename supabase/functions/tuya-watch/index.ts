// tuya-watch — hoje é só o VIGIA DO CONTADOR DE CADEIRA (v29.124.0). O nome ficou por causa do cron
// bdj-tuya-watch, que continua chamando esta function de 10 em 10 min.
//
// v29.228.0 (pedido do Juliano, 23/09/2026): o monitor do alarme EKASA pela nuvem Tuya (v29.48.0) SAIU.
// "Pode remover esta funcionalidade, vou voltar pro app do Ekasa, este app adicional só serviu pra me
// confundir." A central sai do Smart Life e volta para o app da EKASA, que não se liga à nuvem de
// desenvolvedor da Tuya — e o plano IoT Core tinha vencido em 20/09 de qualquer jeito. O card "Alarme"
// saiu da tela Hoje; as tabelas alarm_hubs/alarm_events ficam no banco só como histórico (nada mais
// escreve nelas). O código antigo está no Git (v29.227.0) se um dia voltar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// v29.124.0 — vigia do contador de cadeira. 30 min é folgado de propósito: o contador manda
// sinal a cada 5 min, então 30 absorve uma queda de rede ou um reinício sem gerar alarme falso.
const CAMERA_SILENT_MIN = 30
const CAMERA_DEVICE = 'camera-cadeira'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || req.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') || ''
  const push = async (title: string, body: string, tag: string) => {
    if (!pushSecret) return
    await fetch(`${supabaseUrl}/functions/v1/send-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title, body, url: '/admin.html?app=1', tag } }) }).catch(() => {})
  }
  // alarm_alerts continua sendo a tabela de avisos em aberto (não repete aviso, fecha sozinho).
  const alert = async (device_id: string, kind: string, subject: string | null, message: string, title: string) => {
    const { data: open } = await admin.from('alarm_alerts').select('id').eq('device_id', device_id).eq('kind', kind).is('resolved_at', null).eq('subject', subject ?? '').maybeSingle()
    if (open) return false
    await admin.from('alarm_alerts').insert({ device_id, kind, subject: subject ?? '', message })
    await push(title, message, `alarm-${kind}-${device_id}-${subject || ''}`)
    return true
  }
  const resolve = async (device_id: string, kind: string, subject: string | null) => {
    await admin.from('alarm_alerts').update({ resolved_at: new Date().toISOString() }).eq('device_id', device_id).eq('kind', kind).eq('subject', subject ?? '').is('resolved_at', null)
  }

  // v29.124.0 — VIGIA DO CONTADOR DE CADEIRA (pedido do Juliano, 03/09/2026).
  // O contador roda no notebook da barbearia e, quando morre, morre calado (ficou dois dias parado
  // depois da formatação, 01/09 → 03/09). Este cron roda no Supabase e continua de pé mesmo com o
  // notebook desligado, formatado ou fora da barbearia.
  const camera = { attempted: true, alerted: false, error: '' }
  try {
    const now = Date.now()
    const { data: hb } = await admin.from('camera_heartbeat').select('device, last_seen_at').order('last_seen_at', { ascending: false }).limit(1).maybeSingle()
    const lastSeen = hb?.last_seen_at ? new Date(String(hb.last_seen_at)).getTime() : null
    const minutosSemSinal = lastSeen === null ? null : Math.floor((now - lastSeen) / 60000)

    // Só cobra sinal em horário de funcionamento (ter-sáb, 8h-19h). Fora disso o notebook pode estar
    // desligado de propósito, e avisar seria ruído.
    // v29.227.0: dia da semana pela data de São Paulo (weekday:'numeric' não existe e lançava erro).
    const spHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const spDia = new Date(`${spHoje}T12:00:00Z`).getUTCDay()
    const spHora = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
    const dentroDoExpediente = spDia >= 2 && spDia <= 6 && spHora >= 8 && spHora < 19

    if (minutosSemSinal !== null && minutosSemSinal <= CAMERA_SILENT_MIN) {
      await resolve(CAMERA_DEVICE, 'camera_offline', null)
    } else if (dentroDoExpediente) {
      const quanto = minutosSemSinal === null
        ? 'nunca deu sinal'
        : minutosSemSinal >= 1440
          ? `parado há ${Math.floor(minutosSemSinal / 1440)} dia(s)`
          : `parado há ${Math.floor(minutosSemSinal / 60)}h${String(minutosSemSinal % 60).padStart(2, '0')}`
      camera.alerted = await alert(CAMERA_DEVICE, 'camera_offline', null,
        `O contador de clientes na cadeira ${quanto}. Confira se o notebook da barbearia está ligado e conectado — enquanto isso os atendimentos não estão sendo contados pela câmera.`,
        '📷 Contador de cadeira parado')
    }
  } catch (e) {
    camera.error = e instanceof Error ? e.message : String(e)
    console.error('[tuya-watch] camera_watchdog', camera.error)
  }

  return json({ ok: true, camera })
})
