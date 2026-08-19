// tuya-watch — v29.48.0 (19/08/2026)
// Monitor do alarme EKASA (central Tuya "wfcon", modelo EKJM-T3231) pela Tuya Cloud API.
// Roda pelo cron bdj-tuya-watch a cada 10 min (Bearer anon + x-webhook-secret, igual ao
// content-publish-scheduled). Pra cada central vinculada ao projeto Tuya:
//   1. shadow (v2.0/cloud/thing/{id}/shadow/properties): modo (dp101), alarme (dp103),
//      último evento de sensor (dp116 "Porta Vidro Alarm"), última ação (dp121 "App Disarm"),
//      lista de sensores (dp120, UTF-16BE) — tudo com timestamp;
//   2. logs (v1.0/devices/{id}/logs): online/offline (event_id 1/2), RSSI (8), reports de DP (7)
//      → histórico em alarm_events;
//   3. alertas (alarm_alerts + push): central offline; sensor sem prova de vida há N dias;
//      "Low Battery"/"bateria" no texto do evento; alarme disparado.
// Nunca envia comandos pra central — só leitura.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const HOSTS: Record<string, string> = { us: 'https://openapi.tuyaus.com', eu: 'https://openapi.tuyaeu.com', in: 'https://openapi.tuyain.com', cn: 'https://openapi.tuyacn.com' }
const SENSOR_SILENT_DAYS = Number(Deno.env.get('ALARM_SENSOR_SILENT_DAYS') || '8')
const OFFLINE_MINUTES = 12

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function hmacHex(secret: string, s: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(s))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}
function canon(path: string) {
  const [p, q] = path.split('?'); if (!q) return path
  return p + '?' + q.split('&').sort().join('&')
}
function makeTuya(host: string, id: string, secret: string) {
  let token = ''
  const call = async (method: string, path: string) => {
    path = canon(path)
    const t = Date.now().toString()
    const sign = await hmacHex(secret, id + token + t + [method, await sha256Hex(''), '', path].join('\n'))
    const r = await fetch(host + path, { method, headers: { client_id: id, sign, t, sign_method: 'HMAC-SHA256', access_token: token } })
    return r.json()
  }
  return {
    async auth() { const r = await call('GET', '/v1.0/token?grant_type=1'); if (!r.success) throw new Error('tuya token: ' + r.msg); token = r.result.access_token },
    call,
  }
}
const utf16be = (buf: Uint8Array) => { let s = ''; for (let i = 0; i + 1 < buf.length; i += 2) s += String.fromCharCode((buf[i] << 8) | buf[i + 1]); return s }
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
function parseSensors(raw: string): Array<{ idx: number; mode: number; name: string }> {
  try {
    const b = b64(raw); const out: Array<{ idx: number; mode: number; name: string }> = []
    let o = 2
    while (o + 3 <= b.length) { const idx = b[o], mode = b[o + 1], len = b[o + 2]; out.push({ idx, mode, name: utf16be(b.subarray(o + 3, o + 3 + len)) }); o += 3 + len }
    return out
  } catch { return [] }
}
const MODE: Record<string, string> = { '1': 'armado', '2': 'desarmado', '3': 'casa' }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || req.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const accessId = Deno.env.get('TUYA_ACCESS_ID')?.trim() || '', accessSecret = Deno.env.get('TUYA_ACCESS_SECRET')?.trim() || ''
  const region = Deno.env.get('TUYA_REGION')?.trim() || 'us'
  if (!accessId || !accessSecret) return json({ error: 'TUYA_ACCESS_ID/SECRET ausentes' }, 500)
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') || ''
  const push = async (title: string, body: string, tag: string) => {
    if (!pushSecret) return
    await fetch(`${supabaseUrl}/functions/v1/send-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title, body, url: '/admin.html?app=1', tag } }) }).catch(() => {})
  }
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

  try {
    const tuya = makeTuya(HOSTS[region] || HOSTS.us, accessId, accessSecret)
    await tuya.auth()
    const list = await tuya.call('GET', '/v1.0/iot-01/associated-users/devices?size=50')
    const devices: any[] = (list.result?.devices || []).filter((d: any) => d.category === 'wfcon' || /alarm|sirene|seguran/i.test(d.product_name || ''))
    const out: any[] = []
    const now = Date.now()
    for (const d of devices) {
      const shadow = await tuya.call('GET', `/v2.0/cloud/thing/${d.id}/shadow/properties`)
      const props: any[] = shadow.result?.properties || []
      const dp = (code: string) => props.find((p) => p.code === code)
      const modeRaw = String(dp('true')?.value ?? '')
      const mode = MODE[modeRaw] || modeRaw
      const alarmOn = dp('bj')?.value === true
      const ev = dp('pjts'); const act = dp('pjls'); const sensRaw = dp('c1')
      const lastSensorEvent = ev ? utf16be(b64(String(ev.value))) : null
      const lastSensorAt = ev ? new Date(ev.time).toISOString() : null
      const lastAction = act ? utf16be(b64(String(act.value))) : null
      const lastActionAt = act ? new Date(act.time).toISOString() : null
      const sensors = sensRaw ? parseSensors(String(sensRaw.value)) : []

      // logs das últimas 26h (sobrepõe rodadas; unique evita duplicar)
      const start = now - 26 * 3600 * 1000
      const logs = await tuya.call('GET', `/v1.0/devices/${d.id}/logs?type=1,2,7&start_time=${start}&end_time=${now}&size=100`)
      const rows: any[] = []
      for (const l of logs.result?.logs || []) {
        const at = new Date(Number(l.event_time)).toISOString()
        if (l.event_id === 1) rows.push({ device_id: d.id, event_at: at, kind: 'online', text: 'online' })
        else if (l.event_id === 2) rows.push({ device_id: d.id, event_at: at, kind: 'offline', text: 'offline' })
        else if (l.event_id === 7 && l.code === 'pjts' && l.value) {
          const txt = utf16be(b64(String(l.value)))
          const sName = sensors.map((s) => s.name).find((n) => txt.startsWith(n)) || null
          rows.push({ device_id: d.id, event_at: at, kind: 'sensor', sensor_name: sName, text: txt })
        } else if (l.event_id === 7 && l.code === 'pjls' && l.value) rows.push({ device_id: d.id, event_at: at, kind: 'action', text: utf16be(b64(String(l.value))) })
        else if (l.event_id === 7 && l.code === 'true') rows.push({ device_id: d.id, event_at: at, kind: 'mode', text: MODE[String(l.value)] || String(l.value) })
        else if (l.event_id === 7 && l.code === 'bj') rows.push({ device_id: d.id, event_at: at, kind: 'alarm', text: String(l.value) === 'true' ? 'disparado' : 'normal' })
      }
      if (lastSensorEvent && lastSensorAt) {
        const sName = sensors.map((s) => s.name).find((n) => lastSensorEvent.startsWith(n)) || null
        rows.push({ device_id: d.id, event_at: lastSensorAt, kind: 'sensor', sensor_name: sName, text: lastSensorEvent })
      }

      // upsert hub primeiro (FK dos eventos)
      const { data: prev } = await admin.from('alarm_hubs').select('offline_since, sensors, open_days, created_at').eq('device_id', d.id).maybeSingle()
      const offlineSince = d.online ? null : (prev?.offline_since || new Date().toISOString())
      const { error: upErr } = await admin.from('alarm_hubs').upsert({
        device_id: d.id, name: d.name, online: !!d.online, mode, alarm_on: alarmOn,
        last_sensor_event: lastSensorEvent, last_sensor_event_at: lastSensorAt, last_action: lastAction, last_action_at: lastActionAt,
        raw: { model: d.model, product: d.product_name, ip: d.ip, mode_raw: modeRaw }, last_seen_at: d.online ? new Date().toISOString() : undefined,
        offline_since: offlineSince, updated_at: new Date().toISOString(),
        sensors: sensors, // enriquecido abaixo
      }, { onConflict: 'device_id' })
      if (upErr) console.error('[tuya-watch] upsert hub', upErr)
      if (rows.length) { const { error: evErr } = await admin.from('alarm_events').upsert(rows, { onConflict: 'device_id,event_at,kind,text', ignoreDuplicates: true }); if (evErr) console.error('[tuya-watch] upsert events', evErr) }

      // prova de vida por sensor = último evento registrado em alarm_events
      const enriched = []
      for (const s of sensors) {
        const { data: last } = await admin.from('alarm_events').select('event_at').eq('device_id', d.id).eq('kind', 'sensor').eq('sensor_name', s.name).order('event_at', { ascending: false }).limit(1).maybeSingle()
        enriched.push({ ...s, last_event_at: last?.event_at || null })
      }
      await admin.from('alarm_hubs').update({ sensors: enriched }).eq('device_id', d.id)

      // ---- alertas ----
      if (!d.online) {
        const mins = (now - new Date(offlineSince!).getTime()) / 60000
        if (mins >= OFFLINE_MINUTES) await alert(d.id, 'offline', null, `Central "${d.name}" está OFFLINE há ${Math.round(mins)} min (sem luz, sem Wi-Fi ou desligada).`, '🚨 Alarme offline')
      } else await resolve(d.id, 'offline', null)
      if (alarmOn) await alert(d.id, 'alarm', null, `ALARME DISPARADO em "${d.name}"${lastSensorEvent ? ' — ' + lastSensorEvent : ''}.`, '🚨 Alarme disparou')
      else await resolve(d.id, 'alarm', null)
      // v29.48.2 — regra DIÁRIA (pedido do Juliano): sensor de porta/presença precisa ter evento em todo dia de
      // funcionamento da loja (open_days do hub; Barbearia = ter..sáb). Até as 11h do dia aberto ainda dá tempo;
      // depois disso, se não houve evento desde o dia aberto anterior, alerta. Campainha (e outros) = SENSOR_SILENT_DAYS.
      const spNow = new Date(now - 3 * 3600 * 1000) // relógio SP (UTC-3), só pra dia/hora
      const dow = spNow.getUTCDay(), hourSP = spNow.getUTCHours()
      const openDays: number[] = Array.isArray(prev?.open_days) && prev.open_days.length ? prev.open_days : [2, 3, 4, 5, 6]
      const isOpen = (day: number) => openDays.includes(day)
      // dia aberto mais recente que JÁ deveria ter gerado evento: hoje se aberto e >= 11h; senão o aberto anterior
      let ref = new Date(Date.UTC(spNow.getUTCFullYear(), spNow.getUTCMonth(), spNow.getUTCDate()))
      if (!(isOpen(dow) && hourSP >= 11)) { do { ref = new Date(ref.getTime() - 86400000) } while (!isOpen(ref.getUTCDay())) }
      const refStartUtc = ref.getTime() + 3 * 3600 * 1000 // 00:00 SP desse dia em UTC
      for (const s of enriched) {
        const daily = /porta|presen|pir|moviment|janela/i.test(s.name)
        const lastMs = s.last_event_at ? new Date(s.last_event_at).getTime() : null
        if (daily) {
          const hubAgeDays = (now - new Date((prev as any)?.created_at || now).getTime()) / 86400000
          if (lastMs !== null && lastMs < refStartUtc) {
            const dias = Math.max(1, Math.round((now - lastMs) / 86400000))
            await alert(d.id, 'sensor_silent', s.name, `Sensor "${s.name}" (${d.name}) não deu sinal no último dia de funcionamento (último evento há ${dias} dia${dias > 1 ? 's' : ''}) — conferir pilha.`, '🔋 Sensor sem sinal')
          } else if (lastMs === null && hubAgeDays >= 2) {
            await alert(d.id, 'sensor_silent', s.name, `Sensor "${s.name}" (${d.name}) nunca deu sinal desde que o monitor começou — conferir pilha/cadastro.`, '🔋 Sensor sem sinal')
          } else await resolve(d.id, 'sensor_silent', s.name)
        } else {
          const ageDays = lastMs !== null ? (now - lastMs) / 86400000 : null
          if (ageDays !== null && ageDays >= SENSOR_SILENT_DAYS) await alert(d.id, 'sensor_silent', s.name, `Sensor "${s.name}" (${d.name}) sem prova de vida há ${Math.floor(ageDays)} dias — conferir pilha.`, '🔋 Sensor sem sinal')
          else if (ageDays !== null) await resolve(d.id, 'sensor_silent', s.name)
        }
      }
      const lowBat = rows.filter((r) => /low ?batt|bateria (fraca|baixa)/i.test(r.text || ''))
      for (const r of lowBat) await alert(d.id, 'low_battery', r.sensor_name || r.text, `${r.text} (${d.name}) — trocar pilha.`, '🔋 Bateria fraca no alarme')

      out.push({ id: d.id, name: d.name, online: d.online, mode, alarmOn, lastSensorEvent, sensors: enriched.length, events: rows.length })
    }
    return json({ ok: true, hubs: out })
  } catch (e) {
    console.error('[tuya-watch]', e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
