"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "../../lib/categories";

function todayLocal() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now() + "-" + Math.random().toString(36).slice(2);
}

export default function AddExpense() {
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [isErr, setIsErr] = useState(false);

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("gmp_pin") || "";
    } catch (e) {}
    setPin(saved);
    setDate(todayLocal());
    setClientId(newId());
    setReady(true);
  }, []);

  function savePin(e) {
    e.preventDefault();
    const p = pinInput.trim();
    if (!p) return;
    try {
      localStorage.setItem("gmp_pin", p);
    } catch (err) {}
    setPin(p);
    setPinInput("");
    setMsg("");
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/expense", {
        method: "POST",
        headers: { "content-type": "application/json", "x-pin": pin },
        body: JSON.stringify({ clientId, amount, category, date, note }),
      });
      if (res.status === 401) {
        try {
          localStorage.removeItem("gmp_pin");
        } catch (err) {}
        setPin("");
        setIsErr(true);
        setMsg("Wrong PIN. Enter again.");
      } else if (res.ok) {
        setIsErr(false);
        setMsg("Saved");
        setAmount("");
        setNote("");
        setClientId(newId());
      } else {
        const data = await res.json().catch(() => ({}));
        setIsErr(true);
        setMsg(data.error || "Could not save. Try again.");
      }
    } catch (err) {
      setIsErr(true);
      setMsg("No internet. Try again.");
    }
    setSaving(false);
  }

  if (!ready) return null;

  if (!pin) {
    return (
      <div className="narrow">
        <h1>Enter PIN</h1>
        <form onSubmit={savePin}>
          <label>PIN</label>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            autoComplete="off"
          />
          <button className="full" type="submit">
            Continue
          </button>
        </form>
        {msg ? <div className={"msg " + (isErr ? "err" : "ok")}>{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1>Add expense</h1>
      <form onSubmit={submit}>
        <label>Amount (INR)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <label>Note (optional)</label>
        <input
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="full" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
      {msg ? <div className={"msg " + (isErr ? "err" : "ok")}>{msg}</div> : null}
    </div>
  );
}
