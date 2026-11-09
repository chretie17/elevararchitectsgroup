// Netlify build: copy site/ to dist/ and apply the CMS content from content/.
// Only fields whose value changed since extraction are rewritten, so untouched
// pages stay byte-for-byte identical to the exported WordPress HTML.

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";
import { marked } from "marked";
import { SITE, CONTENT, DIST, ADMIN, PARSE_OPTS, hash, pageSlug, isEditablePage, listHtml } from "./lib.mjs";
import * as C from "../admin/collections.js";

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, "utf8")); } catch { return {}; } };

// Flatten {section: {key: value}} into {key: value}
function flatten(obj, out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === "object") flatten(v, out);
    else out[k] = v;
  }
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

await fs.rm(DIST, { recursive: true, force: true });
await fs.cp(SITE, DIST, { recursive: true });
await fs.cp(ADMIN, path.join(DIST, "admin"), { recursive: true });

const globalVals = flatten(await readJson(path.join(CONTENT, "global.json")));
const business = await readJson(path.join(CONTENT, "business.json"));

// ---- structured data (schema.org JSON-LD for Google) -----------------------
const SITE_URL = "https://elevararchitectsgroup.com";
const ORG_ID = `${SITE_URL}/#organization`;
const abs = (u) => (u && u.startsWith("/") ? SITE_URL + u : u);

function organizationNode() {
  const b = business;
  const node = {
    "@type": "ProfessionalService",
    "@id": ORG_ID,
    name: b.name,
    alternateName: b.alternate_name || undefined,
    url: `${SITE_URL}/`,
    slogan: b.slogan || undefined,
    description: b.description || undefined,
    logo: b.logo ? { "@type": "ImageObject", "@id": `${SITE_URL}/#logo`, url: abs(b.logo), caption: b.name } : undefined,
    image: b.image ? abs(b.image) : undefined,
    telephone: b.phone || undefined,
    email: b.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.street || undefined,
      addressLocality: b.city || undefined,
      addressRegion: b.region || undefined,
      addressCountry: b.country || undefined,
    },
    areaServed: b.area_served ? { "@type": "Country", name: b.area_served } : undefined,
    knowsAbout: b.services?.length ? b.services : undefined,
    hasOfferCatalog: b.services?.length ? {
      "@type": "OfferCatalog",
      name: "Architecture and engineering services",
      itemListElement: b.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
    } : undefined,
    contactPoint: b.phone ? [{ "@type": "ContactPoint", telephone: b.phone, email: b.email || undefined, contactType: "customer service", areaServed: "RW", availableLanguage: ["en", "rw", "fr"] }] : undefined,
    sameAs: (b.social_links || []).filter(Boolean).length ? b.social_links.filter(Boolean) : undefined,
  };
  return JSON.parse(JSON.stringify(node)); // drops undefined
}

// Adds the business to Yoast's JSON-LD graph, fixes the site name and keeps
// page name/description in sync with the SEO fields.
function patchSchema(root, seo) {
  if (!business.name) return false;
  let touched = false;
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(s.text); } catch { continue; }
    const graph = data["@graph"];
    if (!Array.isArray(graph)) continue;
    const types = (n) => [].concat(n["@type"] || []);
    for (const n of graph) {
      if (types(n).includes("WebSite")) {
        n.name = business.name;
        if (business.alternate_name) n.alternateName = business.alternate_name;
        n.description = business.description || n.description;
        n.publisher = { "@id": ORG_ID };
      }
      if (types(n).some((t) => /Page$/.test(t)) && n["@id"] && !/#/.test(n["@id"].replace(/#webpage$/, ""))) {
        if (seo.title) n.name = seo.title;
        if (seo.description) n.description = seo.description;
        n.publisher = { "@id": ORG_ID };
      }
      if (types(n).some((t) => /Article|BlogPosting/.test(t))) {
        n.publisher = { "@id": ORG_ID };
        n.author = { "@id": ORG_ID }; // the WordPress author was a login email
      }
    }
    // drop WordPress user nodes (named after an email address)
    for (let j = graph.length - 1; j >= 0; j--) {
      if (types(graph[j]).includes("Person") && /@/.test(graph[j].name || "")) graph.splice(j, 1);
    }
    const i = graph.findIndex((n) => n["@id"] === ORG_ID);
    if (i >= 0) graph[i] = organizationNode(); else graph.push(organizationNode());
    s.set_content(JSON.stringify(data));
    touched = true;
  }
  return touched;
}
let pagesChanged = 0, fieldsChanged = 0;

// ---- collections: projects, news, services ---------------------------------
const projects = (await readJson(path.join(CONTENT, "projects.json"))).items || [];
const news = (await readJson(path.join(CONTENT, "news.json"))).items || [];
const services = (await readJson(path.join(CONTENT, "services.json"))).items || [];
if (services.length) business.services = services.map((s) => s.name).filter(Boolean);
const parseEl = (html) => parse(html, PARSE_OPTS).childNodes.find((n) => n.nodeType === 1);

// Article bodies: keep simple formatting only.
const ALLOWED = new Set(C.BODY_TAGS);
function sanitize(html) {
  const root = parse(`<div>${html || ""}</div>`, PARSE_OPTS);
  const box = root.childNodes.find((n) => n.nodeType === 1);
  (function walk(node) {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 8) { c.remove(); continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.rawTagName.toLowerCase();
      if (/^(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select|template|link|meta|noscript)$/.test(tag)) { c.remove(); continue; }
      walk(c);
      if (!ALLOWED.has(tag)) { c.replaceWith(...c.childNodes); continue; }
      for (const a of Object.keys(c.attributes)) {
        const v = c.getAttribute(a) || "";
        const ok = (tag === "a" && a === "href" && /^(https?:|mailto:|tel:|\/|#)/i.test(v)) || (tag === "img" && (a === "alt" || (a === "src" && /^(https?:|\/)/i.test(v))));
        if (!ok) c.removeAttribute(a);
      }
      if (tag === "a" && /^https?:/i.test(c.getAttribute("href") || "")) { c.setAttribute("target", "_blank"); c.setAttribute("rel", "noopener"); }
    }
  })(box);
  return box.innerHTML;
}

function applyFields(root, vals) {
  let changed = 0;
  for (const el of root.querySelectorAll("[data-cms]")) {
    const key = el.getAttribute("data-cms");
    const orig = el.getAttribute("data-cms-h");
    const v = vals[key];
    const kind = key.startsWith("g") ? key[1] : key[0];
    if (kind === "i") {
      if (v && hash(v) !== orig) {
        el.setAttribute("src", v);
        el.removeAttribute("srcset");
        el.removeAttribute("sizes");
        changed++;
      }
      const alt = vals[key + "_alt"];
      if (typeof alt === "string" && alt !== (el.getAttribute("alt") || "")) { el.setAttribute("alt", alt); changed++; }
    } else if (kind === "n") {
      if (v !== undefined && v !== "" && hash(String(v)) !== orig) { el.setAttribute("data-end-digit", String(v)); changed++; }
    } else if (typeof v === "string" && hash(v) !== orig) {
      el.set_content(kind === "t" ? esc(v).replace(/\n/g, "<br>") : marked.parseInline(v));
      changed++;
    }
  }
  return changed;
}

function renderCollections(root) {
  if (!root.querySelector("[data-collection]")) return 0;
  C.renderProjectCards(root, projects, parseEl);
  C.renderNewsCards(root, news, parseEl);
  C.renderServices(root, services, parseEl);
  return 1;
}

const publicHtml = (html) => html.replace(/\sdata-(?:cms|cms-h|collection|group)="[^"]*"/g, "");

for (const file of await listHtml(DIST)) {
  const raw = await fs.readFile(file, "utf8");
  if (!raw.includes("data-cms=") && !raw.includes("data-collection=")) continue;
  const rel = path.relative(DIST, file).split(path.sep).join("/");
  if (rel.startsWith("admin/")) continue;
  const page = isEditablePage(rel) ? await readJson(path.join(CONTENT, "pages", `${pageSlug(rel)}.json`)) : {};
  const { seo = {}, ...rest } = page;
  const vals = { ...globalVals, ...flatten(rest) };

  const root = parse(raw, PARSE_OPTS);
  let changed = applyFields(root, vals);
  changed += renderCollections(root);
  if (rel === C.POST_TEMPLATE.file) { C.fixShareLinks(root, C.POST_TEMPLATE.path, root.querySelector("h1.entry-title")?.text.trim()); changed++; }

  const titleEl = root.querySelector("title");
  if (seo.title && titleEl && seo.title !== titleEl.text.trim()) {
    titleEl.set_content(esc(seo.title));
    for (const m of root.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')) m.setAttribute("content", seo.title);
    changed++;
  }
  const descEl = root.querySelector('meta[name="description"]');
  if (typeof seo.description === "string" && seo.description !== (descEl?.getAttribute("content") || "")) {
    if (descEl) descEl.setAttribute("content", seo.description);
    else root.querySelector("head")?.insertAdjacentHTML("beforeend", `<meta name="description" content="${escAttr(seo.description)}" />`);
    const og = root.querySelectorAll('meta[property="og:description"], meta[name="twitter:description"]');
    for (const m of og) m.setAttribute("content", seo.description);
    if (!og.length) root.querySelector('meta[property="og:title"]')?.insertAdjacentHTML("afterend", `<meta property="og:description" content="${escAttr(seo.description)}" />`);
    changed++;
  }

  if (patchSchema(root, seo)) changed++;

  const tagged = changed ? root.toString() : raw;
  await fs.writeFile(file, publicHtml(tagged));
  // Dashboard copy: same page, but keeps the data-cms tags so it can be clicked to edit.
  if (isEditablePage(rel)) {
    const editFile = path.join(DIST, "admin", "edit", ...rel.split("/"));
    await fs.mkdir(path.dirname(editFile), { recursive: true });
    await fs.writeFile(editFile, tagged);
  }
  if (changed) { pagesChanged++; fieldsChanged += changed; }
}

// ---- new project and news pages, built from the existing designs -----------
const redirects = [];
async function writePage(urlPath, html) {
  const out = path.join(DIST, ...urlPath.split("/").filter(Boolean), "index.html");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, publicHtml(html));
}
async function fromTemplate(tplFile, fill, item) {
  const root = parse(await fs.readFile(path.join(SITE, ...tplFile.split("/")), "utf8"), PARSE_OPTS);
  applyFields(root, globalVals); // shared header/footer edits
  fill(root, item);
  patchSchema(root, { title: item.seo?.title, description: item.seo?.description || item.excerpt });
  return root.toString();
}
// dashboard preview templates (header/footer applied, tags kept)
await fs.mkdir(path.join(DIST, "admin", "templates"), { recursive: true });
for (const [name, tpl] of [["project", C.PROJECT_TEMPLATE.file], ["post", C.POST_TEMPLATE.file]]) {
  const root = parse(await fs.readFile(path.join(SITE, ...tpl.split("/")), "utf8"), PARSE_OPTS);
  applyFields(root, globalVals);
  await fs.writeFile(path.join(DIST, "admin", "templates", `${name}.html`), root.toString());
}

for (const p of projects.filter((x) => x.kind === "new" && x.slug)) {
  await writePage(C.projectPath(p), await fromTemplate(C.PROJECT_TEMPLATE.file, (r, it) => C.fillProject(r, it), p));
}
for (const p of news.filter((x) => x.kind === "new" && x.slug)) {
  await writePage(C.postPath(p), await fromTemplate(C.POST_TEMPLATE.file, (r, it) => C.fillPost(r, it, { sanitize }), p));
}

// original pages that were deleted in the dashboard
const keepProjects = new Set(projects.map((p) => p.slug));
for (const d of await fs.readdir(path.join(SITE, "portfolio"), { withFileTypes: true })) {
  if (d.isDirectory() && !keepProjects.has(d.name)) {
    await fs.rm(path.join(DIST, "portfolio", d.name), { recursive: true, force: true });
    await fs.rm(path.join(DIST, "admin", "edit", "portfolio", d.name), { recursive: true, force: true });
    redirects.push(`/portfolio/${d.name}/ /projects/ 301`);
  }
}
const originalPost = C.POST_TEMPLATE.path.replace(/\//g, "");
if (!news.some((p) => p.slug === originalPost)) {
  await fs.rm(path.join(DIST, originalPost), { recursive: true, force: true });
  await fs.rm(path.join(DIST, "admin", "edit", originalPost), { recursive: true, force: true });
  redirects.push(`${C.POST_TEMPLATE.path} /news/ 301`);
}
if (redirects.length) await fs.appendFile(path.join(DIST, "_redirects"), redirects.join("\n") + "\n");

// sitemaps: one entry per project / article
async function rewriteSitemap(file, items, toPath, isItemLoc) {
  const f = path.join(DIST, file);
  let xml; try { xml = await fs.readFile(f, "utf8"); } catch { return; }
  const blocks = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => [(/<loc>([^<]+)<\/loc>/.exec(m[0]) || [])[1], m[0]]);
  const byLoc = new Map(blocks);
  const urls = blocks.filter(([loc]) => !isItemLoc(loc)).map(([, b]) => b);
  for (const it of items.filter((x) => !x.hidden)) {
    const loc = SITE_URL + toPath(it);
    urls.push(byLoc.get(loc) || `<url>\n\t\t<loc>${loc}</loc>\n\t\t<lastmod>${new Date(it.date || Date.now()).toISOString().replace(/\.\d+Z$/, "+00:00")}</lastmod>${it.cover ? `\n\t\t<image:image>\n\t\t\t<image:loc>${SITE_URL + it.cover}</image:loc>\n\t\t</image:image>` : ""}\n\t</url>`);
  }
  const start = xml.indexOf("<url>") === -1 ? xml.indexOf("</urlset>") : xml.indexOf("<url>");
  await fs.writeFile(f, xml.slice(0, start) + urls.join("\n\t") + "\n</urlset>" + xml.slice(xml.indexOf("</urlset>") + 9));
}
await rewriteSitemap("portfolio-sitemap.xml", projects, C.projectPath, (loc) => /\/portfolio\/[^/]+\/$/.test(loc));
await rewriteSitemap("post-sitemap.xml", news, C.postPath, (loc) => loc !== SITE_URL + "/news/" && loc !== SITE_URL + "/");

// ---- dashboard data ---------------------------------------------------------

// Photo library: every image in site/wp-content/uploads, one entry per photo
// (WordPress resized copies like -300x200 are grouped under their original).
async function buildMediaLibrary() {
  const uploads = path.join(SITE, "wp-content", "uploads");
  const SIZE = /-(\d+)x(\d+)(?=\.[a-z0-9]+$)/i;
  const groups = new Map();
  for (const e of await fs.readdir(uploads, { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || !/\.(jpe?g|png|webp|gif|svg)$/i.test(e.name)) continue;
    const full = path.join(e.parentPath ?? e.path, e.name);
    const url = "/" + path.relative(SITE, full).split(path.sep).join("/");
    if (/\/uploads\/elementor\//.test(url)) continue;
    const m = SIZE.exec(url);
    const base = url.replace(SIZE, "");
    const g = groups.get(base) || { base, sizes: [] };
    g.sizes.push({ url, w: m ? +m[1] : Infinity });
    groups.set(base, g);
  }
  const items = [...groups.values()].map((g) => {
    g.sizes.sort((a, b) => a.w - b.w);
    const largest = g.sizes[g.sizes.length - 1];
    const thumb = g.sizes.find((s) => s.w >= 300 && s.w !== Infinity) || g.sizes.find((s) => s.w !== Infinity && s.w >= 150) || largest;
    const name = path.posix.basename(g.base).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    return { name, src: largest.url, thumb: thumb.url, sizes: g.sizes.map((s) => s.url) };
  });
  items.sort((a, b) => b.src.localeCompare(a.src)); // newest folders first
  return items;
}

await fs.writeFile(path.join(DIST, "admin", "media.json"), JSON.stringify(await buildMediaLibrary()));
await fs.writeFile(path.join(DIST, "admin", "build.json"), JSON.stringify({ commit: process.env.COMMIT_REF || null, built: new Date().toISOString() }));

console.log(`Built dist/: ${fieldsChanged} edited field(s) applied across ${pagesChanged} page(s).`);
