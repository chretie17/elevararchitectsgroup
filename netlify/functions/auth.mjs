// Password login for /admin (Decap CMS) — replaces "Login with GitHub".
//
// Decap opens this page in a popup. After the right password is entered, the
// popup hands Decap a GitHub token so it can save edits to the repo.
//
// Netlify environment variables (Site configuration -> Environment variables):
//   ADMIN_PASSWORD  the password you type at /admin
//   GITHUB_TOKEN    fine-grained GitHub token: only this repo, Contents: Read and write

import crypto from "node:crypto";

export const config = { path: "/api/auth" };

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const sameSecret = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Elevar – Sign in</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f2f0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1b1b}
  form,.box{background:#fff;padding:32px;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.08);width:min(320px,calc(100vw - 32px));box-sizing:border-box}
  h1{font-size:20px;margin:0 0 16px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:16px;border:1px solid #ccc;border-radius:6px}
  button{margin-top:12px;width:100%;padding:10px;font-size:16px;border:0;border-radius:6px;background:#1b1b1b;color:#fff;cursor:pointer}
  .err{color:#b3261e;margin:0 0 12px}
</style></head><body>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );

const form = (error = "") =>
  page(
    `<form method="POST">
  <h1>Elevar content manager</h1>
  ${error ? `<p class="err">${error}</p>` : ""}
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <button type="submit">Sign in</button>
</form>`,
    error ? 401 : 200,
  );

// Decap handshake: popup says "authorizing:github", Decap echoes it back,
// then the popup sends the token to the window that opened it.
const success = (token) => {
  const msg = "authorization:github:success:" + JSON.stringify({ token, provider: "github" });
  return page(`<div class="box"><h1>Signed in</h1><p>You can close this window.</p></div>
<script>
(function () {
  var msg = ${JSON.stringify(msg).replace(/</g, "\\u003c")};
  if (!window.opener) { document.querySelector("p").textContent = "Open /admin and sign in from there."; return; }
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;
    window.opener.postMessage(msg, e.origin);
  }, false);
  window.opener.postMessage("authorizing:github", location.origin);
})();
</script>`);
};

export default async (req) => {
  const password = process.env.ADMIN_PASSWORD;
  const token = process.env.GITHUB_TOKEN;
  if (!password || !token) {
    return page(`<div class="box"><h1>Not set up yet</h1><p>Add ADMIN_PASSWORD and GITHUB_TOKEN in Netlify's environment variables, then redeploy.</p></div>`, 500);
  }
  if (req.method !== "POST") return form();

  const data = new URLSearchParams(await req.text());
  if (sameSecret(data.get("password") || "", password)) return success(token);
  await sleep(1500); // slow down guessing
  return form("Wrong password.");
};
