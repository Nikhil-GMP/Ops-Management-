"use client";

import { useMemo, useState } from "react";
import { inr } from "../../lib/money";

const W = 900;
const H = 380;
const PAD = { l: 58, r: 34, t: 18, b: 32 };
const GREEN = "#2dff8f";
const RED = "#ff3d6a";
const BOLT = "#8ff3ff";
const BOLT_BAD = "#ffb347";
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

// Picks a tidy axis: returns the top value and the tick step (both in rupees).
function niceAxis(maxRupees) {
  if (maxRupees <= 0) return { top: 100, step: 25 };
  const raw = maxRupees / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const options = [1, 2, 2.5, 5, 10];
  let step = exp * 10;
  for (const o of options) {
    if (exp * o >= raw) {
      step = exp * o;
      break;
    }
  }
  const top = Math.ceil((maxRupees * 1.04) / step) * step;
  return { top: top, step: step };
}

// Same input always gives the same number, so server and browser draw the same bolt.
function rnd(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function pt(x, y) {
  return Math.round(x * 10) / 10 + "," + Math.round(y * 10) / 10;
}

function toD(points) {
  return points.length ? "M" + points.join(" L") : "";
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
  const [range, setRange] = useState("all");
  const [hover, setHover] = useState(null);

  // Running totals over all days, so the lines only ever go up.
  const cum = useMemo(() => {
    let a = 0;
    let b = 0;
    return daily.map((r) => {
      a += r.revenue;
      b += r.outflow;
      return { d: r.d, revenue: a, outflow: b };
    });
  }, [daily]);

  const rows = useMemo(() => {
    if (view === "monthly") {
      const map = new Map();
      for (const r of cum) {
        const k = r.d.slice(0, 7);
        map.set(k, { k: k, label: monthLabel(k), revenue: r.revenue, outflow: r.outflow });
      }
      return Array.from(map.values());
    }
    let from = null;
    if (range === "30") from = addDaysStr(today, -29);
    else if (range === "90") from = addDaysStr(today, -89);
    else if (range === "month") from = today.slice(0, 7) + "-01";
    const list = from ? cum.filter((r) => r.d >= from) : cum;
    return list.map((r) => ({
      k: r.d,
      label: dayLabel(r.d),
      revenue: r.revenue,
      outflow: r.outflow,
    }));
  }, [cum, view, range, today]);

  const n = rows.length;
  const maxPaise = rows.reduce((m, r) => Math.max(m, r.revenue, r.outflow), 0);
  const axis = niceAxis(maxPaise / 100);
  const top = axis.top;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (paise) => PAD.t + ih - (paise / 100 / top) * ih;

  // Glowing fill between the two lines (green = profit, red = loss).
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

  const revD = toD(rows.map((r, i) => pt(x(i), y(r.revenue))));
  const outD = toD(rows.map((r, i) => pt(x(i), y(r.outflow))));

  // Lightning: a jagged electric line through the middle of the profit gap.
  // It is drawn only where the two lines are far enough apart.
  const boltRuns = [];
  let run = [];
  for (let i = 0; i < n - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const x0 = x(i);
    const x1 = x(i + 1);
    const m0 = (y(a.revenue) + y(a.outflow)) / 2;
    const m1 = (y(b.revenue) + y(b.outflow)) / 2;
    const gap = (Math.abs(y(a.revenue) - y(a.outflow)) + Math.abs(y(b.revenue) - y(b.outflow))) / 2;
    if (gap < 9) {
      if (run.length > 1) boltRuns.push(run);
      run = [];
      continue;
    }
    const amp = Math.min(gap * 0.26, 9);
    for (let s = 0; s < 3; s++) {
      const t = s / 3;
      const jit = (rnd(i * 7 + s) - 0.5) * 2 * amp;
      run.push(pt(x0 + (x1 - x0) * t, m0 + (m1 - m0) * t + jit));
    }
    if (i === n - 2) run.push(pt(x1, m1));
  }
  if (run.length > 1) boltRuns.push(run);
  const boltD = boltRuns.map((r) => toD(r)).join(" ");

  // Short vertical sparks that jump between the two lines.
  const sparks = [];
  const sparkEvery = Math.max(1, Math.round(n / 9));
  for (let i = 0; i < n; i += sparkEvery) {
    const y1 = y(rows[i].revenue);
    const y2 = y(rows[i].outflow);
    if (Math.abs(y1 - y2) < 18) continue;
    const p = [];
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      const dx = s === 0 || s === 6 ? 0 : (rnd(i * 13 + s) - 0.5) * 11;
      p.push(pt(x(i) + dx, y1 + (y2 - y1) * t));
    }
    sparks.push({ i: i, d: toD(p), good: rows[i].revenue >= rows[i].outflow });
  }

  const last = n ? rows[n - 1] : null;
  const lastGood = last ? last.revenue >= last.outflow : true;
  const boltColor = lastGood ? BOLT : BOLT_BAD;

  const ticks = [];
  for (let v = 0; v <= top + 0.001; v += axis.step) ticks.push(v);
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

  function pick(set, value) {
    set(value);
    setHover(null);
  }

  const hv = hover !== null && rows[hover] ? rows[hover] : null;
  const shown = hv || last;
  const showRev = shown ? shown.revenue : 0;
  const showOut = shown ? shown.outflow : 0;
  const showProfit = showRev - showOut;
  const showLabel = hv ? hv.label : last ? "Till " + last.label : "";
  const animKey = view + "-" + range;

  return (
    <div className="chart-box neon">
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
      </div>

      <div className="neon-stats">
        <div className="ns">
          <div className="ns-k">Revenue so far</div>
          <div className="ns-v g">{inr(showRev)}</div>
        </div>
        <div className="ns">
          <div className="ns-k">Expenses so far</div>
          <div className="ns-v r">{inr(showOut)}</div>
        </div>
        <div className="ns">
          <div className="ns-k">Profit</div>
          <div className={"ns-v " + (showProfit >= 0 ? "b" : "o")}>{inr(showProfit)}</div>
        </div>
        <div className="ns-when">{showLabel}</div>
      </div>

      {n === 0 ? (
        <div className="small">No data yet.</div>
      ) : (
        <svg
          viewBox={"0 0 " + W + " " + H}
          width="100%"
          role="img"
          aria-label="Running total of revenue and expenses with profit between them"
          style={{ display: "block", touchAction: "pan-y" }}
        >
          <defs>
            <filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowBig" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <linearGradient id="gGood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GREEN} stopOpacity="0.5" />
              <stop offset="0.55" stopColor="#22e6d0" stopOpacity="0.3" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id="gBad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={RED} stopOpacity="0.5" />
              <stop offset="1" stopColor="#ff9a3d" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t * 100)} y2={y(t * 100)} stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t * 100) + 4} textAnchor="end" fontSize="11" fill="#8b93a7">
                {compact(t)}
              </text>
            </g>
          ))}

          {rows.map((r, i) =>
            i % step === 0 ? (
              <text key={r.k} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="#8b93a7">
                {r.label}
              </text>
            ) : null
          )}

          <g key={animKey}>
            <g className="fx-fade">
              <g filter="url(#glowBig)" opacity="0.55">
                {shades.map((s, i) => (
                  <polygon key={i} points={s.pts} fill={s.good ? GREEN : RED} fillOpacity="0.5" />
                ))}
              </g>
              {shades.map((s, i) => (
                <polygon key={i} points={s.pts} fill={s.good ? "url(#gGood)" : "url(#gBad)"} />
              ))}
            </g>

            <path d={outD} className="ln-wide" stroke={RED} filter="url(#glowBig)" />
            <path d={revD} className="ln-wide" stroke={GREEN} filter="url(#glowBig)" />
            <path d={outD} className="ln-draw" stroke={RED} strokeWidth="3.2" pathLength="1" filter="url(#glow)" />
            <path d={revD} className="ln-draw" stroke={GREEN} strokeWidth="3.2" pathLength="1" filter="url(#glow)" />
            <path d={outD} className="ln-draw" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" pathLength="1" />
            <path d={revD} className="ln-draw" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" pathLength="1" />

            <g className="fx-fade-late">
              {sparks.map((s) => (
                <path
                  key={s.i}
                  d={s.d}
                  className="spark"
                  stroke={s.good ? BOLT : BOLT_BAD}
                  filter="url(#glow)"
                  style={{ animationDelay: ((s.i * 37) % 23) / 10 + "s" }}
                />
              ))}
              <path d={boltD} className="bolt-halo" stroke={boltColor} filter="url(#glowBig)" />
              <path d={boltD} className="bolt-core" stroke={boltColor} filter="url(#glow)" />
              <path d={boltD} className="bolt-flow" stroke="#ffffff" />
            </g>
          </g>

          {n <= 45
            ? rows.map((r, i) => (
                <g key={r.k}>
                  <circle cx={x(i)} cy={y(r.outflow)} r="2.4" fill={RED} />
                  <circle cx={x(i)} cy={y(r.revenue)} r="2.4" fill={GREEN} />
                </g>
              ))
            : null}

          {last ? (
            <g>
              <circle className="pulse" cx={x(n - 1)} cy={y(last.revenue)} r="5" fill={GREEN} />
              <circle className="pulse" cx={x(n - 1)} cy={y(last.outflow)} r="5" fill={RED} style={{ animationDelay: "0.6s" }} />
              <circle cx={x(n - 1)} cy={y(last.revenue)} r="5" fill="#ffffff" stroke={GREEN} strokeWidth="2.5" filter="url(#glow)" />
              <circle cx={x(n - 1)} cy={y(last.outflow)} r="5" fill="#ffffff" stroke={RED} strokeWidth="2.5" filter="url(#glow)" />
            </g>
          ) : null}

          {hv ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx={x(hover)} cy={y(hv.outflow)} r="6" fill="#ffffff" stroke={RED} strokeWidth="3" filter="url(#glow)" />
              <circle cx={x(hover)} cy={y(hv.revenue)} r="6" fill="#ffffff" stroke={GREEN} strokeWidth="3" filter="url(#glow)" />
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
        Green line = total revenue so far. Red line = total expenses so far (your entries + refunds + Razorpay
        charges). The glowing gap between them is your profit. Hover or tap the chart to see any day or month.
      </div>
    </div>
  );
}
