// Funções puras de formatação/regra de agenda, compartilhadas entre o
// carrinho de serviços (service-cart-v22-5.js) e a tela de data/horário
// (agenda-v15.js). Sem DOM, sem rede - só o que dá pra testar isoladamente.
// Testes: tests/unit/booking-format.spec.js

export const money = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "1h30" / "1h" / "45 min" / "45min" -> minutos. Sem hora nem minuto reconhecível, assume 30.
// "1h30" precisa do caso combinado: sem ele, "30" é descartado por não ter "min" no texto
// (bug real encontrado pelos testes unitários em 2026-07-28 - "Luzes" virava 60min em vez de 90).
export const parseDuration = (value) => {
  const text = String(value || '').trim().toLowerCase();
  const combined = text.match(/(\d+)\s*h\s*(\d+)/);
  if (combined) return Number(combined[1]) * 60 + Number(combined[2]);
  const hours = Number((text.match(/(\d+)\s*h\b/) || [0, 0])[1]);
  const minutes = Number((text.match(/(\d+)\s*min/) || [0, 0])[1]);
  return hours * 60 + minutes || 30;
};

// Inverso de parseDuration: minutos -> "1h30" / "1h" / "45 min".
export const fmtDuration = (totalMinutes) =>
  totalMinutes >= 60
    ? (totalMinutes % 60 ? `${Math.floor(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, '0')}` : `${totalMinutes / 60}h`)
    : `${totalMinutes} min`;

export const addMinutes = (time, mins) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m + mins);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const dayOfWeek = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

// Barbearia atende terça(2) a sábado(6); domingo(0) e segunda(1) fechado.
export const isOpenDay = (iso) => {
  const d = dayOfWeek(iso);
  return d >= 2 && d <= 6;
};

// Sábado fecha às 15h, demais dias às 19h.
export const closingMinutes = (iso) => (dayOfWeek(iso) === 6 ? 15 * 60 : 19 * 60);

export const prettyDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

export const nextOpenDay = (iso, step = 1) => {
  let d = iso;
  for (let i = 0; i < 8; i++) {
    d = addDaysISO(d, step);
    if (isOpenDay(d)) return d;
  }
  return d;
};
