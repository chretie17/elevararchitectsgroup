// One-time: turn the project grid, news list and services lists into
// collections (content/projects.json, news.json, services.json) that the
// dashboard can add to, reorder and delete from.
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";
import { SITE, CONTENT, ADMIN, PARSE_OPTS } from "./lib.mjs";

const read = async (f) => JSON.parse(await fs.readFile(f, "utf8"));
const flat = (o, r = {}) => { for (const [k, v] of Object.entries(o || {})) v && typeof v === "object" && !Array.isArray(v) ? flat(v, r) : (r[k] = v); return r; };
const mdText = (s) => String(s || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_]/g, "").replace(/\\(.)/g, "$1").trim();
const removed = {}; // page slug -> Set(keys)

async function tag(rel, slug, marks) {
  const file = path.join(SITE, ...rel.split("/"));
  const root = parse(await fs.readFile(file, "utf8"), PARSE_OPTS);
  const out = [];
  for (const { find, collection, group } of marks) {
    const el = find(root);
    if (!el) throw new Error(`${rel}: container for ${collection} not found`);
    el.setAttribute("data-collection", collection);
    if (group) el.setAttribute("data-group", group);
    const keys = el.querySelectorAll("[data-cms]").map((e) => e.getAttribute("data-cms"));
    for (const e of el.querySelectorAll("[data-cms]")) { e.removeAttribute("data-cms"); e.removeAttribute("data-cms-h"); }
    (removed[slug] ||= new Set()); keys.forEach((k) => removed[slug].add(k));
    out.push({ el, keys });
  }
  await fs.writeFile(file, root.toString());
  return { root, out };
}
const byKey = (root, k) => root.querySelector(`[data-cms="${k}"]`);
const ulOf = (k) => (r) => byKey(r, k)?.closest("ul");

// ---- read current values before tagging
const pv = async (slug) => flat(await read(path.join(CONTENT, "pages", `${slug}.json`)));
const projectsPage = await pv("projects");
const newsPage = await pv("news");
const servicesPage = await pv("services");

// projects: three cards on /projects/ (i2,m3,t4 | i5,m6,t7 | i8,m9,t10)
const projRoot = parse(await fs.readFile(path.join(SITE, "projects", "index.html"), "utf8"), PARSE_OPTS);
const projects = [["i2", "m3", "t4"], ["i5", "m6", "t7"], ["i8", "m9", "t10"]].map(([i, m, t]) => {
  const href = byKey(projRoot, m).querySelector("a")?.getAttribute("href") || byKey(projRoot, i).closest("a").getAttribute("href");
  return { slug: href.replace(/^\/portfolio\/|\/$/g, ""), kind: "original", title: mdText(projectsPage[m]), excerpt: projectsPage[t], cover: projectsPage[i] };
});

// news: one card on /news/
const newsRoot = parse(await fs.readFile(path.join(SITE, "news", "index.html"), "utf8"), PARSE_OPTS);
const art = newsRoot.querySelector("article");
const news = [{
  slug: art.querySelector(".entry-title a").getAttribute("href").replace(/^\/|\/$/g, ""),
  kind: "original",
  title: mdText(newsPage.m3),
  cover: newsPage.i2,
  date: art.querySelector("time.entry-date").getAttribute("datetime").slice(0, 10),
}];

// services: accordion title/description pairs on /services/
const pairs = [["t17", "t18"], ["t19", "t20"], ["t21", "t22"], ["t24", "t25"], ["t26", "t27"], ["t28", "t29"], ["t32", "t33"], ["t34", "t35"], ["t36", "t37"]];
const services = pairs.map(([n, d]) => ({ name: servicesPage[n].trim(), description: servicesPage[d].trim() }));

// ---- tag containers and drop their per-item fields
await tag("projects/index.html", "projects", [{ find: (r) => r.querySelector(".portfolio-grid"), collection: "projects" }]);
await tag("news/index.html", "news", [{ find: (r) => r.querySelector("article").parentNode, collection: "news" }]);
await tag("services/index.html", "services", [
  { find: ulOf("t6"), collection: "services-list", group: "overview" },
  { find: ulOf("t11"), collection: "services-list", group: "overview" },
  ...["t17", "t24", "t32"].map((k) => ({ find: (r) => byKey(r, k).closest(".qodef-qi-accordion"), collection: "services-accordion" })),
]);
await tag("index.html", "homepage", [
  { find: ulOf("t16"), collection: "services-list", group: "home" },
  { find: ulOf("t19"), collection: "services-list", group: "home" },
  { find: ulOf("t21"), collection: "services-list", group: "home" },
]);

await fs.writeFile(path.join(CONTENT, "projects.json"), JSON.stringify({ items: projects }, null, 2) + "\n");
await fs.writeFile(path.join(CONTENT, "news.json"), JSON.stringify({ items: news }, null, 2) + "\n");
await fs.writeFile(path.join(CONTENT, "services.json"), JSON.stringify({ items: services }, null, 2) + "\n");

// ---- remove the dropped fields from page content and the dashboard field list
for (const [slug, keys] of Object.entries(removed)) {
  const f = path.join(CONTENT, "pages", `${slug}.json`);
  const d = await read(f);
  for (const [sec, vals] of Object.entries(d)) {
    if (sec === "seo" || !vals || typeof vals !== "object") continue;
    for (const k of Object.keys(vals)) if (keys.has(k.replace(/_alt$/, ""))) delete vals[k];
    if (!Object.keys(vals).length) delete d[sec];
  }
  await fs.writeFile(f, JSON.stringify(d, null, 2) + "\n");
}
const cfgFile = path.join(ADMIN, "config.yml");
const txt = await fs.readFile(cfgFile, "utf8");
const cfg = JSON.parse(txt.slice(txt.indexOf("{")));
for (const f of cfg.collections.find((c) => c.name === "pages").files) {
  const keys = removed[f.name];
  if (!keys) continue;
  f.fields = f.fields.filter((sec) => {
    if (sec.name === "seo") return true;
    sec.fields = sec.fields.filter((x) => !keys.has(x.name.replace(/_alt$/, "")));
    return sec.fields.length;
  });
}
await fs.writeFile(cfgFile, txt.slice(0, txt.indexOf("{")) + JSON.stringify(cfg, null, 2) + "\n");

console.log("projects:", projects.map((p) => p.title));
console.log("news:", news.map((p) => p.title));
console.log("services:", services.map((s) => s.name));
console.log("fields removed:", Object.fromEntries(Object.entries(removed).map(([k, v]) => [k, v.size])));
