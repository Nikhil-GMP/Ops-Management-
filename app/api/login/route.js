import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  makeSessionToken,
  safeEqual,
} from "../../../lib/auth";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {}

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const okEmail = (process.env.DASH_EMAIL || "").trim().toLowerCase();
  const okPass = process.env.DASH_PASSWORD || "";

  if (!okEmail || !okPass || !process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const emailOk = safeEqual(email, okEmail);
  const passOk = safeEqual(password, okPass);

  if (!(emailOk && passOk)) {
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, makeSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
