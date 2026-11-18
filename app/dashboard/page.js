import { redirect } from "next/navigation";
import { db } from "../../lib/supabase";
import { isAdmin } from "../../lib/auth";
import { inr } from "../../lib/money";
import { ExpenseTable, LogoutButton } from "./Client";

export const dynamic = "force-dynamic";

function tone(n) {
  return n >= 0 ? "profit" : "loss";
}

export default async function Dashboard() {
  if (!(await isAdmin())) {
    redirect("/login");
  }

  const [months, expenses, payments, nonInr] = await Promise.all([
    db().from("monthly_summary").select("*"),
    db()
      .from("expenses")
      .select("*")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    db()
      .from("payments")
      .select("*")
      .order("paid_at", { ascending: false })
      .limit(20),
    db()
      .from("payments")
      .select("id", { count: "exact", head: true })
      .neq("currency", "INR"),
  ]);

  const monthRows = months.data || [];
  const t = monthRows.reduce(
    (a, m) => ({
      revenue: a.revenue + Number(m.revenue),
      refunds: a.refunds + Number(m.refunds),
      charges: a.charges + Number(m.charges),
      expenses: a.expenses + Number(m.expenses),
    }),
    { revenue: 0, refunds: 0, charges: 0, expenses: 0 }
  );
  const profit = t.revenue - t.refunds - t.charges - t.expenses;

  const firstError = months.error || expenses.error || payments.error;

  return (
    <div className="wrap">
      <div className="top">
        <h1>GrowMyPin Dashboard</h1>
        <LogoutButton />
      </div>

      {firstError ? (
        <div className="msg err">Data error: {firstError.message}</div>
      ) : null}

      <div className="cards">
        <div className="card">
          <div className="k">Revenue (gross)</div>
          <div className="v">{inr(t.revenue)}</div>
        </div>
        <div className="card">
          <div className="k">Refunds</div>
          <div className="v">{inr(t.refunds)}</div>
        </div>
        <div className="card">
          <div className="k">Razorpay charges (fee + GST)</div>
          <div className="v">{inr(t.charges)}</div>
        </div>
        <div className="card">
          <div className="k">Expenses</div>
          <div className="v">{inr(t.expenses)}</div>
        </div>
        <div className="card">
          <div className="k">Profit</div>
          <div className={"v " + tone(profit)}>{inr(profit)}</div>
        </div>
      </div>
      <div className="small">
        Profit = Revenue - Refunds - Razorpay charges - Expenses. Only INR payments are counted
        {nonInr.count ? " (" + nonInr.count + " non-INR payment(s) excluded)" : ""}.
      </div>

      <h2>Month-wise</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Revenue</th>
              <th className="num">Refunds</th>
              <th className="num">Charges</th>
              <th className="num">Expenses</th>
              <th className="num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {monthRows.map((m) => {
              const p =
                Number(m.revenue) -
                Number(m.refunds) -
                Number(m.charges) -
                Number(m.expenses);
              return (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td className="num">{inr(m.revenue)}</td>
                  <td className="num">{inr(m.refunds)}</td>
                  <td className="num">{inr(m.charges)}</td>
                  <td className="num">{inr(m.expenses)}</td>
                  <td className={"num " + tone(p)}>{inr(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Expenses (latest 100)</h2>
      <ExpenseTable rows={expenses.data || []} />

      <h2>Recent payments (latest 20)</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Payment ID</th>
              <th>Method</th>
              <th>Email</th>
              <th className="num">Amount</th>
              <th className="num">Charges</th>
            </tr>
          </thead>
          <tbody>
            {(payments.data || []).map((p) => (
              <tr key={p.id}>
                <td>
                  {new Date(p.paid_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>{p.id}</td>
                <td>{p.method || ""}</td>
                <td>{p.email || ""}</td>
                <td className="num">{inr(p.amount_paise)}</td>
                <td className="num">{inr(p.fee_paise + p.tax_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
