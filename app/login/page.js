"use client";

import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "Login failed");
    } catch (err) {
      setMsg("Network error");
    }
    setBusy(false);
  }

  return (
    <div className="narrow">
      <h1>Login</h1>
      <form onSubmit={submit}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="full" type="submit" disabled={busy}>
          {busy ? "Please wait..." : "Login"}
        </button>
      </form>
      {msg ? <div className="msg err">{msg}</div> : null}
    </div>
  );
}
