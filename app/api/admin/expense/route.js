import { NextResponse } from "next/server";
import { db } from "../../../../lib/supabase";
import { isAdmin } from "../../../../lib/auth";
import { CATEGORIES } from "../../../../lib/categories";

export async function PATCH(request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const id = String(body.id || "");
  const amount = Number(body.amount);
  const category = String(body.category || "");
  const date = String(body.date || "");
  const note = String(body.note || "").trim().slice(0, 200);

  if (!id) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const { error } = await db()
    .from("expenses")
    .update({
      amount_paise: Math.round(amount * 100),
      category: category,
      spent_on: date,
      note: note || null,
    })
    .eq("id", id);

  if (error) {
    console.error("expense update failed:", error.message);
    return NextResponse.json({ error: "Could not update" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const id = String(body.id || "");
  if (!id) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { error } = await db().from("expenses").delete().eq("id", id);
  if (error) {
    console.error("expense delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
