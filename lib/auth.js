import crypto from "crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "gmp_session";
const SESSION_DAYS = 7;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function sign(text) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(text)
    .digest("hex");
}

export function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function makeSessionToken() {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  return exp + "." + sign(String(exp));
}

export function isValidSessionToken(token) {
  if (!token || !process.env.SESSION_SECRET) return false;
  const parts = String(token).split(".");
  if (parts.length !== 2) return false;
  const exp = Number(parts[0]);
  if (!exp || exp < Date.now()) return false;
  return safeEqual(parts[1], sign(parts[0]));
}

export async function isAdmin() {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  return isValidSessionToken(c ? c.value : "");
}
