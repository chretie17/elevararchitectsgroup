// GET    /api/login  -> { signedIn, configured }
// POST   /api/login  { password } -> sets the session cookie
// DELETE /api/login  -> signs out
import { isConfigured, isSignedIn, passwordMatches, sessionCookie, clearCookie, json, isJsonRequest } from "../lib/session.mjs";

export const config = { path: "/api/login" };

export default async (req) => {
  if (req.method === "GET") return json({ signedIn: isSignedIn(req), configured: isConfigured() });
  if (req.method === "DELETE") return json({ signedIn: false }, 200, { "set-cookie": clearCookie });
  if (req.method !== "POST" || !isJsonRequest(req)) return json({ error: "Not allowed" }, 405);
  if (!isConfigured()) return json({ error: "The dashboard is not set up yet: add ADMIN_PASSWORD and GITHUB_TOKEN in Netlify, then redeploy." }, 500);

  const { password } = await req.json().catch(() => ({}));
  if (passwordMatches(password)) return json({ signedIn: true }, 200, { "set-cookie": sessionCookie() });
  await new Promise((r) => setTimeout(r, 1500)); // slow down guessing
  return json({ error: "Wrong password." }, 401);
};
