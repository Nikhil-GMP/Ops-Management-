"use client";

import { useMemo, useState } from "react";
import { inr } from "../../lib/money";

const W = 900;
const H = 320;
const PAD = { l: 56, r: 28, t: 14, b: 30 };
const GREEN = "#34d399";
const RED = "#f87171";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(d) {
  return Number(d.slice(8, 10)) + " " + MONTHS[Number(d.slice(5, 7)) - 1];
}

function monthLabel(m) {
  return MONTHS[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4);
}

function addDaysStr(d, n) {
  const t = Date.parse(d + "T00:00:00Z") + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function compact(rupees) {
  const a = Math.abs(rupees);
  if (a >= 10000000) return (rupees / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (a >= 100000) return (rupees / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (a >= 1000) return (rupees / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(rupees * 100) / 100);
}

function niceMax(v) {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * exp;
}

function pt(x, y) {
  return x.toFixed(1) + "," + y.toFixed(1);
}

function Seg({ value, current, set, onPick, children }) {
  return (
    <button
      type="button"
      className={"seg-btn" + (value === current ? " on" : "")}
      onClick={() => onPick(set, value)}
    >
      {children}
    </button>
  );
}

export default function Chart({ daily, today }) {
  const [view, setView] = useState("daily");
  const [range, setRange] = useState("30");
  const [running, setRunning] = useState(false);
  const [hover, setHover] = useState(null);

  const base = useMemo(() => {
    if (view === "monthly") {
      const map = new Map();
      for (const r of daily) {
        const k = r.d.slice(0, 7);
        let cur = map.get(k);
        if (!cur) {
          cur = { k: k, label: monthLabel(k), revenue: 0, outflow: 0 };
          map.set(k, cur);
        }
        cur.revenue += r.revenue;
        cur.outflow += r.outflow;
      }
      return Array.from(map.values());
    }
    let from = null;
    if (range === "30") from = addDaysStr(today, -29);
    else if (range === "90") from = addDaysStr(today, -89);
    else if (range === "month") from = today.slice(0, 7) + "-01";
    const list = from ? daily.filter((r) => r.d >= from) : daily;
    return list.map((r) => ({
      k: r.d,
      label: dayLabel(r.d),
      revenue: r.revenue,
      outflow: r.outflow,
    }));
  }, [daily, today, view, range]);

  const rows = useMemo(() => {
    if (!running) return base;
    let a = 0;
    let b = 0;
    return base.map((r) => {
      a += r.revenue;
      b += r.outflow;
      return { k: r.k, label: r.label, revenue: a, outflow: b };
    });
  }, [base, running]);

  const n = rows.length;
  const totalRev = base.reduce((s, r) => s + r.revenue, 0);
  const totalOut = base.reduce((s, r) => s + r.outflow, 0);

  const maxPaise = rows.reduce((m, r) => Math.max(m, r.revenue, r.outflow), 0);
  const top = niceMax(maxPaise / 100);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (paise) => PAD.t + ih - ((paise / 100) / top) * ih;

  const shades = [];
  for (let i = 0; i < n - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const d0 = a.revenue - a.outflow;
    const d1 = b.revenue - b.outflow;
    const x0 = x(i);
    const x1 = x(i + 1);
    if ((d0 >= 0 && d1 >= 0) || (d0 <= 0 && d1 <= 0)) {
      shades.push({
        good: d0 + d1 >= 0,
        pts: [pt(x0, y(a.revenue)), pt(x1, y(b.revenue)), pt(x1, y(b.outflow)), pt(x0, y(a.outflow))].join(" "),
      });
    } else {
      const t = d0 / (d0 - d1);
      const xc = x0 + (x1 - x0) * t;
      const vc = a.revenue + (b.revenue - a.revenue) * t;
      shades.push({
        good: d0 > 0,
        pts: [pt(x0, y(a.revenue)), pt(xc, y(vc)), pt(x0, y(a.outflow))].join(" "),
      });
      shades.push({
        good: d1 > 0,
        pts: [pt(xc, y(vc)), pt(x1, y(b.revenue)), pt(x1, y(b.outflow))].join(" "),
      });
    }
  }

  const revPts = rows.map((r, i) => pt(x(i), y(r.revenue))).join(" ");
  const outPts = rows.map((r, i) => pt(x(i), y(r.outflow))).join(" ");

  const ticks = [0, 1, 2, 3, 4].map((i) => (top * i) / 4);
  const step = Math.max(1, Math.ceil(n / 7));

  function onMove(e) {
    if (!n) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const fx = ((e.clientX - rect.left) / rect.width) * W;
    let idx = n <= 1 ? 0 : Math.round(((fx - PAD.l) / iw) * (n - 1));
    if (idx < 0) idx = 0;
    if (idx > n - 1) idx = n - 1;
    setHover(idx);
  }

  function onLeave(e) {
    if (e.pointerType === "mouse") setHover(null);
  }

  const hv = hover !== null && rows[hover] ? rows[hover] : null;
  const showRev = hv ? hv.revenue : running && n ? rows[n - 1].revenue : totalRev;
  const showOut = hv ? hv.outflow : running && n ? rows[n - 1].outflow : totalOut;
  const showLabel = hv
    ? hv.label + (running ? " (running total)" : "")
    : view === "monthly"
    ? "All months total"
    : "Selected range total";
  const showProfit = showRev - showOut;

  function pick(set, value) {
    set(value);
    setHover(null);
  }

  return (
    <div className="chart-box">
      <div className="chart-controls">
        <div className="seg">
          <Seg value="daily" current={view} set={setView} onPick={pick}>Daily</Seg>
          <Seg value="monthly" current={view} set={setView} onPick={pick}>Monthly</Seg>
        </div>
        {view === "daily" ? (
          <div className="seg">
            <Seg value="30" current={range} set={setRange} onPick={pick}>30 days</Seg>
            <Seg value="month" current={range} set={setRange} onPick={pick}>This month</Seg>
            <Seg value="90" current={range} set={setRange} onPick={pick}>90 days</Seg>
            <Seg value="all" current={range} set={setRange} onPick={pick}>All</Seg>
          </div>
        ) : null}
        <div className="seg">
          <Seg value={false} current={running} set={setRunning} onPick={pick}>Per {view === "monthly" ? "month" : "day"}</Seg>
          <Seg value={true} current={running} set={setRunning} onPick={pick}>Running total</Seg>
        </div>
      </div>

      <div className="chart-info">
        <span className="ci-label">{showLabel}</span>
        <span style={{ color: GREEN }}>Revenue {inr(showRev)}</span>
        <span style={{ color: RED }}>Expenses {inr(showOut)}</span>
        <span className={showProfit >= 0 ? "profit" : "loss"}>Profit {inr(showProfit)}</span>
      </div>

      {n === 0 ? (
        <div className="small">No data yet.</div>
      ) : (
        <svg
          viewBox={"0 0 " + W + " " + H}
          width="100%"
          role="img"
          aria-label="Revenue and expenses chart"
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t * 100)} y2={y(t * 100)} stroke="#2b2f36" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t * 100) + 4} textAnchor="end" fontSize="11" fill="#9aa0a6">
                {compact(t)}
              </text>
            </g>
          ))}

          {rows.map((r, i) =>
            i % step === 0 ? (
              <text key={r.k} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#9aa0a6">
                {r.label}
              </text>
            ) : null
          )}

          {shades.map((s, i) => (
            <polygon key={i} points={s.pts} fill={s.good ? GREEN : RED} fillOpacity="0.16" stroke="none" />
          ))}

          <polyline points={outPts} fill="none" stroke={RED} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={revPts} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {n <= 31
            ? rows.map((r, i) => (
                <g key={r.k}>
                  <circle cx={x(i)} cy={y(r.outflow)} r="2.5" fill={RED} />
                  <circle cx={x(i)} cy={y(r.revenue)} r="2.5" fill={GREEN} />
                </g>
              ))
            : null}

          {hv ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#9aa0a6" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx={x(hover)} cy={y(hv.outflow)} r="5" fill={RED} />
              <circle cx={x(hover)} cy={y(hv.revenue)} r="5" fill={GREEN} />
            </g>
          ) : null}

          <rect
            x={PAD.l}
            y={PAD.t}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={onLeave}
          />
        </svg>
      )}

      <div className="small">
        Green line = revenue (payments). Red line = expenses (your entries + refunds + Razorpay charges).
        Shaded gap = profit (green) or loss (red). Hover or tap the chart to see a day or month.
      </div>
    </div>
  );
}
