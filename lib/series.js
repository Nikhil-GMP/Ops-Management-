// Pure helper functions (no imports) for the chart and buffer.
// All dates are India (IST) dates in the form YYYY-MM-DD.
import {
  BUFFER_OPENING_PAISE,
  BUFFER_PER_DAY_PAISE,
  BUFFER_START_DATE,
  BUFFER_OPENING_CUT_FROM_PROFIT,
} from "./config";

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function istDate(ms) {
  return new Date(ms + IST_MS).toISOString().slice(0, 10);
}

export function todayIST() {
  return istDate(Date.now());
}

function dayIndex(dateStr) {
  return Math.round(Date.parse(dateStr + "T00:00:00Z") / DAY_MS);
}

function fromDayIndex(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

// Revenue = payments. Outflow = expenses + refunds + Razorpay charges (fee + GST).
// Returns one row per day, from the first activity day to today (or the last activity day).
export function buildDaily(payments, refunds, expenses, today) {
  const map = new Map();

  function slot(d) {
    let s = map.get(d);
    if (!s) {
      s = { d: d, revenue: 0, outflow: 0 };
      map.set(d, s);
    }
    return s;
  }

  for (const p of payments) {
    if (!p.paid_at) continue;
    const s = slot(istDate(Date.parse(p.paid_at)));
    s.revenue += Number(p.amount_paise || 0);
    s.outflow += Number(p.fee_paise || 0) + Number(p.tax_paise || 0);
  }
  for (const r of refunds) {
    if (!r.refunded_at) continue;
    const s = slot(istDate(Date.parse(r.refunded_at)));
    s.outflow += Number(r.amount_paise || 0);
  }
  for (const e of expenses) {
    if (!e.spent_on) continue;
    const s = slot(String(e.spent_on).slice(0, 10));
    s.outflow += Number(e.amount_paise || 0);
  }

  let first = dayIndex(today);
  let last = dayIndex(today);
  for (const d of map.keys()) {
    const i = dayIndex(d);
    if (i < first) first = i;
    if (i > last) last = i;
  }

  const rows = [];
  for (let i = first; i <= last; i++) {
    const d = fromDayIndex(i);
    const s = map.get(d);
    rows.push({
      d: d,
      revenue: s ? s.revenue : 0,
      outflow: s ? s.outflow : 0,
    });
  }
  return rows;
}

// Buffer = opening + per-day amount x number of days (start day and today both counted).
// deduction = how much is cut from profit.
export function bufferInfo(today) {
  let days = 0;
  if (today >= BUFFER_START_DATE) {
    days = dayIndex(today) - dayIndex(BUFFER_START_DATE) + 1;
  }
  const daily = BUFFER_PER_DAY_PAISE * days;
  return {
    days: days,
    buffer: BUFFER_OPENING_PAISE + daily,
    deduction: (BUFFER_OPENING_CUT_FROM_PROFIT ? BUFFER_OPENING_PAISE : 0) + daily,
  };
}
