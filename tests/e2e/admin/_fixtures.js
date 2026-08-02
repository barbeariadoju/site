// Dados fictícios servidos pelo mock do Supabase (_supabase-mock.js).
// Nenhum dado aqui é real: nomes, telefones e valores são inventados.
// As datas são calculadas em relação a "hoje" para que os filtros de
// mês/semana dos painéis sempre encontrem registros.

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const today = new Date();
// Dia N do mês atual, mas nunca no futuro (se hoje for dia 2, "dia 8" vira dia 2).
// Garante que os concluídos fiquem sempre dentro do período corrente dos relatórios.
const dayOfMonth = (n) => iso(new Date(today.getFullYear(), today.getMonth(), Math.min(Math.max(n, 1), today.getDate())));
const tsOfMonth = (n, h = 10) => new Date(today.getFullYear(), today.getMonth(), Math.min(Math.max(n, 1), today.getDate()), h, 0, 0).toISOString();
const lastMonth = iso(new Date(today.getFullYear(), today.getMonth() - 1, 15));

const ANA = { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Ana Fictícia', phone: '5511987654321', email: 'ana.ficticia@example.com' };
const BRUNO = { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Bruno de Mentira', phone: '11912345678', email: 'bruno.mentira@example.com' };
const CARLA = { id: 'cccccccc-0000-4000-8000-000000000003', name: 'Carla Exemplo', phone: '5511955554444', email: null };

const booking = (over) => ({
  id: 'mock-bk-' + Math.random().toString(36).slice(2, 10),
  customer_name: ANA.name, customer_phone: ANA.phone, customer_email: ANA.email,
  service_name: 'Corte de cabelo', service_price: 40, products_price: 0, products: null, duration_minutes: 30,
  booking_date: dayOfMonth(3), start_time: '10:00:00', end_time: '10:30:00',
  status: 'completed', channel: 'site', notes: null, payment_method: 'pix', products_payment_method: null,
  created_at: tsOfMonth(1), updated_at: tsOfMonth(1),
  ...over,
});

export function makeFixtures(overrides = {}) {
  const tables = {
    // Mês atual: 3 concluídos (R$ 175 no total, 2 clientes), 1 falta, 1 cancelado.
    // Mês passado: 1 concluído da Ana (vira "recorrente" nos relatórios).
    // Futuro próximo: 1 confirmado e 1 pendente (aparecem na agenda).
    bookings: [
      booking({}), // Ana, Corte, 40+0
      booking({ customer_name: BRUNO.name, customer_phone: BRUNO.phone, customer_email: BRUNO.email, service_name: 'Corte + Barba', service_price: 60, products_price: 25, selected_products: [{ name: 'Água', price: 25 }], booking_date: dayOfMonth(5), start_time: '14:00:00', end_time: '15:00:00', channel: 'balcao', payment_method: 'pix', products_payment_method: 'debito' }),
      booking({ booking_date: dayOfMonth(8), products_price: 10, start_time: '11:00:00', end_time: '11:30:00' }),
      booking({ booking_date: lastMonth, created_at: new Date(today.getFullYear(), today.getMonth() - 1, 15, 10, 0, 0).toISOString() }),
      booking({ customer_name: CARLA.name, customer_phone: CARLA.phone, customer_email: null, status: 'no_show', booking_date: dayOfMonth(6), start_time: '16:00:00', end_time: '16:30:00' }),
      booking({ status: 'cancelled', booking_date: dayOfMonth(4) }),
      booking({ customer_name: BRUNO.name, customer_phone: BRUNO.phone, customer_email: BRUNO.email, service_name: 'Barba', service_price: 35, status: 'confirmed', booking_date: iso(addDays(today, 1)), start_time: '09:00:00', end_time: '09:30:00' }),
      booking({ customer_name: CARLA.name, customer_phone: CARLA.phone, customer_email: null, status: 'pending', booking_date: iso(addDays(today, 2)), start_time: '15:00:00', end_time: '15:30:00' }),
    ],

    customer_profiles: [
      { ...ANA, birth_date: '1990-03-12', vip: true, archived: false, satisfaction_status: 'satisfied', return_interval_days: 21, notes: 'Cliente fictícia dos testes.', created_at: '2026-01-10T12:00:00Z', updated_at: tsOfMonth(1) },
      { ...BRUNO, birth_date: null, vip: false, archived: false, satisfaction_status: null, return_interval_days: null, notes: null, created_at: '2026-02-05T12:00:00Z', updated_at: tsOfMonth(1) },
      { ...CARLA, birth_date: '1985-11-30', vip: false, archived: false, satisfaction_status: null, return_interval_days: 30, notes: null, created_at: '2026-03-01T12:00:00Z', updated_at: tsOfMonth(1) },
    ],

    // 2 respondidas no mês (1 satisfeito + 1 sugestão => taxa de 50%) e 1 pendente.
    experience_requests: [
      { id: 'mock-xp-1', customer_id: ANA.id, booking_id: null, answer: 'satisfied', status: 'satisfied', feedback: null, created_at: tsOfMonth(3, 12), answered_at: tsOfMonth(3, 13) },
      { id: 'mock-xp-2', customer_id: BRUNO.id, booking_id: null, answer: 'suggestion', status: 'feedback', feedback: 'Poderia ter café no balcão.', created_at: tsOfMonth(5, 12), answered_at: tsOfMonth(5, 18) },
      { id: 'mock-xp-3', customer_id: CARLA.id, booking_id: null, answer: null, status: 'pending', feedback: null, created_at: tsOfMonth(8, 12), answered_at: null },
    ],

    waitlist: [
      { id: 'mock-wl-1', customer_name: 'Diego Fictício', customer_phone: '11933332222', customer_email: null, service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 30, preferred_date: null, preferred_weekdays: [2, 3], preferred_period: 'tarde', preferred_time_start: null, preferred_time_end: null, window_start: null, window_end: null, notes: 'Prefere depois das 15h.', source: 'site', status: 'esperando', booking_id: null, notified_at: null, scheduled_at: null, created_at: tsOfMonth(2), updated_at: tsOfMonth(2) },
      { id: 'mock-wl-2', customer_name: 'Elisa Imaginária', customer_phone: '5511944443333', customer_email: 'elisa@example.com', service_name: 'Corte + Barba', service_price: 60, duration_minutes: 60, preferred_date: iso(addDays(today, 3)), preferred_weekdays: [], preferred_period: 'qualquer', preferred_time_start: '09:00:00', preferred_time_end: '12:00:00', window_start: null, window_end: null, notes: null, source: 'admin', status: 'avisado', booking_id: null, notified_at: tsOfMonth(6), scheduled_at: null, created_at: tsOfMonth(4), updated_at: tsOfMonth(6) },
      { id: 'mock-wl-3', customer_name: 'Fábio Fictício', customer_phone: '5511955554444', customer_email: null, service_name: 'Barboterapia', service_price: 40, duration_minutes: 30, preferred_date: iso(addDays(today, 5)), preferred_weekdays: [], preferred_period: 'qualquer', preferred_time_start: null, preferred_time_end: null, window_start: null, window_end: null, notes: null, source: 'whatsapp', status: 'esperando', booking_id: null, notified_at: null, scheduled_at: null, created_at: tsOfMonth(9), updated_at: tsOfMonth(9) },
      { id: 'mock-wl-4', customer_name: 'Gustavo Fictício', customer_phone: '5511966665555', customer_email: null, service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 30, preferred_date: null, preferred_weekdays: [], preferred_period: 'qualquer', preferred_time_start: null, preferred_time_end: null, window_start: null, window_end: null, notes: null, source: 'whatsapp', status: 'encaixado', booking_id: 'mock-bk-encaixe-1', notified_at: tsOfMonth(3), scheduled_at: tsOfMonth(5), created_at: tsOfMonth(1), updated_at: tsOfMonth(5) },
      { id: 'mock-wl-5', customer_name: 'Helena Fictícia', customer_phone: '5511977776666', customer_email: null, service_name: 'Barba Express', service_price: 25, duration_minutes: 20, preferred_date: null, preferred_weekdays: [], preferred_period: 'qualquer', preferred_time_start: null, preferred_time_end: null, window_start: null, window_end: null, notes: null, source: 'site', status: 'cancelado', booking_id: null, notified_at: null, scheduled_at: null, created_at: tsOfMonth(2), updated_at: tsOfMonth(3) },
    ],

    schedule_blocks: [
      { id: 'mock-blk-1', block_date: iso(addDays(today, 1)), all_day: false, start_time: '12:00:00', end_time: '13:00:00', reason: 'Almoço prolongado (teste)', created_at: tsOfMonth(1) },
    ],

    loyalty_accounts: [
      { customer_id: ANA.id, points: 7, rewards_available: 0, lifetime_points: 17, updated_at: tsOfMonth(8) },
      { customer_id: BRUNO.id, points: 2, rewards_available: 1, lifetime_points: 12, updated_at: tsOfMonth(5) },
    ],

    contact_messages: [
      { id: 'mock-cm-1', name: 'Visitante Site', email: 'visitante@example.com', phone: '11966665555', message: 'Vocês atendem sábado à tarde?', status: 'new', read_at: null, replied_at: null, archived_at: null, created_at: tsOfMonth(9, 9) },
      { id: 'mock-cm-2', name: 'Outra Pessoa', email: 'outra@example.com', phone: null, message: 'Parabéns pelo atendimento!', status: 'read', read_at: tsOfMonth(7, 11), replied_at: null, archived_at: null, created_at: tsOfMonth(7, 8) },
    ],

    email_queue: [
      { id: 'mock-eq-1', booking_id: null, event_type: 'booking_confirmed', recipient_type: 'customer', recipient_email: ANA.email, recipient_name: ANA.name, subject: 'Agendamento confirmado (teste)', status: 'sent', attempts: 1, last_error: null, sent_at: tsOfMonth(3, 10), created_at: tsOfMonth(3, 10) },
    ],

    sms_queue: [
      { id: 'mock-sq-1', booking_id: null, event_type: 'reminder_24h', recipient_type: 'customer', recipient_phone: ANA.phone, recipient_name: ANA.name, message_text: 'Lembrete fictício de agendamento.', status: 'sent', delivery_status: 'delivered', attempts: 1, last_error: null, sent_at: tsOfMonth(4, 9), created_at: tsOfMonth(4, 9) },
    ],

    integration_alerts: [
      { alert_key: 'smsdev_balance', last_value: '42', last_checked_at: tsOfMonth(9, 8), created_at: tsOfMonth(1), updated_at: tsOfMonth(9, 8) },
      { alert_key: 'whatsapp_connection', last_value: 'open', last_checked_at: tsOfMonth(9, 8), created_at: tsOfMonth(1), updated_at: tsOfMonth(9, 8) },
    ],

    customer_timeline: [
      { id: 1, customer_id: ANA.id, booking_id: null, event_type: 'booking_status_changed', title: 'Agendamento marcado como concluído', details: { from: 'confirmed', to: 'completed' }, created_at: tsOfMonth(3, 11) },
      { id: 2, customer_id: ANA.id, booking_id: null, event_type: 'booking_details_updated', title: 'Produtos do atendimento atualizados', details: { products: [{ name: 'Pomada Modeladora', price: 30 }] }, created_at: tsOfMonth(3, 12) },
    ],

    push_subscriptions: [
      { id: 'mock-ps-1', endpoint: 'https://example.com/push/mock-endpoint', keys: { p256dh: 'mock', auth: 'mock' }, device_label: 'Dispositivo de teste', created_at: tsOfMonth(1), last_seen_at: tsOfMonth(9) },
    ],

    google_reviews: [
      { id: 'mock-gr-1', google_review_id: 'accounts/mock/locations/mock/reviews/mock-1', reviewer_name: 'Marcos Testando', reviewer_photo_url: null, star_rating: 5, comment: 'Fiz a Barboterapia e adorei o cuidado, recomendo muito!', review_created_at: tsOfMonth(6), review_updated_at: tsOfMonth(6), ai_draft_reply: 'Que alegria, Marcos! Fico feliz que a Barboterapia tenha feito a diferença. Te esperamos sempre aqui na Barbearia do Ju em Bragança Paulista!', final_reply: 'Que alegria, Marcos! Fico feliz que a Barboterapia tenha feito a diferença. Te esperamos sempre aqui na Barbearia do Ju em Bragança Paulista!', status: 'pending', posted_at: null, last_error: null, created_at: tsOfMonth(6), updated_at: tsOfMonth(6) },
      { id: 'mock-gr-2', google_review_id: 'accounts/mock/locations/mock/reviews/mock-2', reviewer_name: 'Fernanda Cenário', reviewer_photo_url: null, star_rating: 4, comment: 'Bom atendimento na Barba Express, só achei a espera um pouco longa.', review_created_at: tsOfMonth(4), review_updated_at: tsOfMonth(4), ai_draft_reply: 'Obrigado pelo retorno, Fernanda! Vamos ficar de olho no tempo de espera. Até a próxima Barba Express aqui na Barbearia do Ju!', final_reply: 'Obrigado pelo retorno, Fernanda! Vamos melhorar o tempo de espera. Até a próxima Barba Express aqui na Barbearia do Ju!', status: 'approved', posted_at: null, last_error: null, created_at: tsOfMonth(4), updated_at: tsOfMonth(5) },
      { id: 'mock-gr-3', google_review_id: 'accounts/mock/locations/mock/reviews/mock-3', reviewer_name: 'Ricardo Ilustrativo', reviewer_photo_url: null, star_rating: 5, comment: 'Melhor barbearia de Bragança Paulista!', review_created_at: tsOfMonth(2), review_updated_at: tsOfMonth(2), ai_draft_reply: 'Muito obrigado, Ricardo! Ficamos muito felizes em ser sua barbearia de confiança em Bragança Paulista.', final_reply: 'Muito obrigado, Ricardo! Ficamos muito felizes em ser sua barbearia de confiança em Bragança Paulista.', status: 'posted', posted_at: tsOfMonth(3, 9), last_error: null, created_at: tsOfMonth(2), updated_at: tsOfMonth(3) },
      { id: 'mock-gr-4', google_review_id: 'accounts/mock/locations/mock/reviews/mock-4', reviewer_name: 'Cliente Anônimo Teste', reviewer_photo_url: null, star_rating: 2, comment: null, review_created_at: tsOfMonth(1), review_updated_at: tsOfMonth(1), ai_draft_reply: null, final_reply: null, status: 'ignored', posted_at: null, last_error: null, created_at: tsOfMonth(1), updated_at: tsOfMonth(1) },
    ],

    conversation_leads_scored: [
      { phone: '5599900021001', customer_name: 'Quente Testando', kind: 'availability', last_message_text: 'Quero cortar o cabelo dia 10 de manhã', service_interest: 'Corte de cabelo', date_interest: dayOfMonth(10), last_message_at: tsOfMonth(9), followup_stage: 1, followup_1_sent_at: tsOfMonth(9), followup_2_sent_at: null, reason: null, reason_detail: null, responded_at: null, resolved_at: null, resolution: null, slot_reopened_at: null, slot_reopened_notified_at: null, campaign_sent_at: null, heat: 'quente' },
      { phone: '5599900021002', customer_name: 'Morno Testando', kind: 'price_or_service', last_message_text: 'Quanto custa a barboterapia?', service_interest: 'Barboterapia', date_interest: null, last_message_at: tsOfMonth(8), followup_stage: 2, followup_1_sent_at: tsOfMonth(8), followup_2_sent_at: tsOfMonth(9), reason: 'preco', reason_detail: null, responded_at: tsOfMonth(9), resolved_at: null, resolution: null, slot_reopened_at: null, slot_reopened_notified_at: null, campaign_sent_at: null, heat: 'morno' },
      { phone: '5599900021003', customer_name: 'Frio Testando', kind: 'price_or_service', last_message_text: 'Só queria saber os preços mesmo', service_interest: 'Luzes', date_interest: null, last_message_at: tsOfMonth(2), followup_stage: 2, followup_1_sent_at: tsOfMonth(2), followup_2_sent_at: tsOfMonth(3), reason: 'so_pesquisando', reason_detail: null, responded_at: tsOfMonth(3), resolved_at: null, resolution: null, slot_reopened_at: null, slot_reopened_notified_at: null, campaign_sent_at: null, heat: 'frio' },
      { phone: '5599900021004', customer_name: 'Vaga Reaberta Testando', kind: 'availability', last_message_text: 'Queria dia 8 de tarde', service_interest: 'Corte + Barba Express', date_interest: dayOfMonth(8), last_message_at: tsOfMonth(6), followup_stage: 1, followup_1_sent_at: tsOfMonth(6), followup_2_sent_at: null, reason: null, reason_detail: null, responded_at: null, resolved_at: null, resolution: null, slot_reopened_at: tsOfMonth(7), slot_reopened_notified_at: null, campaign_sent_at: null, heat: 'quente' },
      { phone: '5599900021005', customer_name: 'Convertido Testando', kind: 'availability', last_message_text: 'Fechado, pode marcar', service_interest: 'Corte de cabelo', date_interest: dayOfMonth(5), last_message_at: tsOfMonth(5), followup_stage: 0, followup_1_sent_at: null, followup_2_sent_at: null, reason: null, reason_detail: null, responded_at: null, resolved_at: tsOfMonth(5, 15), resolution: 'booked', slot_reopened_at: null, slot_reopened_notified_at: null, campaign_sent_at: null, heat: 'quente' },
    ],
  };

  // Respostas das RPCs e Edge Functions quando alguma tela as chamar.
  const rpcs = {
    admin_create_booking: 'mock-bk-novo',
    admin_reschedule_booking: null,
    admin_register_walkin_visit: 'mock-bk-balcao',
    admin_save_customer_v23: null,
    admin_archive_customer: null,
    admin_delete_customer_permanently: null,
    ...(overrides.rpcs || {}),
  };
  const functions = { ...(overrides.functions || {}) };

  for (const [name, rows] of Object.entries(overrides.tables || {})) tables[name] = rows;
  return { tables, rpcs, functions };
}
