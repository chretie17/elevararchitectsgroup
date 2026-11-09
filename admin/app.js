// Elevar dashboard: click-to-edit visual editor for the static site.
// Content lives in content/*.json in GitHub; /api/* (Netlify Functions) reads
// and commits it, and Netlify rebuilds the site after each publish.

const LOGO = "/wp-content/uploads/2025/12/elevar_1-05-scaled-e1764947847136-1075x500.png";
const BUSINESS_FILE = "content/business.json";
const DRAFT_KEY = "elevar-dashboard-draft";
const COLL = { projects: "content/projects.json", news: "content/news.json", services: "content/services.json" };
import * as C from "/admin/collections.js";

// ---------------------------------------------------------------- helpers
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
};
const ICONS = {
  text: '<path d="M4 6V4h16v2M9 20h6M12 4v16"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  rich: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  number: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  home: '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  photos: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V7"/><circle cx="8" cy="8" r="1.5"/><path d="m17 13-4-4-8 8"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};
const icon = (name, size = 18) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.8");
  s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.classList.add("icon");
  s.innerHTML = ICONS[name] || "";
  return s;
};
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const short = (s, n = 70) => { s = String(s ?? "").replace(/[*_\[\]]|\(\/[^)]*\)|\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const kindOf = (key) => (key.startsWith("g") ? key[1] : key[0]);
const sha10 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(String(s))))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };

function toast(msg, type = "", ms = 4000) {
  const t = h("div", { class: "toast " + type }, type === "ok" ? icon("check") : null, h("div", {}, msg));
  document.getElementById("toasts").append(t);
  setTimeout(() => t.remove(), ms);
}

async function api(path, opt = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...opt, headers: { "content-type": "application/json", ...(opt.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") { renderLogin("Your session ended. Please sign in again."); throw new Error("signed out"); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------------------------------------------------------------- state
const S = {
  pages: [], // {slug,label,url,file,sections:[{name,label,fields:[{key,kind}]}]}
  globalFile: "", globalSections: [],
  docs: {}, // file -> {data, original}
  uploads: new Map(), // public url -> {path, base64, blobUrl, name}
  media: [],
  view: "home", // home | page | business | media
  page: null, selected: null, device: "desktop",
  frameDoc: null, publishing: false, waitingFor: null,
};

// ---------------------------------------------------------------- schema + content
async function loadSchema() {
  const txt = await (await fetch("/admin/config.yml", { cache: "no-store" })).text();
  const cfg = JSON.parse(txt.replace(/^#.*$/gm, ""));
  const fieldsOf = (sec) => sec.fields.filter((f) => !f.name.endsWith("_alt")).map((f) => ({ key: f.name, kind: kindOf(f.name) }));
  const pagesCol = cfg.collections.find((c) => c.name === "pages");
  S.pages = pagesCol.files.map((f) => ({
    slug: f.name, label: f.label, url: f.url || "/", file: f.file,
    sections: f.fields.filter((x) => x.name !== "seo").map((sec) => ({ name: sec.name, label: sec.label, fields: fieldsOf(sec) })),
  }));
  const g = cfg.collections.find((c) => c.name === "global").files[0];
  S.globalFile = g.file;
  S.globalSections = g.fields.map((sec) => ({ name: sec.name, label: sec.label, fields: fieldsOf(sec) }));
  // Page field keys (t1, i3…) repeat on every page, so each page keeps its own lookup.
  for (const p of S.pages) { p.where = {}; for (const sec of p.sections) for (const f of sec.fields) p.where[f.key] = sec.name; }
  S.globalWhere = {};
  for (const sec of S.globalSections) for (const f of sec.fields) S.globalWhere[f.key] = sec.name;
}

async function loadDoc(file) {
  if (S.docs[file]) return S.docs[file];
  const { content } = await api("/api/content?path=" + encodeURIComponent(file));
  const data = JSON.parse(content);
  const doc = { data, original: JSON.stringify(data) };
  const draft = store.get(DRAFT_KEY)?.[file];
  if (draft) doc.data = draft;
  S.docs[file] = doc;
  return doc;
}

// Where a field lives: header/footer keys (g…) in global.json, others in the open page's file.
function locate(key, page = S.page) {
  const base = key.replace(/_alt$/, "");
  if (base.startsWith("g")) return S.globalWhere[base] ? { file: S.globalFile, section: S.globalWhere[base] } : null;
  return page?.where[base] ? { file: page.file, section: page.where[base] } : null;
}
const getVal = (key, page) => { const w = locate(key, page); const d = w && S.docs[w.file]?.data; return d?.[w.section]?.[key]; };
const getOriginal = (key) => { const w = locate(key); const d = w && S.docs[w.file]; return d ? JSON.parse(d.original)?.[w.section]?.[key] : undefined; };
function setVal(key, value) {
  const w = locate(key);
  if (!w) return;
  const doc = S.docs[w.file];
  (doc.data[w.section] ||= {})[key] = value;
  changed();
}
const isDirty = (file) => S.docs[file] && JSON.stringify(S.docs[file].data) !== S.docs[file].original;
const dirtyFiles = () => Object.keys(S.docs).filter(isDirty);

function countChanges() {
  let n = 0;
  const walk = (a, b) => { for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) { const x = a?.[k], y = b?.[k]; if (x && typeof x === "object" && y && typeof y === "object") walk(x, y); else if (JSON.stringify(x) !== JSON.stringify(y)) n++; } };
  for (const f of dirtyFiles()) walk(S.docs[f].data, JSON.parse(S.docs[f].original));
  return n;
}

let draftTimer;
function changed() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const d = {};
    for (const f of dirtyFiles()) d[f] = S.docs[f].data;
    Object.keys(d).length ? store.set(DRAFT_KEY, d) : store.del(DRAFT_KEY);
  }, 300);
  renderTop();
  renderNavDots();
}

// ---------------------------------------------------------------- rendering into the page preview
function displaySrc(v) { return S.uploads.get(v)?.blobUrl || v; }
function renderEl(el, key, v) {
  const kind = kindOf(key);
  if (kind === "i") {
    const src = displaySrc(v);
    if (src && el.getAttribute("src") !== src) { el.setAttribute("src", src); el.removeAttribute("srcset"); el.removeAttribute("sizes"); }
    const alt = getVal(key + "_alt");
    if (typeof alt === "string") el.setAttribute("alt", alt);
  } else if (kind === "n") {
    el.setAttribute("data-end-digit", v);
    const d = el.querySelector(".qodef-m-digit"); if (d) d.textContent = v;
  } else if (kind === "t") {
    el.innerHTML = esc(v).replace(/\n/g, "<br>");
  } else {
    el.innerHTML = window.marked ? window.marked.parseInline(v || "") : esc(v);
  }
}
function updatePreview(key) {
  if (!S.frameDoc) return;
  const base = key.replace(/_alt$/, "");
  for (const el of S.frameDoc.querySelectorAll(`[data-cms="${base}"]`)) renderEl(el, base, getVal(base));
}

const FRAME_CSS = `
[data-cms]{cursor:pointer!important;transition:outline-color .12s}
[data-cms]:hover{outline:2px dashed #a8763e!important;outline-offset:3px}
.elevar-sel{outline:2px solid #2f6fed!important;outline-offset:3px;box-shadow:0 0 0 6px rgba(47,111,237,.15)!important}
#elevar-badge{position:fixed;z-index:2147483647;pointer-events:none;background:#17181c;color:#fff;font:600 12px/1 Inter,system-ui,sans-serif;padding:6px 9px;border-radius:6px;display:none;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.2)}
`;

// Element the user clicked: the tagged element, or (animated headings split
// into one span per word) the tagged word in the same heading.
const pickTarget = (t) => t.closest?.("[data-cms]") || t.closest?.("h1,h2,h3,h4,h5,h6")?.querySelector("[data-cms]");
const LIST_VIEW = { projects: "projects", news: "news", "services-list": "services", "services-accordion": "services" };

function wireFrame(iframe, onPick = (key) => select(key, false), onList = null) {
  const doc = iframe.contentDocument;
  S.frameDoc = doc;
  doc.head.append(Object.assign(doc.createElement("style"), { textContent: FRAME_CSS }));
  const badge = Object.assign(doc.createElement("div"), { id: "elevar-badge" });
  doc.body.append(badge);
  const label = (el) => { const k = kindOf(el.dataset.cms); return k === "i" ? "Replace photo" : k === "n" ? "Edit number" : /^H\d$/.test(el.tagName) ? "Edit heading" : "Edit text"; };

  const listNames = { projects: "Manage projects", news: "Manage news", "services-list": "Manage services", "services-accordion": "Manage services" };
  doc.addEventListener("mouseover", (e) => {
    const list = e.target.closest?.("[data-collection]");
    const el = list ? null : pickTarget(e.target);
    const box = list || el;
    if (!box) { badge.style.display = "none"; return; }
    const r = box.getBoundingClientRect();
    badge.textContent = list ? "☰ " + listNames[list.dataset.collection] : "✎ " + label(el) + (el.dataset.cms.startsWith("g") ? " · all pages" : "");
    badge.style.display = "block";
    badge.style.left = Math.max(6, r.left) + "px";
    badge.style.top = Math.max(6, r.top - 30) + "px";
  });
  doc.addEventListener("click", (e) => {
    if (e.target.closest?.("a, button, form, input")) e.preventDefault();
    const list = e.target.closest?.("[data-collection]");
    if (list) { e.preventDefault(); e.stopPropagation(); if (onList) onList(e.target); else go(LIST_VIEW[list.dataset.collection]); return; }
    const el = pickTarget(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    onPick(el.dataset.cms, el);
  }, true);
  doc.addEventListener("submit", (e) => e.preventDefault(), true);
}

async function applyContentToFrame() {
  const doc = S.frameDoc;
  for (const el of doc.querySelectorAll("[data-cms]")) {
    const key = el.dataset.cms;
    const v = getVal(key);
    if (v === undefined) continue;
    if ((await sha10(String(v))) !== el.dataset.cmsH) renderEl(el, key, v);
    else if (kindOf(key) === "i") { const alt = getVal(key + "_alt"); if (typeof alt === "string" && alt !== (el.getAttribute("alt") || "")) el.setAttribute("alt", alt); }
  }
}

function highlight(key, scroll) {
  if (!S.frameDoc) return;
  for (const el of S.frameDoc.querySelectorAll(".elevar-sel")) el.classList.remove("elevar-sel");
  if (!key) return;
  const els = [...S.frameDoc.querySelectorAll(`[data-cms="${key}"]`)];
  els.forEach((el) => el.classList.add("elevar-sel"));
  const visible = els.find((el) => el.getClientRects().length && el.offsetParent !== null) || els[0];
  if (scroll && visible) visible.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------------------------------------------------------------- login
async function renderLogin(error = "") {
  const app = document.getElementById("app");
  app.className = "";
  const status = await fetch("/api/login", { credentials: "same-origin" }).then((r) => r.json()).catch(() => ({}));
  const pw = h("input", { class: "input", type: "password", placeholder: "Password", autocomplete: "current-password", required: true });
  const err = h("div", { class: "error", style: error ? "" : "display:none" }, error);
  if (status.configured === false) { err.textContent = "The dashboard isn't set up yet. Add ADMIN_PASSWORD and GITHUB_TOKEN in Netlify's environment variables, then redeploy."; err.style.display = ""; }
  const btn = h("button", { class: "btn primary", type: "submit" }, "Sign in");
  const form = h("form", { class: "login-card", onsubmit: async (e) => {
    e.preventDefault(); btn.disabled = true; btn.textContent = "Signing in…"; err.style.display = "none";
    try { await api("/api/login", { method: "POST", body: JSON.stringify({ password: pw.value }) }); start(); }
    catch (x) { err.textContent = x.message; err.style.display = ""; btn.disabled = false; btn.textContent = "Sign in"; pw.select(); }
  } },
    h("img", { src: LOGO, alt: "Elevar Architects Group" }),
    h("h1", {}, "Website dashboard"),
    h("p", {}, "Sign in to edit your website."),
    err,
    h("label", { class: "field" }, h("span", {}, "Password"), pw),
    btn);
  put(app, h("div", { class: "login" }, form));
  pw.focus();
}

// ---------------------------------------------------------------- shell
let els = {};
function renderShell() {
  const app = document.getElementById("app");
  app.className = "";
  els.nav = h("nav", { class: "nav" });
  els.top = h("header", { class: "top" });
  els.main = h("main", { class: "main" });
  put(app, h("div", { class: "shell" },
    h("aside", { class: "side" },
      h("div", { class: "brand" }, h("img", { src: LOGO, alt: "Elevar" }), h("span", {}, "Dashboard")),
      els.nav,
      h("div", { class: "side-foot" },
        h("a", { class: "btn small", href: "/", target: "_blank", rel: "noopener" }, icon("external", 16), "View site"),
        h("button", { class: "btn small", onclick: logout }, icon("logout", 16), "Sign out"))),
    els.top, els.main));
  renderNav();
}

function renderNav() {
  const btn = (label, ic, active, onclick, file) => h("button", { class: active ? "active" : "", onclick, "data-file": file || null }, icon(ic), h("span", { class: "label" }, label), file && isDirty(file) ? h("span", { class: "dot", title: "Unpublished changes" }) : null);
  const main = S.pages.filter((p) => !isItemPage(p));
  const open = (p) => () => openPage(p.slug);
  const isP = (p) => S.view === "page" && S.page?.slug === p.slug;
  const itemBtn = (kind, it) => {
    const active = (S.view === "page" && S.page?.url === itemUrl(kind, it)) || ((S.view === "project" || S.view === "post") && S.item === it.slug);
    return btn(it.title || "Untitled", kind === "projects" ? "layers" : "rich", active, () => openItem(kind, it.slug));
  };
  put(els.nav,
    h("h6", {}, "Start"),
    btn("Overview", "home", S.view === "home", () => go("home")),
    h("h6", {}, "Pages"),
    main.map((p) => btn(p.label, "page", isP(p), open(p), p.file)),
    h("h6", {}, "Projects"),
    btn("All projects", "plus", S.view === "projects", () => go("projects"), COLL.projects),
    items("projects").map((it) => itemBtn("projects", it)),
    h("h6", {}, "News"),
    btn("All articles", "plus", S.view === "news", () => go("news"), COLL.news),
    items("news").map((it) => itemBtn("news", it)),
    h("h6", {}, "Services"),
    btn("Services", "briefcase", S.view === "services", () => go("services"), COLL.services),
    h("h6", {}, "Settings"),
    btn("Business details", "briefcase", S.view === "business", () => go("business"), BUSINESS_FILE),
    btn("Photo library", "photos", S.view === "media", () => go("media")),
  );
}
function renderNavDots() {
  for (const b of els.nav?.querySelectorAll("button[data-file]") || []) {
    const has = isDirty(b.dataset.file), dot = b.querySelector(".dot");
    if (has && !dot) b.append(h("span", { class: "dot", title: "Unpublished changes" }));
    if (!has && dot) dot.remove();
  }
}

function renderTop() {
  if (!els.top) return;
  const n = countChanges();
  const cur = (S.view === "project" || S.view === "post") ? getItem(S.view === "project" ? "projects" : "news", S.item) : null;
  const title = S.view === "page" ? S.page.label : cur ? (cur.title || "Untitled") : { business: "Business details", media: "Photo library", projects: "Projects", news: "News", services: "Services" }[S.view] || "Overview";
  const liveUrl = S.view === "page" ? S.page.url : cur ? itemUrl(S.view === "project" ? "projects" : "news", cur) : null;
  const status = S.publishing ? h("div", { class: "status" }, h("span", { class: "pulse" }), "Saving…")
    : S.waitingFor ? h("div", { class: "status" }, h("span", { class: "pulse" }), "Publishing, usually about a minute…")
    : n ? h("div", { class: "status" }, `${n} unpublished change${n > 1 ? "s" : ""}`)
    : h("div", { class: "status live" }, icon("check", 16), "All changes are live");
  const devices = ["page", "project", "post", "services"].includes(S.view) ? h("div", { class: "devices" }, ["desktop", "tablet", "mobile"].map((d) => h("button", { class: S.device === d ? "active" : "", title: d, onclick: () => { S.device = d; els.frameWrap.className = "frame-wrap " + d; renderTop(); } }, icon(d, 17)))) : null;
  put(els.top, 
    h("h2", {}, title),
    liveUrl ? h("a", { class: "btn ghost small", href: liveUrl, target: "_blank", rel: "noopener", title: "Open the live page (after publishing)" }, icon("external", 16)) : null,
    h("div", { class: "spacer" }),
    devices,
    status,
    n ? h("button", { class: "btn ghost small", onclick: discardAll, disabled: S.publishing }, "Discard") : null,
    h("button", { class: "btn accent", onclick: publish, disabled: !n || S.publishing }, "Publish"));
}

function go(view) {
  S.view = view; S.selected = null; S.frameDoc = null;
  renderNav(); renderTop();
  if (view === "home") renderHome();
  if (view === "business") renderBusiness();
  if (view === "media") renderMediaPage();
  if (view === "projects") renderItemsManager("projects");
  if (view === "news") renderItemsManager("news");
  if (view === "services") renderServicesManager();
}

// ---------------------------------------------------------------- overview
function renderHome() {
  els.main.className = "main full";
  const firstImg = (p) => {
    const d = S.docs[p.file]?.data; if (!d) return null;
    for (const sec of p.sections) for (const f of sec.fields) if (f.kind === "i") { const v = d[sec.name]?.[f.key]; if (v && !/logo/i.test(v)) return displaySrc(v); }
    return null;
  };
  const coverOf = (kind) => items(kind).find((x) => x.cover)?.cover;
  const managers = h("div", { class: "page-cards", style: "margin-bottom:30px" },
    [["projects", "Projects", "layers", `${items("projects").length} projects · add, reorder, remove`],
     ["news", "News", "rich", `${items("news").length} article${items("news").length === 1 ? "" : "s"} · write a new one`],
     ["services", "Services", "briefcase", `${items("services").length} services · add, edit, reorder`]].map(([v, label, ic, sub]) =>
      h("button", { class: "page-card", onclick: () => go(v) },
        h("div", { class: "shot", style: v !== "services" && coverOf(v) ? `background-image:url("${displaySrc(coverOf(v))}")` : "display:grid;place-items:center;color:#a8763e" }, v === "services" || !coverOf(v) ? icon(ic, 40) : null),
        h("div", { class: "meta" }, h("b", {}, label), h("span", {}, sub)))));
  const grid = h("div", { class: "page-cards" }, S.pages.filter((p) => !isItemPage(p)).map((p) => {
    const img = firstImg(p);
    return h("button", { class: "page-card", onclick: () => openPage(p.slug) },
      h("div", { class: "shot", style: img ? `background-image:url("${img}")` : "" }),
      h("div", { class: "meta" }, h("b", {}, p.label), h("span", {}, p.url)));
  }));
  put(els.main, h("div", { class: "welcome" },
    h("h1", {}, "Welcome back"),
    h("p", {}, "Choose a page, click anything on it to change it, then press Publish."),
    h("div", { class: "steps" },
      h("div", { class: "step" }, h("b", {}, h("i", {}, "1"), "Open a page"), h("span", {}, "Pick one below or from the menu.")),
      h("div", { class: "step" }, h("b", {}, h("i", {}, "2"), "Click to edit"), h("span", {}, "Click any text, photo or number on the page.")),
      h("div", { class: "step" }, h("b", {}, h("i", {}, "3"), "Publish"), h("span", {}, "Your changes go live in about a minute."))),
    h("div", { class: "section-title" }, "Projects, news & services"),
    managers,
    h("div", { class: "section-title" }, "Pages"),
    grid));
  // load page data once in the background, then redraw with photo thumbnails
  if (!S.pages.every((p) => S.docs[p.file])) {
    Promise.all(S.pages.map((p) => loadDoc(p.file).catch(() => null))).then(() => { if (S.view === "home") renderHome(); });
  }
}

// ---------------------------------------------------------------- page editor
async function openPage(slug) {
  S.view = "page"; S.page = S.pages.find((p) => p.slug === slug); S.selected = null; S.frameDoc = null;
  renderNav(); renderTop();
  els.main.className = "main";
  const iframe = h("iframe", { title: "Page preview" });
  els.frameWrap = h("div", { class: "frame-wrap " + S.device }, iframe);
  const loading = h("div", { class: "stage-loading" }, h("div", { class: "spinner" }));
  const tip = h("div", { class: "stage-tip" }, icon("text", 16), "Click any text or photo to edit it");
  els.panel = h("aside", { class: "panel" });
  put(els.main, h("section", { class: "stage" }, els.frameWrap, loading, tip), els.panel);
  setTimeout(() => tip.remove(), 6000);
  try {
    await Promise.all([loadDoc(S.page.file), loadDoc(S.globalFile)]);
  } catch (e) { toast(e.message, "bad"); return; }
  renderPanel();
  const page = S.page;
  iframe.addEventListener("load", async () => {
    if (S.page !== page) return;
    wireFrame(iframe);
    await applyContentToFrame();
    refreshFrameLists(S.frameDoc);
    loading.remove();
    if (S.selected) highlight(S.selected, true);
  });
  const rel = S.page.url.replace(/^\//, "") + "index.html";
  iframe.src = "/admin/edit/" + rel;
}

function select(key, scroll = true) {
  S.selected = key;
  highlight(key, scroll);
  renderPanel();
}

function renderPanel() {
  if (S.view !== "page" || !els.panel) return;
  put(els.panel, ...(S.selected ? fieldPanel(S.selected) : pagePanel()));
  els.panel.scrollTop = 0;
}

function kindInfo(key, el) {
  const k = kindOf(key);
  if (k === "i") return { name: "Photo", ic: "image" };
  if (k === "n") return { name: "Number", ic: "number" };
  if (el && /^H\d$/.test(el.tagName)) return { name: "Heading", ic: "heading" };
  if (el && (el.tagName === "A" || el.closest?.("a"))) return { name: "Link text", ic: "link" };
  if (k === "m") return { name: "Text", ic: "rich" };
  return { name: "Text", ic: "text" };
}

function itemButton(key) {
  const el = S.frameDoc?.querySelector(`[data-cms="${key}"]`);
  const info = kindInfo(key, el);
  const v = getVal(key);
  const changedNow = JSON.stringify(v) !== JSON.stringify(getOriginal(key)) || (kindOf(key) === "i" && getVal(key + "_alt") !== getOriginal(key + "_alt"));
  return h("button", { class: "item" + (changedNow ? " changed" : ""), onclick: () => select(key) },
    h("span", { class: "kind" }, info.ic === "image" && v ? h("img", { src: displaySrc(v), alt: "", loading: "lazy" }) : icon(info.ic, 16)),
    h("span", { class: "txt" }, h("b", {}, info.name), h("span", {}, info.ic === "image" ? (getVal(key + "_alt") || short(String(v).split("/").pop(), 40)) : short(v) || "(empty)")));
}

function pagePanel() {
  const doc = S.docs[S.page.file];
  const seo = doc.data.seo ||= { title: "", description: "" };
  const counter = (v, lo, hi) => h("small", { class: "count " + (!v.length ? "bad" : v.length < lo ? "warn" : v.length > hi ? "bad" : "good") }, `${v.length} characters · aim for ${lo}–${hi}`);
  const serp = h("div", { class: "serp" });
  const drawSerp = () => put(serp, 
    h("div", { class: "site" }, h("img", { src: LOGO, alt: "" }), h("div", {}, "Elevar Architects Group", h("small", {}, "elevararchitectsgroup.com" + S.page.url.replace(/\/$/, "").replace(/\//g, " › ")))),
    h("div", { class: "t" }, short(seo.title, 65) || "Page title"),
    h("div", { class: "d" }, short(seo.description, 165) || "Add a description so Google shows what this page is about."));
  drawSerp();
  const tCount = h("span"), dCount = h("span");
  const refresh = () => { put(tCount, counter(seo.title, 30, 60)); put(dCount, counter(seo.description, 120, 160)); drawSerp(); };
  const title = h("input", { class: "input", value: seo.title, oninput: (e) => { seo.title = e.target.value; refresh(); changed(); } });
  const desc = h("textarea", { class: "textarea", rows: 4, oninput: (e) => { seo.description = e.target.value; refresh(); changed(); } }, seo.description);
  refresh();

  const pageKeys = new Set([...(S.frameDoc ? [...S.frameDoc.querySelectorAll("[data-cms]")].map((e) => e.dataset.cms) : [])]);
  const groups = S.page.sections.map((sec, i) => h("details", { class: "group", open: i < 2 },
    h("summary", {}, icon("chev", 15), sec.label.replace(/^Section \d+:?\s*/, "") || sec.label, h("span", { class: "n" }, sec.fields.length)),
    h("div", { class: "items" }, sec.fields.map((f) => itemButton(f.key)))));
  const shared = S.globalSections.map((sec) => {
    const fields = sec.fields.filter((f) => !S.frameDoc || pageKeys.has(f.key));
    return fields.length ? h("details", { class: "group" },
      h("summary", {}, icon("chev", 15), sec.label, h("span", { class: "chip blue" }, "all pages"), h("span", { class: "n" }, fields.length)),
      h("div", { class: "items" }, fields.map((f) => itemButton(f.key)))) : null;
  });

  return [
    h("div", { class: "panel-head" }, h("h3", {}, S.page.label), h("p", {}, "Click anything on the page to edit it, or pick it from the list below.")),
    h("div", { class: "panel-body" },
      h("div", { class: "section-title" }, icon("globe", 15), "How it looks on Google"),
      serp,
      h("label", { class: "field" }, h("span", {}, "Google title", tCount), title),
      h("label", { class: "field" }, h("span", {}, "Google description", dCount), desc),
      listingCardSection(),
      h("div", { class: "section-title" }, icon("layers", 15), "Everything on this page"),
      groups, shared),
  ];
}

function fieldPanel(key) {
  const el = S.frameDoc?.querySelector(`[data-cms="${key}"]`);
  const info = kindInfo(key, el);
  const isGlobal = key.startsWith("g");
  const original = getOriginal(key);
  const differs = () => JSON.stringify(getVal(key)) !== JSON.stringify(original) || (kindOf(key) === "i" && getVal(key + "_alt") !== getOriginal(key + "_alt"));
  const sectionLabel = (() => { const w = locate(key); const list = isGlobal ? S.globalSections : S.page.sections; return list.find((s) => s.name === w?.section)?.label.replace(/^Section \d+:?\s*/, "") || ""; })();
  const undo = h("button", { class: "btn ghost small", style: differs() ? "" : "display:none", onclick: () => {
    setVal(key, original); if (kindOf(key) === "i") setVal(key + "_alt", getOriginal(key + "_alt"));
    updatePreview(key); renderPanel(); toast("Change undone.");
  } }, icon("undo", 15), "Undo change");
  const onChange = () => { undo.style.display = differs() ? "" : "none"; };

  let editor;
  const k = kindOf(key);
  if (k === "i") editor = imageEditor(key, onChange);
  else if (k === "n") editor = h("label", { class: "field" }, h("span", {}, "Number"),
    h("input", { class: "input", type: "number", min: 0, value: getVal(key), oninput: (e) => { setVal(key, e.target.value); updatePreview(key); onChange(); } }),
    h("div", { class: "hint" }, "The counter animates up to this number."));
  else if (k === "m") editor = richEditor(key, onChange);
  else {
    const ta = h("textarea", { class: "textarea", rows: Math.min(10, Math.max(2, Math.ceil(String(getVal(key) || "").length / 38))), oninput: (e) => { setVal(key, e.target.value); updatePreview(key); onChange(); } }, getVal(key) || "");
    editor = h("label", { class: "field" }, h("span", {}, info.name), ta, h("div", { class: "hint" }, "Changes show on the page as you type. Press Enter for a new line."));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
  }

  return [
    h("div", { class: "panel-head" },
      h("button", { class: "btn ghost small back", onclick: () => { S.selected = null; highlight(null); renderPanel(); } }, icon("back", 15), "All page content"),
      h("h3", {}, icon(info.ic), "Edit " + info.name.toLowerCase(), isGlobal ? h("span", { class: "chip blue", title: "This is in the header or footer, so it changes on every page." }, "all pages") : null),
      h("p", {}, sectionLabel ? "In: " + sectionLabel : "")),
    h("div", { class: "panel-body" }, editor, undo),
  ];
}

// ---- rich text (bold / italic / links)
function htmlToMd(node) {
  let out = "";
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { out += c.textContent.replace(/([*_\[\]\\])/g, "\\$1"); continue; }
    if (c.nodeType !== 1) continue;
    const t = c.tagName, inner = htmlToMd(c);
    if (t === "B" || t === "STRONG") out += inner.trim() ? `**${inner}**` : inner;
    else if (t === "I" || t === "EM") out += inner.trim() ? `*${inner}*` : inner;
    else if (t === "A") out += `[${inner}](${c.getAttribute("href") || ""})`;
    else if (t === "BR") out += "  \n";
    else if (t === "DIV" || t === "P") out += (out && !out.endsWith("\n") ? "  \n" : "") + inner;
    else out += inner;
  }
  return out;
}
function richEditor(key, onChange) {
  const ed = h("div", { class: "ed", contenteditable: "true", html: window.marked ? window.marked.parseInline(getVal(key) || "") : esc(getVal(key)) });
  const save = () => { setVal(key, htmlToMd(ed).replace(/(  \n)+$/, "").trim()); updatePreview(key); onChange(); };
  ed.addEventListener("input", save);
  ed.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); });
  const cmd = (c, v) => (e) => { e.preventDefault(); ed.focus(); document.execCommand(c, false, v); save(); };
  const link = (e) => {
    e.preventDefault();
    const url = prompt("Link address (for example /contact/ or https://…). Leave empty to remove the link.");
    if (url === null) return;
    ed.focus(); document.execCommand(url ? "createLink" : "unlink", false, url); save();
  };
  setTimeout(() => ed.focus(), 30);
  return h("div", { class: "field" },
    h("div", { class: "rich" },
      h("div", { class: "bar" },
        h("button", { title: "Bold", onmousedown: cmd("bold") }, icon("bold", 16)),
        h("button", { title: "Italic", onmousedown: cmd("italic") }, icon("italic", 16)),
        h("button", { title: "Link", onmousedown: link }, icon("link", 16))),
      ed),
    h("div", { class: "hint" }, "Select words, then use the buttons for bold, italic or a link."));
}

// ---- photos
function imageEditor(key, onChange) {
  const preview = h("img", { src: displaySrc(getVal(key)), alt: "" });
  const alt = h("input", { class: "input", value: getVal(key + "_alt") || "", placeholder: "Describe the photo, e.g. Kwigira center courtyard at sunset", oninput: (e) => { setVal(key + "_alt", e.target.value); updatePreview(key); onChange(); } });
  const use = (url) => { setVal(key, url); preview.src = displaySrc(url); updatePreview(key); onChange(); };
  const picker = h("input", { type: "file", accept: "image/*", style: "display:none", onchange: async (e) => { const f = e.target.files[0]; if (f) use(await addUpload(f)); } });
  const drop = h("div", { class: "drop" }, "Or drop a photo here");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", async (e) => { e.preventDefault(); drop.classList.remove("over"); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (f) use(await addUpload(f)); });
  return h("div", { class: "img-field" },
    h("div", { class: "preview" }, preview),
    h("div", { class: "actions" },
      h("button", { class: "btn primary", onclick: () => picker.click() }, icon("upload", 16), "Upload new"),
      h("button", { class: "btn", onclick: () => openLibrary(use) }, icon("photos", 16), "From library")),
    picker, drop,
    h("label", { class: "field" }, h("span", {}, "Description (alt text)"), alt, h("div", { class: "hint" }, "Helps Google and visitors using screen readers.")));
}

// Resize big photos in the browser before uploading (max 2400px, ~85% quality).
async function addUpload(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  let blob = file;
  let ext = (file.name.match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || "jpg").toLowerCase();
  if (bitmap && ext !== "gif") {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    if (scale < 1 || file.size > 1.2e6) {
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
      c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
      const type = ext === "png" ? "image/webp" : "image/jpeg";
      blob = await new Promise((r) => c.toBlob(r, type, 0.85));
      ext = type === "image/webp" ? "webp" : "jpg";
    }
  }
  if (blob.size > 4.4e6) { toast("That photo is too large even after resizing. Please use a smaller one.", "bad"); throw new Error("too large"); }
  const base = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "photo";
  const name = `${base}-${Date.now().toString(36)}.${ext}`;
  const base64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
  const url = `/wp-content/uploads/cms/${name}`;
  S.uploads.set(url, { path: `site/wp-content/uploads/cms/${name}`, base64, blobUrl: URL.createObjectURL(blob), name: base.replace(/-/g, " ") });
  S.media.unshift({ name: base.replace(/-/g, " "), src: url, thumb: url, pending: true });
  toast("Photo added. It goes live when you publish.", "ok");
  renderTop();
  return url;
}

function libraryGrid(onPick, filter = "") {
  const q = filter.toLowerCase();
  const items = S.media.filter((m) => !q || m.name.toLowerCase().includes(q) || m.src.toLowerCase().includes(q));
  if (!items.length) return h("p", { class: "muted" }, "No photos match.");
  return h("div", { class: "grid" }, items.map((m) => h("button", { class: "tile", title: m.src, onclick: () => onPick(m) },
    h("img", { src: displaySrc(m.thumb), alt: m.name, loading: "lazy" }),
    m.pending ? h("span", { class: "chip new" }, "new") : null,
    h("span", {}, m.name))));
}

async function loadMedia() {
  if (S.media.length) return;
  S.media = await (await fetch("/admin/media.json", { cache: "no-store" })).json().catch(() => []);
}

function libraryBody(onPick, extraHead) {
  const search = h("input", { class: "input", placeholder: "Search photos…", type: "search" });
  const holder = h("div");
  const draw = () => put(holder, libraryGrid(onPick, search.value));
  search.addEventListener("input", draw);
  const picker = h("input", { type: "file", accept: "image/*", multiple: true, style: "display:none", onchange: async (e) => { for (const f of e.target.files) await addUpload(f).catch(() => {}); draw(); } });
  const wrap = h("div", { class: "lib" },
    h("div", { class: "lib-head" }, search, h("button", { class: "btn primary", onclick: () => picker.click() }, icon("upload", 16), "Upload photos"), picker, extraHead),
    holder);
  wrap.addEventListener("dragover", (e) => e.preventDefault());
  wrap.addEventListener("drop", async (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) if (f.type.startsWith("image/")) await addUpload(f).catch(() => {}); draw(); });
  loadMedia().then(draw);
  return wrap;
}

function openLibrary(use) {
  const close = () => back.remove();
  const back = h("div", { class: "modal-back", onclick: (e) => { if (e.target === back) close(); } },
    h("div", { class: "modal" },
      h("div", { class: "modal-top" }, h("h3", {}, "Choose a photo"), h("div", { class: "spacer", style: "flex:1" }), h("button", { class: "btn ghost", onclick: close }, "Close")),
      libraryBody((m) => { use(m.src); close(); })));
  document.body.append(back);
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
}

function renderMediaPage() {
  els.main.className = "main full";
  put(els.main, libraryBody((m) => {
    navigator.clipboard?.writeText(location.origin + m.src).then(() => toast("Photo link copied."), () => {});
  }, h("span", { class: "muted" }, "Click a photo to copy its link. Drag photos here to upload.")));
}

// ---------------------------------------------------------------- business details
async function renderBusiness() {
  els.main.className = "main full";
  put(els.main, h("div", { class: "loading-screen" }, h("div", { class: "spinner" })));
  let doc;
  try { doc = await loadDoc(BUSINESS_FILE); } catch (e) { toast(e.message, "bad"); return; }
  const b = doc.data;
  const input = (key, label, opts = {}) => h("label", { class: "field" }, h("span", {}, label),
    h(opts.long ? "textarea" : "input", { class: opts.long ? "textarea" : "input", value: opts.long ? null : (b[key] ?? ""), placeholder: opts.ph || "", rows: opts.long ? 4 : null, oninput: (e) => { b[key] = e.target.value; changed(); } }, opts.long ? (b[key] ?? "") : null),
    opts.hint ? h("div", { class: "hint" }, opts.hint) : null);
  const list = (key, label, ph, hint) => {
    const box = h("div");
    const draw = () => put(box, 
      ...(b[key] ||= []).map((v, i) => h("div", { class: "list-row" },
        h("input", { class: "input", value: v, placeholder: ph, oninput: (e) => { b[key][i] = e.target.value; changed(); } }),
        h("button", { class: "btn ghost", title: "Remove", onclick: () => { b[key].splice(i, 1); changed(); draw(); } }, icon("trash", 16)))),
      h("button", { class: "btn small", onclick: () => { b[key].push(""); changed(); draw(); box.querySelector(".list-row:last-of-type input")?.focus(); } }, icon("plus", 15), "Add"));
    draw();
    return h("div", { class: "field" }, h("div", { style: "font-weight:600;font-size:13px;margin-bottom:6px" }, label), hint ? h("div", { class: "hint", style: "margin:-2px 0 10px" }, hint) : null, box, h("div", { style: "height:18px" }));
  };
  const photo = (key, label) => {
    const img = h("img", { src: displaySrc(b[key]) || "", alt: "", style: "max-height:90px;max-width:220px;border-radius:8px;background:#f4f2ee;display:block;margin-bottom:10px;object-fit:contain" });
    return h("div", { class: "field" }, h("div", { style: "font-weight:600;font-size:13px;margin-bottom:6px" }, label), img,
      h("button", { class: "btn small", onclick: () => openLibrary((url) => { b[key] = url; img.src = displaySrc(url); changed(); }) }, icon("photos", 15), "Change"), h("div", { style: "height:18px" }));
  };
  put(els.main, h("div", { class: "form-page" }, h("div", { class: "cards" },
    h("div", { class: "card" }, h("h3", {}, "Company"), h("p", {}, "Google shows these details in search results and on Maps."),
      h("div", { class: "two" }, input("name", "Company name"), input("alternate_name", "Short name")),
      input("slogan", "Slogan"),
      input("description", "About the company", { long: true, hint: "One or two sentences describing what you do and where." })),
    h("div", { class: "card" }, h("h3", {}, "Contact & location"), h("p", {}, "How clients reach you."),
      h("div", { class: "two" }, input("phone", "Phone", { hint: "International format, e.g. +250788351457" }), input("email", "Email")),
      h("div", { class: "two" }, input("street", "Area / street"), input("city", "City")),
      h("div", { class: "two" }, input("region", "District"), input("country", "Country code", { hint: "Two letters, e.g. RW" })),
      input("area_served", "Area served", { ph: "Rwanda" })),
    h("div", { class: "card" }, h("h3", {}, "Services"), h("p", {}, "Google gets your services list automatically from the Services section."),
      h("button", { class: "btn small", style: "margin-bottom:20px", onclick: () => go("services") }, icon("briefcase", 15), "Manage services")),
    h("div", { class: "card" }, h("h3", {}, "Social media & images"), h("p", {}, "Links to your profiles help Google connect them to your website."),
      list("social_links", "Profile links", "https://www.linkedin.com/company/…", "Full addresses of your LinkedIn, Instagram, Facebook or other pages."),
      h("div", { class: "two" }, photo("logo", "Logo"), photo("image", "Main photo"))))));
}

// ---------------------------------------------------------------- projects, news & services
const items = (kind) => { const d = S.docs[COLL[kind]]?.data; if (!d) return []; return (d.items ||= []); };
const getItem = (kind, slug) => items(kind).find((x) => x.slug === slug);
const itemUrl = (kind, it) => (kind === "projects" ? C.projectPath(it) : C.postPath(it));
const isItemPage = (p) => p.url.startsWith("/portfolio/") || p.url === C.POST_TEMPLATE.path;
const longDate = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); };
const isUnpublished = (kind, it) => { const o = S.docs[COLL[kind]]?.original; return o && !JSON.parse(o).items?.some((x) => x.slug === it.slug); };
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, v) {
  const ks = path.split(".");
  let o = obj;
  ks.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; });
  o[ks[ks.length - 1]] = v;
}
function parseFrag(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// Photos uploaded but not yet published only exist in this browser: show them from memory.
function fixPendingImages(doc) {
  for (const img of doc.querySelectorAll("img")) { const u = S.uploads.get(img.getAttribute("src")); if (u) img.setAttribute("src", u.blobUrl); }
  for (const el of doc.querySelectorAll("style#elevar-hero, .post-thumbnail")) {
    for (const [url, u] of S.uploads) {
      if (el.tagName === "STYLE" && el.textContent.includes(url)) el.textContent = el.textContent.split(url).join(u.blobUrl);
      const st = el.getAttribute("style") || ""; if (st.includes(url)) el.setAttribute("style", st.split(url).join(u.blobUrl));
    }
  }
}

function refreshFrameLists(doc) {
  if (!doc?.querySelector("[data-collection]")) return;
  C.renderProjectCards(doc, items("projects"), parseFrag);
  C.renderNewsCards(doc, items("news"), parseFrag);
  C.renderServices(doc, items("services"), parseFrag);
  fixPendingImages(doc);
}

function openItem(kind, slug) {
  const it = getItem(kind, slug);
  if (!it) return go(kind);
  if (it.kind === "original") {
    const page = S.pages.find((p) => p.url === itemUrl(kind, it));
    if (page) return openPage(page.slug);
  }
  return kind === "projects" ? openProjectEditor(slug) : openPostEditor(slug);
}

const RESERVED = new Set(["admin", "api", "wp-content", "wp-includes", "portfolio", "news", "projects", "services", "about", "contact", "thank-you", "category", "tag", "author", "home", "home-03", "feed", "sitemap.xml"]);
function uniqueSlug(kind, title) {
  const base = C.slugify(title);
  const taken = new Set(items(kind).map((x) => x.slug));
  if (kind === "news") { for (const r of RESERVED) taken.add(r); for (const p of S.pages) taken.add(p.url.split("/")[1]); }
  let s = base, n = 2;
  while (taken.has(s)) s = `${base}-${n++}`;
  return s;
}

function askText(title, label, placeholder = "") {
  return new Promise((resolve) => {
    const input = h("input", { class: "input", placeholder });
    const done = (v) => { back.remove(); resolve(v); };
    const back = h("div", { class: "modal-back", onclick: (e) => { if (e.target === back) done(null); } },
      h("form", { class: "modal small", onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) done(input.value.trim()); } },
        h("h3", {}, title),
        h("label", { class: "field" }, h("span", {}, label), input),
        h("div", { class: "modal-actions" },
          h("button", { type: "button", class: "btn ghost", onclick: () => done(null) }, "Cancel"),
          h("button", { type: "submit", class: "btn accent" }, "Create"))));
    document.body.append(back);
    setTimeout(() => input.focus(), 30);
  });
}

async function addItem(kind) {
  const isP = kind === "projects";
  const title = await askText(isP ? "Add a project" : "Write an article", isP ? "Project name" : "Article title", isP ? "e.g. Nyamata Health Post" : "e.g. Our new office in Kimihurura");
  if (!title) return;
  const now = new Date(); const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); // local date
  const blank = { title: "", text: "" };
  const it = isP
    ? { kind: "new", slug: uniqueSlug(kind, title), title, excerpt: "", cover: "", date: today, tagline: "", highlights: [{ ...blank }, { ...blank }, { ...blank }], intro_heading: "Facilities.", intro: "", photos: ["", "", "", ""], section2: { heading: "Purpose-Driven Design", text: "" }, section3: { heading: "Supporting Growth Through Architecture", text: "" }, seo: { title: "", description: "" } }
    : { kind: "new", slug: uniqueSlug(kind, title), title, date: today, cover: "", excerpt: "", body: "<p></p>", seo: { title: "", description: "" } };
  items(kind).unshift(it);
  changed(); renderNav();
  toast(isP ? "Project added. Fill in the details, then Publish." : "Article added. Write it, then Publish.", "ok");
  openItem(kind, it.slug);
}

function deleteItem(kind, it) {
  if (!confirm(`Delete "${it.title || "Untitled"}"? It disappears from the website when you publish.`)) return false;
  const list = items(kind);
  list.splice(list.indexOf(it), 1);
  changed(); renderNav();
  return true;
}

function renderItemsManager(kind) {
  els.main.className = "main full";
  const isP = kind === "projects";
  const list = items(kind);
  const shown = isP ? list : [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const move = (i, d) => { [list[i], list[i + d]] = [list[i + d], list[i]]; changed(); renderNav(); renderItemsManager(kind); };
  const row = (it) => {
    const i = list.indexOf(it);
    return h("div", { class: "mgr-row" },
      h("button", { class: "mgr-thumb", style: it.cover ? `background-image:url("${displaySrc(it.cover)}")` : "", onclick: () => openItem(kind, it.slug), title: "Edit" }, it.cover ? null : icon("image", 26)),
      h("div", { class: "mgr-txt" },
        h("b", {}, it.title || "Untitled"),
        h("span", {}, isP ? it.excerpt || "No short description yet" : longDate(it.date)),
        h("div", { class: "chips" },
          it.kind === "original" ? h("span", { class: "chip" }, "original page") : h("span", { class: "chip green" }, "new"),
          isUnpublished(kind, it) ? h("span", { class: "chip blue" }, "not published yet") : null)),
      h("div", { class: "mgr-actions" },
        isP ? h("button", { class: "btn small ghost", title: "Move up", disabled: i === 0, onclick: () => move(i, -1) }, "↑") : null,
        isP ? h("button", { class: "btn small ghost", title: "Move down", disabled: i === list.length - 1, onclick: () => move(i, 1) }, "↓") : null,
        h("a", { class: "btn small ghost", href: itemUrl(kind, it), target: "_blank", rel: "noopener", title: "View on the site" }, icon("external", 15)),
        h("button", { class: "btn small ghost danger", title: "Delete", onclick: () => { if (deleteItem(kind, it)) renderItemsManager(kind); } }, icon("trash", 15)),
        h("button", { class: "btn small primary", onclick: () => openItem(kind, it.slug) }, "Edit")));
  };
  put(els.main, h("div", { class: "welcome" },
    h("div", { class: "mgr-head" },
      h("div", {}, h("h1", {}, isP ? "Projects" : "News"),
        h("p", {}, isP ? "Shown on the Projects page in this order. New projects get a full page in the same design as Kwigira." : "Articles on the News page, newest first.")),
      h("button", { class: "btn accent", onclick: () => addItem(kind) }, icon("plus", 16), isP ? "Add project" : "Write article")),
    list.length ? h("div", { class: "mgr-list" }, shown.map(row)) : h("p", { class: "muted" }, "Nothing here yet.")));
}

// ---- small form helpers for the item editors
function textField(obj, path, label, { long = false, rows = 3, hint = "", ph = "", onChange } = {}) {
  const ctl = h(long ? "textarea" : "input", { class: long ? "textarea" : "input", rows: long ? rows : null, placeholder: ph, value: long ? null : getPath(obj, path) ?? "", oninput: (e) => { setPath(obj, path, e.target.value); onChange?.(); } }, long ? getPath(obj, path) ?? "" : null);
  return h("label", { class: "field", "data-field": path }, h("span", {}, label), ctl, hint ? h("div", { class: "hint" }, hint) : null);
}
function photoField(obj, path, label, onChange, hint = "") {
  const img = h("img", { alt: "" });
  const empty = h("span", { class: "muted" }, "No photo yet");
  const draw = () => { const v = getPath(obj, path); img.src = v ? displaySrc(v) : ""; img.style.display = v ? "" : "none"; empty.style.display = v ? "none" : ""; };
  const use = (url) => { setPath(obj, path, url); draw(); onChange?.(); };
  const file = h("input", { type: "file", accept: "image/*", style: "display:none", onchange: async (e) => { const f = e.target.files[0]; if (f) use(await addUpload(f)); } });
  const box = h("div", { class: "pick" }, h("div", { class: "pick-img" }, img, empty),
    h("div", { class: "pick-btns" },
      h("button", { type: "button", class: "btn small primary", onclick: () => file.click() }, icon("upload", 15), "Upload"),
      h("button", { type: "button", class: "btn small", onclick: () => openLibrary(use) }, icon("photos", 15), "Library")), file);
  box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("over"); });
  box.addEventListener("dragleave", () => box.classList.remove("over"));
  box.addEventListener("drop", async (e) => { e.preventDefault(); box.classList.remove("over"); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (f) use(await addUpload(f)); });
  draw();
  return h("div", { class: "field", "data-field": path }, h("div", { class: "flabel" }, label), box, hint ? h("div", { class: "hint" }, hint) : null);
}
function seoFields(it, url, fallbackTitle, fallbackDesc) {
  it.seo ||= { title: "", description: "" };
  const serp = h("div", { class: "serp" });
  const draw = () => put(serp,
    h("div", { class: "site" }, h("img", { src: LOGO, alt: "" }), h("div", {}, "Elevar Architects Group", h("small", {}, "elevararchitectsgroup.com" + url.replace(/\/$/, "").replace(/\//g, " › ")))),
    h("div", { class: "t" }, short(it.seo.title || fallbackTitle(), 65)),
    h("div", { class: "d" }, short(it.seo.description || fallbackDesc() || "Add a description so Google shows what this page is about.", 165)));
  draw();
  return [serp,
    textField(it, "seo.title", "Google title (optional)", { ph: fallbackTitle(), hint: "Leave empty to use the name. Aim for 50–60 characters.", onChange: () => { changed(); draw(); } }),
    textField(it, "seo.description", "Google description (optional)", { long: true, ph: "Uses the short description if empty", hint: "Aim for 140–160 characters.", onChange: () => { changed(); draw(); } }),
  ];
}
function focusField(path) {
  const el = path && els.panel?.querySelector(`[data-field="${path}"]`);
  if (!el) { toast("This part is the same on every page of this type."); return; }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  setTimeout(() => el.querySelector("input:not([type=file]), textarea, [contenteditable]")?.focus({ preventScroll: true }), 350);
}
function editorShell(src, title) {
  els.main.className = "main";
  const iframe = h("iframe", { title });
  els.frameWrap = h("div", { class: "frame-wrap " + S.device }, iframe);
  const loading = h("div", { class: "stage-loading" }, h("div", { class: "spinner" }));
  els.panel = h("aside", { class: "panel" });
  put(els.main, h("section", { class: "stage" }, els.frameWrap, loading), els.panel);
  return { iframe, loading, start: () => { iframe.src = src; } };
}

// ---- project editor (new projects)
const PROJECT_KEYS = { t1: "title", t2: "title", t7: "tagline", t8: "highlights.0.title", t9: "highlights.1.title", t10: "highlights.2.title", t11: "highlights.0.text", t12: "highlights.1.text", t13: "highlights.2.text", t14: "intro_heading", t15: "intro", t18: "section2.heading", t20: "section2.text", t23: "section3.heading", t27: "section3.text", i16: "photos.0", i17: "photos.1", i21: "photos.2", i22: "photos.3" };

function openProjectEditor(slug) {
  S.view = "project"; S.item = slug; S.page = null; S.selected = null; S.frameDoc = null;
  renderNav(); renderTop();
  const it = getItem("projects", slug);
  const { iframe, loading, start } = editorShell("/admin/templates/project.html", "Project preview");
  const refresh = () => { if (S.frameDoc) { C.fillProject(S.frameDoc, it, { head: false }); fixPendingImages(S.frameDoc); } };
  const upd = () => { changed(); refresh(); };
  const sec = (ic, t, sub) => [h("div", { class: "section-title" }, icon(ic, 15), t), sub ? h("p", { class: "hint", style: "margin:-4px 0 14px" }, sub) : null];
  put(els.panel,
    h("div", { class: "panel-head" }, h("h3", {}, icon("layers"), "Project page"), h("p", {}, "Fill in the form. The preview updates as you type, and you can click the preview to jump to a field.")),
    h("div", { class: "panel-body" },
      sec("page", "Basics"),
      textField(it, "title", "Project name", { onChange: () => { upd(); renderTop(); } }),
      textField(it, "excerpt", "Short description", { long: true, rows: 2, hint: "Shown under the photo on the Projects page.", onChange: upd }),
      photoField(it, "cover", "Main photo", upd, "Used as the big background at the top and on the Projects page."),
      textField(it, "tagline", "Tagline", { ph: "e.g. Designing Hope, Dignity, and Empowerment in Kinigi", onChange: upd }),
      sec("rich", "Three highlights", "The tabs under the title."),
      [0, 1, 2].map((i) => h("div", { class: "subcard" },
        textField(it, `highlights.${i}.title`, `Highlight ${i + 1}: title`, { onChange: upd }),
        textField(it, `highlights.${i}.text`, `Highlight ${i + 1}: text`, { long: true, rows: 4, onChange: upd }))),
      sec("text", "Story"),
      textField(it, "intro_heading", "Heading 1", { onChange: upd }),
      textField(it, "intro", "Text 1", { long: true, rows: 5, onChange: upd }),
      textField(it, "section2.heading", "Heading 2", { onChange: upd }),
      textField(it, "section2.text", "Text 2", { long: true, rows: 5, onChange: upd }),
      textField(it, "section3.heading", "Heading 3", { onChange: upd }),
      textField(it, "section3.text", "Text 3", { long: true, rows: 5, onChange: upd }),
      sec("photos", "Photos", "Four photos placed between the text. Empty ones use the main photo."),
      h("div", { class: "pick-grid" }, [0, 1, 2, 3].map((i) => photoField(it, `photos.${i}`, `Photo ${i + 1}`, upd))),
      sec("globe", "Google"),
      seoFields(it, C.projectPath(it), () => `${it.title || "Project"} | Elevar Architects Group`, () => it.excerpt),
      h("div", { class: "danger-zone" }, h("button", { class: "btn small ghost danger", onclick: () => { if (deleteItem("projects", it)) go("projects"); } }, icon("trash", 15), "Delete this project"))));
  iframe.addEventListener("load", () => {
    if (S.item !== slug) return;
    wireFrame(iframe, (key) => focusField(PROJECT_KEYS[key]));
    refresh();
    loading.remove();
  });
  start();
}

// ---- article editor (new articles)
function bodyEditor(it, onChange) {
  const ed = h("div", { class: "ed body-ed", contenteditable: "true", html: it.body || "<p></p>" });
  const save = () => { it.body = cleanHtml(ed.innerHTML); onChange(); };
  ed.addEventListener("input", save);
  ed.addEventListener("paste", (e) => { e.preventDefault(); const txt = e.clipboardData.getData("text/plain"); document.execCommand("insertHTML", false, txt.split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")); });
  const cmd = (c, v) => (e) => { e.preventDefault(); ed.focus(); document.execCommand("defaultParagraphSeparator", false, "p"); document.execCommand(c, false, v); save(); };
  const link = (e) => { e.preventDefault(); const url = prompt("Link address (e.g. /contact/ or https://…). Leave empty to remove the link."); if (url === null) return; ed.focus(); document.execCommand(url ? "createLink" : "unlink", false, url); save(); };
  const photo = (e) => { e.preventDefault(); const sel = window.getSelection(); const range = sel.rangeCount ? sel.getRangeAt(0) : null; openLibrary((url) => { ed.focus(); if (range) { sel.removeAllRanges(); sel.addRange(range); } document.execCommand("insertHTML", false, `<p><img src="${esc(url)}" alt=""></p>`); save(); }); };
  const b = (label, title, fn) => h("button", { type: "button", title, onmousedown: fn }, label);
  return h("div", { class: "field", "data-field": "body" },
    h("div", { class: "flabel" }, "Article"),
    h("div", { class: "rich" },
      h("div", { class: "bar wrap" },
        b("¶", "Normal text", cmd("formatBlock", "p")), b("H2", "Big heading", cmd("formatBlock", "h2")), b("H3", "Small heading", cmd("formatBlock", "h3")),
        b(icon("bold", 16), "Bold", cmd("bold")), b(icon("italic", 16), "Italic", cmd("italic")), b(icon("link", 16), "Link", link),
        b("•", "Bullet list", cmd("insertUnorderedList")), b("1.", "Numbered list", cmd("insertOrderedList")), b("❝", "Quote", cmd("formatBlock", "blockquote")),
        b(icon("image", 16), "Insert photo", photo)),
      ed),
    h("div", { class: "hint" }, "Write or paste your article. Use H2/H3 for headings."));
}
function cleanHtml(html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  t.content.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach((el) => el.remove());
  t.content.querySelectorAll("span,font").forEach((el) => el.replaceWith(...el.childNodes));
  t.content.querySelectorAll("div").forEach((el) => { const p = document.createElement("p"); p.append(...el.childNodes); el.replaceWith(p); });
  t.content.querySelectorAll("*").forEach((el) => { for (const a of [...el.attributes]) if (!(el.tagName === "A" && a.name === "href") && !(el.tagName === "IMG" && (a.name === "src" || a.name === "alt"))) el.removeAttribute(a.name); });
  return t.innerHTML.trim();
}

function openPostEditor(slug) {
  S.view = "post"; S.item = slug; S.page = null; S.selected = null; S.frameDoc = null;
  renderNav(); renderTop();
  const it = getItem("news", slug);
  const { iframe, loading, start } = editorShell("/admin/templates/post.html", "Article preview");
  const refresh = () => { if (S.frameDoc) { C.fillPost(S.frameDoc, it, { head: false, sanitize: cleanHtml }); fixPendingImages(S.frameDoc); } };
  const upd = () => { changed(); refresh(); };
  put(els.panel,
    h("div", { class: "panel-head" }, h("h3", {}, icon("rich"), "Article"), h("p", {}, "The preview updates as you type.")),
    h("div", { class: "panel-body" },
      textField(it, "title", "Title", { onChange: () => { upd(); renderTop(); } }),
      h("label", { class: "field", "data-field": "date" }, h("span", {}, "Date"), h("input", { class: "input", type: "date", value: it.date, oninput: (e) => { it.date = e.target.value; upd(); } })),
      photoField(it, "cover", "Main photo", upd, "Shown at the top of the article and on the News page."),
      textField(it, "excerpt", "Short summary", { long: true, rows: 2, hint: "Used for Google and social media previews.", onChange: upd }),
      bodyEditor(it, upd),
      h("div", { class: "section-title" }, icon("globe", 15), "Google"),
      seoFields(it, C.postPath(it), () => `${it.title || "Article"} | Elevar Architects Group`, () => it.excerpt),
      h("div", { class: "danger-zone" }, h("button", { class: "btn small ghost danger", onclick: () => { if (deleteItem("news", it)) go("news"); } }, icon("trash", 15), "Delete this article"))));
  iframe.addEventListener("load", () => {
    if (S.item !== slug) return;
    wireFrame(iframe, (key) => focusField({ t3: "title" }[key]));
    S.frameDoc.addEventListener("click", (e) => {
      if (e.target.closest(".entry-content")) focusField("body");
      else if (e.target.closest(".post-thumbnail") && !pickTarget(e.target)) focusField("cover");
    }, true);
    refresh();
    loading.remove();
  });
  start();
}

// ---- services
function renderServicesManager() {
  const list = items("services");
  const { iframe, loading, start } = editorShell("/admin/edit/services/index.html", "Services preview");
  const refresh = () => { if (S.frameDoc) C.renderServices(S.frameDoc, list, parseFrag); };
  const upd = () => { changed(); refresh(); };
  const box = h("div", { class: "svc-list" });
  const draw = () => put(box, list.map((s, i) => h("div", { class: "svc", "data-field": "s" + i },
    h("div", { class: "svc-top" },
      h("span", { class: "svc-n" }, String(i + 1)),
      h("input", { class: "input", value: s.name, placeholder: "Service name", oninput: (e) => { s.name = e.target.value; upd(); } }),
      h("button", { class: "btn small ghost", title: "Move up", disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; upd(); draw(); } }, "↑"),
      h("button", { class: "btn small ghost", title: "Move down", disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; upd(); draw(); } }, "↓"),
      h("button", { class: "btn small ghost danger", title: "Delete", onclick: () => { if (confirm(`Delete "${s.name}"?`)) { list.splice(i, 1); upd(); draw(); } } }, icon("trash", 15))),
    h("textarea", { class: "textarea", rows: 4, placeholder: "Describe this service", oninput: (e) => { s.description = e.target.value; upd(); } }, s.description || ""))));
  draw();
  put(els.panel,
    h("div", { class: "panel-head" }, h("h3", {}, icon("briefcase"), "Services"), h("p", {}, "Used on the Services page, the homepage list and Google. Order matters.")),
    h("div", { class: "panel-body" }, box,
      h("button", { class: "btn accent", style: "width:100%;justify-content:center;margin-top:6px", onclick: () => { list.push({ name: "New service", description: "" }); upd(); draw(); focusField("s" + (list.length - 1)); } }, icon("plus", 16), "Add service")));
  iframe.addEventListener("load", () => {
    if (S.view !== "services") return;
    wireFrame(iframe, () => toast("Edit services in the list on the right."), (target) => {
      const name = target.closest(".qodef-e-title-holder, li")?.textContent.trim();
      const i = list.findIndex((s) => s.name.trim() === name);
      if (i >= 0) focusField("s" + i);
    });
    S.frameDoc.head.append(Object.assign(S.frameDoc.createElement("style"), { textContent: '[data-collection="services-accordion"] .qodef-e-content{display:block!important}' }));
    refresh();
    loading.remove();
  });
  start();
}

// ---- "listing card" fields on original project / article pages
function listingCardSection() {
  if (S.view !== "page" || !isItemPage(S.page)) return null;
  const kind = S.page.url.startsWith("/portfolio/") ? "projects" : "news";
  const it = items(kind).find((x) => itemUrl(kind, x) === S.page.url);
  if (!it) return null;
  const upd = () => { changed(); refreshFrameLists(S.frameDoc); };
  return [
    h("div", { class: "section-title" }, icon("layers", 15), kind === "projects" ? "Card on the Projects page" : "Card on the News page"),
    textField(it, "title", "Name on the card", { onChange: () => { upd(); renderNav(); } }),
    kind === "projects" ? textField(it, "excerpt", "Short description", { long: true, rows: 2, onChange: upd }) : null,
    photoField(it, "cover", "Card photo", upd),
  ];
}

// ---------------------------------------------------------------- publish
function discardAll() {
  if (!confirm("Discard all unpublished changes?")) return;
  for (const f of dirtyFiles()) S.docs[f].data = JSON.parse(S.docs[f].original);
  S.uploads.clear(); S.media = S.media.filter((m) => !m.pending);
  store.del(DRAFT_KEY);
  changed();
  if (S.view === "page") openPage(S.page.slug); else go(S.view);
  toast("Changes discarded.");
}

async function publish() {
  const files = dirtyFiles();
  if (!files.length) return;
  // only upload photos that are actually used
  const used = new Set();
  const scan = (o) => { for (const v of Object.values(o || {})) { if (v && typeof v === "object") scan(v); else if (S.uploads.has(v)) used.add(v); } };
  for (const f of files) scan(S.docs[f].data);
  const photos = [...used].map((u) => ({ path: S.uploads.get(u).path, content: S.uploads.get(u).base64, encoding: "base64" }));
  const content = files.map((f) => ({ path: f, content: JSON.stringify(S.docs[f].data, null, 2) + "\n", encoding: "utf-8" }));
  // Netlify limits request size, so send photos in batches and the text last.
  const batches = [];
  let cur = [], size = 0;
  for (const p of photos) { if (cur.length && size + p.content.length > 4.5e6) { batches.push(cur); cur = []; size = 0; } cur.push(p); size += p.content.length; }
  if (cur.length) batches.push(cur);
  batches.push(content);
  const names = files.map((f) => f === BUSINESS_FILE ? "business details" : f === S.globalFile ? "header/footer" : f === COLL.projects ? "projects" : f === COLL.news ? "news" : f === COLL.services ? "services" : S.pages.find((p) => p.file === f)?.label || f);

  S.publishing = true; renderTop();
  try {
    let commit;
    for (let i = 0; i < batches.length; i++) {
      const last = i === batches.length - 1;
      ({ commit } = await api("/api/save", { method: "POST", body: JSON.stringify({ message: last ? `Edit ${names.join(", ")} via dashboard` : "Add photos via dashboard", files: batches[i] }) }));
    }
    for (const f of files) S.docs[f].original = JSON.stringify(S.docs[f].data);
    store.del(DRAFT_KEY);
    S.waitingFor = commit;
    toast("Saved! Your changes will be live in about a minute.", "ok", 6000);
    waitForLive(commit);
  } catch (e) {
    if (e.message !== "signed out") toast("Couldn't publish: " + e.message, "bad", 8000);
  } finally {
    S.publishing = false; renderTop(); renderNavDots(); if (S.view === "page") renderPanel();
  }
}

async function waitForLive(commit) {
  const started = Date.now();
  while (S.waitingFor === commit && Date.now() - started < 6 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 6000));
    const b = await fetch("/admin/build.json", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (b.commit === commit) {
      S.waitingFor = null; renderTop();
      toast(h("span", {}, "Your changes are live. ", h("a", { href: S.view === "page" ? S.page.url : "/", target: "_blank", style: "color:#fff;text-decoration:underline" }, "View site")), "ok", 8000);
      return;
    }
  }
  if (S.waitingFor === commit) { S.waitingFor = null; renderTop(); toast("Still publishing. Check the site again in a few minutes."); }
}

async function logout() {
  if (countChanges() && !confirm("You have unpublished changes. They stay saved on this computer. Sign out anyway?")) return;
  await fetch("/api/login", { method: "DELETE", credentials: "same-origin" });
  location.reload();
}

window.addEventListener("beforeunload", (e) => { if (countChanges() || S.publishing) { e.preventDefault(); e.returnValue = ""; } });

// ---------------------------------------------------------------- start
async function start() {
  try {
    await loadSchema();
    await Promise.all([S.globalFile, COLL.projects, COLL.news, COLL.services].map((f) => loadDoc(f)));
    renderShell();
    go("home");
    if (store.get(DRAFT_KEY)) {
      for (const f of Object.keys(store.get(DRAFT_KEY))) await loadDoc(f).catch(() => {});
      changed();
      toast("Your unpublished changes from last time were restored.");
    }
  } catch (e) {
    if (e.message !== "signed out") { put(document.getElementById("app"), h("div", { class: "login" }, h("div", { class: "login-card" }, h("h1", {}, "Something went wrong"), h("p", {}, e.message)))); }
  }
}

(async () => {
  const s = await fetch("/api/login", { credentials: "same-origin" }).then((r) => r.json()).catch(() => ({}));
  if (s.signedIn) start(); else renderLogin();
})();
