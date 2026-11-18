"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "../../lib/categories";
import { inr } from "../../lib/money";

export function LogoutButton() {
  const router = useRouter();

  async function out() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {}
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="ghost" onClick={out}>
      Logout
    </button>
  );
}

async function call(method, payload) {
  try {
    const res = await fetch("/api/admin/expense", {
      method: method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || "Failed" };
  } catch (e) {
    return { ok: false, error: "Network error" };
  }
}

export function ExpenseTable({ rows }) {
  const router = useRouter();
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function startEdit(r) {
    setEditId(r.id);
    setForm({
      amount: String(r.amount_paise / 100),
      category: r.category,
      date: r.spent_on,
      note: r.note || "",
    });
    setMsg("");
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEdit() {
    setBusy(true);
    setMsg("");
    const r = await call("PATCH", { id: editId, ...form });
    setBusy(false);
    if (r.ok) {
      setEditId(null);
      router.refresh();
    } else {
      setMsg(r.error);
    }
  }

  async function remove(row) {
    const ok = window.confirm(
      "Delete this expense: " + inr(row.amount_paise) + " (" + row.category + ")?"
    );
    if (!ok) return;
    setBusy(true);
    setMsg("");
    const r = await call("DELETE", { id: row.id });
    setBusy(false);
    if (r.ok) {
      router.refresh();
    } else {
      setMsg(r.error);
    }
  }

  if (!rows.length) {
    return <div className="small">No expenses yet.</div>;
  }

  return (
    <div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Note</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editId === r.id ? (
                <tr key={r.id}>
                  <td>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setField("date", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={form.category}
                      onChange={(e) => setField("category", e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      maxLength={200}
                      value={form.note}
                      onChange={(e) => setField("note", e.target.value)}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                    />
                  </td>
                  <td className="row-actions">
                    <button disabled={busy} onClick={saveEdit}>
                      Save
                    </button>
                    <button className="ghost" onClick={() => setEditId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td>{r.spent_on}</td>
                  <td>{r.category}</td>
                  <td>{r.note || ""}</td>
                  <td className="num">{inr(r.amount_paise)}</td>
                  <td className="row-actions">
                    <button className="ghost" disabled={busy} onClick={() => startEdit(r)}>
                      Edit
                    </button>
                    <button className="danger" disabled={busy} onClick={() => remove(r)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {msg ? <div className="msg err">{msg}</div> : null}
    </div>
  );
}
