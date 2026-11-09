// Password sessions for the dashboard. The browser only ever gets a signed,
// HttpOnly cookie; the GitHub token stays on the server.
import crypto from "node:crypto";

const COOKIE = "elevar_session";
const MAX_AGE = 7 * 24 * 3600; // 7 days

export const isConfigured = () => Boolean(process.env.ADMIN_PASSWORD && process.env.GITHUB_TOKEN);

// Changing ADMIN_PASSWORD or GITHUB_TOKEN signs everyone out.
const key = () => crypto.createHash("sha256").update(`${process.env.ADMIN_PASSWORD}|${process.env.GITHUB_TOKEN}`).digest();
const sign = (exp) => crypto.createHmac("sha256", key()).update(String(exp)).digest("base64url");
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();

export function passwordMatches(pw) {
  return crypto.timingSafeEqual(sha(pw || ""), sha(process.env.ADMIN_PASSWORD));
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isSignedIn(req) {
  if (!isConfigured()) return false;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)elevar_session=(\d+)\.([\w-]+)/);
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(m[1]));
  const got = Buffer.from(m[2]);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

// Requests that change things must be JSON from our own page (blocks cross-site forms).
export const isJsonRequest = (req) => (req.headers.get("content-type") || "").startsWith("application/json");
