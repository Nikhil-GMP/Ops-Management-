import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "../../../lib/supabase";

export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const signature = request.headers.get("x-razorpay-signature") || "";
  const raw = await request.text();

  if (!secret || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const type = event.event;
  const payload = event.payload || {};

  if (type === "payment.captured") {
    const p = payload.payment && payload.payment.entity;
    if (p && p.id) {
      const createdAt = p.created_at || Math.floor(Date.now() / 1000);
      const { error } = await db()
        .from("payments")
        .upsert(
          {
            id: p.id,
            amount_paise: p.amount || 0,
            fee_paise: p.fee || 0,
            tax_paise: p.tax || 0,
            currency: p.currency || "INR",
            method: p.method || null,
            email: p.email || null,
            contact: p.contact || null,
            description: p.description || null,
            paid_at: new Date(createdAt * 1000).toISOString(),
          },
          { onConflict: "id" }
        );
      if (error) {
        console.error("payment upsert failed:", error.message);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
      }
    }
  } else if (type === "refund.processed") {
    const r = payload.refund && payload.refund.entity;
    if (r && r.id) {
      const createdAt = r.created_at || Math.floor(Date.now() / 1000);
      const { error } = await db()
        .from("refunds")
        .upsert(
          {
            id: r.id,
            payment_id: r.payment_id || null,
            amount_paise: r.amount || 0,
            currency: r.currency || "INR",
            refunded_at: new Date(createdAt * 1000).toISOString(),
          },
          { onConflict: "id" }
        );
      if (error) {
        console.error("refund upsert failed:", error.message);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
