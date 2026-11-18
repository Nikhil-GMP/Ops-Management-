import { NextResponse } from "next/server";
import { db } from "../../../lib/supabase";
import { safeEqual } from "../../../lib/auth";
import { CATEGORIES } from "../../../lib/categories";

export async function POST(request) {
  const pin = request.headers.get("x-pin") || "";
  const expected = process.env.ADD_PIN || "";

  if (!expected || !safeEqual(pin, expected)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const category = String(body.category || "");
  const date = String(body.date || "");
  const note = String(body.note || "").trim().slice(0, 200);
  const clientId = String(body.clientId || "").slice(0, 80);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { error } = await db()
    .from("expenses")
    .upsert(
      {
        client_id: clientId,
        amount_paise: Math.round(amount * 100),
        category: category,
        spent_on: date,
        note: note || null,
      },
      { onConflict: "client_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("expense insert failed:", error.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
