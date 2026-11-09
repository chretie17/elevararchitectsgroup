// Projects, news articles and services: fills the site's own HTML templates
// with content. Shared by the build (node-html-parser) and the dashboard
// preview (browser DOM); both expose the same small DOM API used here.

export const SITE_URL = "https://elevararchitectsgroup.com";
export const PROJECT_TEMPLATE = { file: "portfolio/kwigira-women-and-children-center/index.html", path: "/portfolio/kwigira-women-and-children-center/", heroSection: "5c7fa9c0" };
export const POST_TEMPLATE = { file: "elevar-design-transforming-architecture-in-rwanda/index.html", path: "/elevar-design-transforming-architecture-in-rwanda/" };

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "item";
export const projectPath = (p) => `/portfolio/${p.slug}/`;
export const postPath = (p) => `/${p.slug}/`;
const textHtml = (s) => esc(s).replace(/\n/g, "<br>");
const paragraphs = (s) => String(s || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${textHtml(p)}</p>`).join("");
// Animated headings: one span per word; the first keeps the data-cms anchor so
// the live preview can fill the same page again.
const words = (s, key) => String(s || "").trim().split(/\s+/).filter(Boolean).map((w, i) => `<span class="qodef-e-word-holder"${i === 0 ? ` data-cms="${key}"` : ""}>${esc(w)}</span>`).join(" ") || `<span class="qodef-e-word-holder" data-cms="${key}"></span>`;
const longDate = (d) => { const x = new Date(d || Date.now()); return isNaN(x) ? "" : x.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); };
const isoDate = (d) => { const x = new Date(d || Date.now()); return isNaN(x) ? "" : x.toISOString().replace(/\.\d+Z$/, "+00:00"); };
const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => root.querySelectorAll(sel);
const cms = (root, key) => $(root, `[data-cms="${key}"]`);
function setImg(el, src, alt) {
  if (!el || !src) return;
  el.setAttribute("src", src);
  el.removeAttribute("srcset");
  el.removeAttribute("sizes");
  if (alt != null) el.setAttribute("alt", alt);
}
const setText = (el, s) => { if (el) el.innerHTML = textHtml(s); };
const setWords = (el, s) => { const h = el && (el.closest("h1,h2,h3,h4,h5,h6") || el.parentNode); if (h) h.innerHTML = words(s, el.getAttribute("data-cms")); };
const abs = (u) => (u && u.startsWith("/") ? SITE_URL + u : u);

// <head>: title, description, social tags, canonical and Google's JSON-LD.
export function fillHead(root, { title, description, path, image, date, oldPath }) {
  const url = SITE_URL + path;
  const t = $(root, "title"); if (t) t.innerHTML = esc(title);
  const set = (sel, v) => { for (const m of $$(root, sel)) m.setAttribute("content", v); };
  let d = $(root, 'meta[name="description"]');
  if (!d && description) { $(root, "head")?.insertAdjacentHTML("beforeend", `<meta name="description" content="${esc(description)}" />`); d = $(root, 'meta[name="description"]'); }
  if (d) d.setAttribute("content", description || "");
  set('meta[property="og:title"], meta[name="twitter:title"]', title);
  set('meta[property="og:description"], meta[name="twitter:description"]', description || "");
  set('meta[property="og:url"]', url);
  if (image) set('meta[property="og:image"], meta[name="twitter:image"]', abs(image));
  for (const sel of ['meta[property="og:image:width"]', 'meta[property="og:image:height"]']) for (const m of $$(root, sel)) m.remove();
  if (date) { set('meta[property="article:published_time"]', isoDate(date)); set('meta[property="article:modified_time"]', isoDate(date)); }
  const c = $(root, 'link[rel="canonical"]'); if (c) c.setAttribute("href", url);
  for (const l of $$(root, 'link[rel="shortlink"]')) l.remove();
  for (const s of $$(root, 'script[type="application/ld+json"]')) {
    let txt = s.innerHTML;
    if (oldPath) txt = txt.split(SITE_URL.replace(/\//g, "\\/") + oldPath.replace(/\//g, "\\/")).join(url.replace(/\//g, "\\/")).split(SITE_URL + oldPath).join(url);
    let data; try { data = JSON.parse(txt); } catch { continue; }
    for (const n of data["@graph"] || []) {
      const types = [].concat(n["@type"] || []);
      if (types.some((x) => /Page$/.test(x))) { n.name = title; if (description) n.description = description; if (date) { n.datePublished = isoDate(date); n.dateModified = isoDate(date); } }
      if (types.some((x) => /Article/.test(x))) { n.headline = title; if (date) { n.datePublished = isoDate(date); n.dateModified = isoDate(date); } }
      if (types.includes("ImageObject") && image && /primaryimage/.test(n["@id"] || "")) { n.url = abs(image); n.contentUrl = abs(image); delete n.width; delete n.height; }
      if (types.includes("BreadcrumbList")) { const last = n.itemListElement?.[n.itemListElement.length - 1]; if (last) last.name = title; }
    }
    s.innerHTML = JSON.stringify(data);
  }
}

// Share buttons need full addresses.
export function fixShareLinks(root, path, title) {
  const url = SITE_URL + path, t = encodeURIComponent(title || "");
  const map = {
    "share-facebook": `https://www.facebook.com/sharer.php?u=${url}&t=${t}`,
    "share-twitter": `https://twitter.com/intent/tweet?text=${encodeURIComponent("Currently reading: '" + (title || "") + "' on ")}${url}`,
    "share-pinterest": `https://pinterest.com/pin/create/button/?url=${url}&description=${t}`,
    "share-mail": `mailto:?subject=${encodeURIComponent("I wanted you to see this post")}&body=${encodeURIComponent("Check out this post: " + (title || "") + " - ")}${url}`,
  };
  for (const [cls, href] of Object.entries(map)) for (const a of $$(root, `a.${cls}`)) a.setAttribute("href", href);
}

// ---- project page (from the Kwigira page design)
export function fillProject(root, p, { head = true } = {}) {
  const title = p.title || "New project";
  setText(cms(root, "t1"), title);
  setWords(cms(root, "t2"), title);
  setText(cms(root, "t7"), p.tagline);
  const hl = p.highlights || [];
  ["t8", "t9", "t10"].forEach((k, i) => setText(cms(root, k), hl[i]?.title));
  ["t11", "t12", "t13"].forEach((k, i) => setText(cms(root, k), hl[i]?.text));
  setWords(cms(root, "t14"), p.intro_heading);
  setText(cms(root, "t15"), p.intro);
  setWords(cms(root, "t18"), p.section2?.heading);
  setText(cms(root, "t20"), p.section2?.text);
  setWords(cms(root, "t23"), p.section3?.heading);
  setText(cms(root, "t27"), p.section3?.text);
  const photos = p.photos || [];
  ["i16", "i17", "i21", "i22"].forEach((k, i) => setImg(cms(root, k), photos[i] || p.cover, title));
  // hero background photo (set in Elementor's CSS) -> this project's cover
  let style = $(root, "style#elevar-hero");
  if (!style) { $(root, "head")?.insertAdjacentHTML("beforeend", '<style id="elevar-hero"></style>'); style = $(root, "style#elevar-hero"); }
  const h = PROJECT_TEMPLATE.heroSection;
  if (style) style.innerHTML = p.cover ? `.elementor-element.elementor-element-${h},.elementor-element.elementor-element-${h}>.elementor-motion-effects-container>.elementor-motion-effects-layer{background-image:url("${esc(p.cover)}")!important}` : "";
  if (head) {
    fillHead(root, { title: p.seo?.title || `${title} | Elevar Architects Group`, description: p.seo?.description || p.excerpt || "", path: projectPath(p), image: p.cover, oldPath: PROJECT_TEMPLATE.path });
    fixShareLinks(root, projectPath(p), title);
  }
}

// ---- news article (from the existing article design)
export function fillPost(root, p, { head = true, sanitize = (h) => h } = {}) {
  const title = p.title || "New article";
  setText(cms(root, "t3"), title);
  const thumb = $(root, ".post-thumbnail");
  if (thumb && p.cover) { thumb.setAttribute("style", `background-image: url(${p.cover});`); thumb.setAttribute("data-medium-image", p.cover); thumb.setAttribute("data-large-image", p.cover); }
  for (const t of $$(root, ".post-header time")) { t.setAttribute("datetime", isoDate(p.date)); t.innerHTML = " " + longDate(p.date) + " "; }
  for (const a of $$(root, ".post-header .posted-on a")) a.setAttribute("href", postPath(p));
  const body = $(root, ".entry-content");
  if (body) body.innerHTML = sanitize(p.body || "") || "<p></p>";
  if (head) {
    fillHead(root, { title: p.seo?.title || `${title} | Elevar Architects Group`, description: p.seo?.description || p.excerpt || "", path: postPath(p), image: p.cover, date: p.date, oldPath: POST_TEMPLATE.path });
    fixShareLinks(root, postPath(p), title);
  }
}

// ---- lists
// The first item in a list is the template for every item. Remembered per
// element so the live preview can re-render the same list.
const templates = new WeakMap();
const firstChild = (el) => [...el.childNodes].find((n) => n.nodeType === 1);
function regenerate(container, items, fillOne) {
  if (!templates.has(container)) templates.set(container, firstChild(container)?.outerHTML);
  const tpl = templates.get(container);
  if (!tpl) return;
  container.innerHTML = items.map((it, i) => fillOne(tpl, it, i)).join("\n");
}

// The `parse` argument turns an HTML string into an element we can edit.
export function renderProjectCards(root, items, parse) {
  for (const c of $$(root, '[data-collection="projects"]')) {
    regenerate(c, items.filter((p) => !p.hidden), (tpl, p) => {
      const el = parse(tpl);
      el.removeAttribute("id");
      for (const a of $$(el, "a")) a.setAttribute("href", projectPath(p));
      setImg($(el, "img"), p.cover, p.title);
      const t = $(el, ".entry-title"); if (t) t.innerHTML = `<a href="${projectPath(p)}">${esc(p.title)}</a>`;
      setText($(el, ".portfolio-excerpt"), p.excerpt);
      return el.outerHTML;
    });
  }
}

export function renderNewsCards(root, items, parse) {
  for (const c of $$(root, '[data-collection="news"]')) {
    const sorted = items.filter((p) => !p.hidden).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    regenerate(c, sorted, (tpl, p) => {
      const el = parse(tpl);
      el.removeAttribute("id");
      for (const a of $$(el, "a")) { const h = a.getAttribute("href") || ""; if (h === POST_TEMPLATE.path || h.startsWith("/elevar-design")) a.setAttribute("href", postPath(p)); }
      setImg($(el, ".featured-image img"), p.cover, p.title);
      const t = $(el, ".entry-title"); if (t) t.innerHTML = `<a href="${postPath(p)}">${esc(p.title)}</a>`;
      for (const tm of $$(el, "time")) { tm.setAttribute("datetime", isoDate(p.date)); tm.innerHTML = " " + longDate(p.date) + " "; }
      fixShareLinks(el, postPath(p), p.title);
      return el.outerHTML;
    });
  }
}

export function renderServices(root, items, parse) {
  const list = items.filter((s) => s.name);
  const chunks = (n) => { if (!n) return []; const out = Array.from({ length: n }, () => []); const per = Math.ceil(list.length / n) || 1; list.forEach((s, i) => out[Math.min(n - 1, Math.floor(i / per))].push(s)); return out; };
  // short lists (Services page overview, homepage "All services")
  const groups = new Map();
  for (const ul of $$(root, '[data-collection="services-list"]')) { const g = ul.getAttribute("data-group") || "a"; (groups.get(g) || groups.set(g, []).get(g)).push(ul); }
  for (const uls of groups.values()) {
    const parts = chunks(uls.length);
    uls.forEach((ul, i) => regenerate(ul, parts[i], (tpl, s) => {
      const el = parse(tpl);
      const t = $(el, ".elementor-icon-list-text"); if (t) t.innerHTML = esc(s.name);
      return el.outerHTML;
    }));
  }
  // accordions with descriptions (Services page)
  const accs = $$(root, '[data-collection="services-accordion"]');
  const parts = chunks(accs.length);
  accs.forEach((acc, i) => {
    if (!templates.has(acc)) { const head = $(acc, ".qodef-e-title-holder"), body = $(acc, ".qodef-e-content"); templates.set(acc, (head?.outerHTML || "") + (body?.outerHTML || "")); }
    const tpl = templates.get(acc);
    acc.innerHTML = parts[i].map((s) => {
      const el = parse(`<div>${tpl}</div>`);
      const t = $(el, ".qodef-e-title"); if (t) t.innerHTML = esc(s.name);
      const inner = $(el, ".qodef-e-content-inner"); if (inner) inner.innerHTML = paragraphs(s.description);
      return el.innerHTML;
    }).join("\n");
  });
}

// Allowed HTML in article bodies.
export const BODY_TAGS = ["p", "h2", "h3", "h4", "strong", "b", "em", "i", "a", "ul", "ol", "li", "br", "blockquote", "img", "figure", "figcaption"];
