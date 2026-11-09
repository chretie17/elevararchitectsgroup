// Export a static copy of the live WordPress site into ./site (the source the build step reads).
//
// Usage:  node scripts/export-static.mjs [path-to-wordpress-backup/public_html]
//
// The backup path is optional. It is only used to learn the *file names* of
// lazily-loaded JS/CSS chunks (Elementor etc.); the files themselves are always
// downloaded from the live site so versions match.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://elevararchitectsgroup.com";
const HOST = "elevararchitectsgroup.com";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "site");
const BACKUP = process.argv[2] ? path.resolve(process.argv[2]) : null;
const CONCURRENCY = 8;

const SKIP = [
  /^\/wp-admin\//, /^\/wp-login\.php/, /^\/wp-json\//, /^\/xmlrpc\.php/,
  /^\/wp-cron\.php/, /^\/wp-comments-post\.php/, /\/feed\/?$/, /^\/Testing\//,
  /\/embed\/?$/, /\.php$/,
];

const seen = new Set();
const queue = [];
const saved = new Map(); // pathname -> { file, type }
const failed = [];
const assetDirs = new Set();

function norm(raw, base) {
  if (!raw) return null;
  raw = raw.trim().replace(/&amp;/g, "&").replace(/&#038;/g, "&").replace(/\\\//g, "/");
  if (/^(data:|mailto:|tel:|javascript:|#|about:)/i.test(raw)) return null;
  let u;
  try { u = new URL(raw, base); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (u.hostname.replace(/^www\./, "") !== HOST) return null;
  u.protocol = "https:"; u.hostname = HOST; u.hash = "";
  if (SKIP.some((r) => r.test(u.pathname))) return null;
  const isPage = !path.posix.extname(u.pathname);
  if (isPage && u.search) return null; // ?s=, ?p=, ?replytocom= ... not static
  const segs = u.pathname.split("/").filter(Boolean);
  if (isPage && (segs.length > 6 || new Set(segs).size !== segs.length)) return null; // crawler traps
  return u;
}

function enqueue(raw, base) {
  const u = norm(raw, base);
  if (!u) return;
  const key = u.pathname + u.search;
  if (seen.has(key)) return;
  seen.add(key);
  queue.push(u);
}

function fileFor(u, isHtml) {
  let p = decodeURIComponent(u.pathname);
  if (isHtml && !path.posix.extname(p)) p = p.replace(/\/?$/, "/") + "index.html";
  return path.join(OUT, ...p.split("/").filter(Boolean));
}

const ABS = /(?:https?:)?(?:\\?\/){2}(?:www\.)?elevararchitectsgroup\.com(?:\\?\/[^"'\s<>(),\\]*(?:\\\/[^"'\s<>(),\\]*)*)?/g;
// Only root-relative values: WordPress writes absolute URLs (caught by ABS), and
// bare words like content="News" must not be treated as relative links.
const ATTR = /\s(?:href|src|srcset|data-src|data-srcset|data-bg|poster)\s*=\s*["'](\/[^/"'][^"']*)["']/gi;
const CSSURL = /url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g;

function discoverHtml(text, base) {
  for (const m of text.matchAll(ABS)) enqueue(m[0].replace(/^\/\//, "https://"), base);
  for (const m of text.matchAll(ATTR)) for (const part of m[1].split(",")) enqueue(part.trim().split(/\s+/)[0], base);
  for (const m of text.matchAll(CSSURL)) enqueue(m[1] || m[2], base);
}

function discoverCss(text, base) {
  for (const m of text.matchAll(CSSURL)) enqueue(m[1] || m[2], base);
}

async function fetchOne(u) {
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(u, { redirect: "follow", headers: { "user-agent": "static-export/1.0" } });
      break;
    } catch (e) { if (attempt === 2) { failed.push(`${u} (${e.message})`); return; } }
  }
  if (!res.ok) { failed.push(`${u} (${res.status})`); return; }
  const finalUrl = new URL(res.url);
  if (finalUrl.hostname.replace(/^www\./, "") !== HOST) return;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  const isHtml = type === "text/html";
  const buf = Buffer.from(await res.arrayBuffer());
  const file = fileFor(u, isHtml);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  saved.set(u.pathname, { file, type });
  if (finalUrl.pathname !== u.pathname) enqueue(finalUrl.href);
  if (isHtml) discoverHtml(buf.toString("utf8"), u);
  else if (type === "text/css") discoverCss(buf.toString("utf8"), u);
  else if (/xml/.test(type)) discoverHtml(buf.toString("utf8"), u);
  if (/\.(js|css)$/.test(u.pathname)) assetDirs.add(path.posix.dirname(u.pathname));
}

async function drain() {
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await fetchOne(queue.shift());
  });
  await Promise.all(workers);
}

async function sitemapUrls() {
  const urls = [];
  const idx = await (await fetch(`${ORIGIN}/sitemap_index.xml`)).text();
  for (const [, sm] of idx.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urls.push(sm);
    const x = await (await fetch(sm)).text();
    for (const [, loc] of x.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(loc);
  }
  return urls;
}

// Lazy chunks (Elementor widgets, etc.) are loaded by JS at runtime and never
// appear in HTML. Use the backup's file listing to request siblings from live.
const LAZY_PLUGINS = ["elementor", "qi-addons-for-elementor", "bdthemes-prime-slider-lite"];

async function addLazyChunks() {
  if (!BACKUP) return;
  // Page-builder plugins load chunks from sub-folders (assets/js/chunks, assets/lib/...)
  for (const p of LAZY_PLUGINS) {
    const base = path.join(BACKUP, "wp-content", "plugins", p, "assets");
    let entries = [];
    try { entries = await fs.readdir(base, { recursive: true }); } catch { continue; }
    for (const e of entries) {
      const rel = e.split(path.sep).join("/");
      if (/\.(js|css)$/.test(rel) && !/(^|\/)(editor|admin)[^/]*$|(^|\/)(editor|admin)\//i.test(rel)) enqueue(`/wp-content/plugins/${p}/assets/${rel}`, ORIGIN);
    }
  }
  for (const dir of assetDirs) {
    const local = path.join(BACKUP, ...dir.split("/").filter(Boolean));
    let names = [];
    try { names = await fs.readdir(local); } catch { continue; }
    for (const n of names) if (/\.(js|css|json)$/.test(n) && !n.endsWith(".map")) enqueue(`${dir}/${n}`, ORIGIN);
  }
}

// ---- post-processing -------------------------------------------------------

const KEEP_ABSOLUTE = /<script[^>]+application\/ld\+json[\s\S]*?<\/script>|<link[^>]+rel=["'](?:canonical|shortlink)["'][^>]*>|<meta[^>]+(?:property|name)=["'](?:og:|twitter:)[^>]*>/gi;
const DROP = [
  /<link[^>]+rel=["'](?:https:\/\/api\.w\.org\/|EditURI|pingback|wlwmanifest)["'][^>]*>\s*/gi,
  /<link[^>]+(?:wp-json|oembed|\/feed\/)[^>]*>\s*/gi,
  /<script[^>]+id=["'](?:fluent-form-submission|fluentform-elementor|swv|contact-form-7|googlesitekit-events-provider-contact-form-7|googlesitekit-events-provider-fluent-forms)[^"']*["'][\s\S]*?<\/script>\s*/gi,
];

function relativize(html) {
  const keep = [];
  html = html.replace(KEEP_ABSOLUTE, (m) => `\u0000${keep.push(m) - 1}\u0000`);
  html = html
    .replace(/https?:\\\/\\\/(?:www\.)?elevararchitectsgroup\.com/g, "")
    .replace(/https?:\/\/(?:www\.)?elevararchitectsgroup\.com/g, "")
    .replace(/(["'(\s])\/\/(?:www\.)?elevararchitectsgroup\.com/g, "$1");
  html = html.replace(/(href|action)=(["'])\2/g, "$1=$2/$2");
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

function convertForms(html) {
  // Fluent Forms -> Netlify Forms (posts to Netlify, emails you from the dashboard)
  html = html.replace(/<form([^>]*?)class=(["'])([^"']*frm-fluent-form[^"']*)\2([^>]*)>([\s\S]*?)<\/form>/gi,
    (_all, pre, q, cls, post, body) => {
      const id = (/data-form_id=["'](\d+)/.exec(pre + post) || [, "1"])[1];
      body = body
        .replace(/<input[^>]+name=["'](?:_fluentform_[^"']*|__fluent_form_embded_post_id|_wp_http_referer|ak_js)["'][^>]*>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "");
      cls = cls.replace(/\bff-form-loading\b/, "").trim();
      return `<form name="contact-${id}" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="ak_hp_textarea" class="${cls}">` +
        `<input type="hidden" name="form-name" value="contact-${id}" />${body}</form>`;
    });
  // WordPress comment forms cannot work without PHP: remove them.
  html = html.replace(/<div[^>]+id=["']respond["'][\s\S]*?<\/form>\s*<\/div>/gi, "");
  html = html.replace(/<form[^>]+id=["']commentform["'][\s\S]*?<\/form>/gi, "");
  // Search: hand off to DuckDuckGo limited to this domain.
  html = html.replace(/<form([^>]*class=["'][^"']*search-form[^"']*["'][^>]*)action=["'][^"']*["']([^>]*)>/gi,
    `<form$1action="https://duckduckgo.com/"$2><input type="hidden" name="sites" value="${HOST}" />`);
  html = html.replace(/(<form[^>]*duckduckgo[\s\S]*?<input[^>]*?)name=["']s["']/gi, '$1name="q"');
  return html;
}

async function postProcess() {
  for (const { file, type } of saved.values()) {
    if (type === "text/html") {
      let html = await fs.readFile(file, "utf8");
      for (const r of DROP) html = html.replace(r, "");
      html = convertForms(relativize(html));
      await fs.writeFile(file, html);
    } else if (type === "text/css") {
      const css = await fs.readFile(file, "utf8");
      await fs.writeFile(file, relativize(css));
    }
  }
}

async function makeThankYou() {
  const contact = path.join(OUT, "contact", "index.html");
  let html;
  try { html = await fs.readFile(contact, "utf8"); } catch { return; }
  const msg = `<div class="thank-you" style="padding:40px 0;text-align:center"><h2>Thank you!</h2><p>Your message has been sent. We will get back to you soon.</p><p><a href="/">Back to home</a></p></div>`;
  html = html.replace(/<form[^>]*data-netlify[\s\S]*?<\/form>/i, msg)
    .replace(/<title>[^<]*<\/title>/i, "<title>Thank you - Elevar Architects Group Ltd</title>")
    .replace(/<meta[^>]+name=["']robots["'][^>]*>/i, "")
    .replace("</head>", '<meta name="robots" content="noindex" /></head>');
  await fs.mkdir(path.join(OUT, "thank-you"), { recursive: true });
  await fs.writeFile(path.join(OUT, "thank-you", "index.html"), html);
}

async function make404() {
  const res = await fetch(`${ORIGIN}/this-page-does-not-exist-${Date.now()}/`);
  const html = await res.text();
  if (!/<html/i.test(html)) return;
  const file = path.join(OUT, "404.html");
  await fs.writeFile(file, html);
  saved.set("/404.html", { file, type: "text/html" });
  discoverHtml(html, new URL(ORIGIN));
}

// ---- main ------------------------------------------------------------------

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
for (const u of ["/", "/robots.txt", "/favicon.ico", "/llms.txt", ...(await sitemapUrls())]) enqueue(u, ORIGIN);
await drain();
await make404();
await drain();
await addLazyChunks();
await drain();
await postProcess();
await makeThankYou();

const pages = [...saved.values()].filter((s) => s.type === "text/html").length;
console.log(`Saved ${saved.size} files (${pages} HTML pages) to ${OUT}`);
if (failed.length) console.log(`Failed (${failed.length}):\n  ` + failed.join("\n  "));
