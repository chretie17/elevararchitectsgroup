// One-time step after `npm run export`:
//   - tags every editable text/image element in site/**/*.html with data-cms="<key>"
//   - writes the current values to content/pages/*.json and content/global.json
//   - generates admin/config.yml so the CMS shows a field for each one
//
// WARNING: re-running this regenerates content/ from site/, so edits made in
// the CMS are lost unless they were built into site/ first. Normally you run it
// once and then only edit through /admin.

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";
import TurndownService from "turndown";
import { SITE, CONTENT, ADMIN, pageSlug, isEditablePage, listHtml, hash, PARSE_OPTS } from "./lib.mjs";

const turndown = new TurndownService({ emDelimiter: "*", strongDelimiter: "**" });

const SKIP_TAGS = new Set(["script", "style", "noscript", "svg", "form", "select", "textarea", "iframe", "template", "head", "video", "audio", "canvas"]);
const INLINE = new Set(["strong", "b", "em", "i", "br", "a", "u"]);
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "span", "button", "figcaption", "blockquote", "td", "th", "dt", "dd", "div", "small", "strong", "em", "label", "cite", "address"]);
const SKIP_CLASS = /\b(screen-reader-text|ff_screen_reader_title|sr-only)\b/;

const isEl = (n) => n.nodeType === 1;
const isText = (n) => n.nodeType === 3;

function inlineOnly(el) {
  return el.childNodes.every((c) => isText(c) || (isEl(c) && INLINE.has(c.rawTagName?.toLowerCase()) && !c.getAttribute("class") && inlineOnly(c)));
}

function textKind(el) {
  const tag = el.rawTagName?.toLowerCase();
  if (!TEXT_TAGS.has(tag)) return null;
  if (SKIP_CLASS.test(el.getAttribute("class") || "")) return null;
  if (!el.text.trim()) return null;
  if (!inlineOnly(el)) return null;
  if (tag === "div" && !el.childNodes.some((c) => isText(c) && c.text.trim())) return null;
  const hasTags = el.childNodes.some((c) => isEl(c) && c.rawTagName.toLowerCase() !== "br");
  return hasTags ? "m" : "t";
}

function valueOf(el, kind) {
  if (kind === "t") {
    // text with optional <br>: each <br> becomes a newline, other whitespace collapses
    return el.childNodes.map((c) => (isEl(c) ? "\u0001" : c.text)).join("").replace(/\s+/g, " ").replace(/ ?\u0001 ?/g, "\n").trim();
  }
  return turndown.turndown(el.innerHTML).trim();
}

const short = (s, n = 60) => {
  s = String(s).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};

function labelFor(el, kind, value) {
  if (kind === "n") {
    const title = el.querySelector(".qodef-m-title, h1, h2, h3, h4, h5, h6")?.text;
    return `Counter number${title ? ` (${short(title, 40)})` : ""}: ${value}`;
  }
  const tag = el.rawTagName.toLowerCase();
  const what = /^h\d$/.test(tag) ? `Heading ${tag.toUpperCase()}` : tag === "a" || /button/.test(el.getAttribute("class") || "") ? "Link text" : kind === "i" ? "Image" : "Text";
  return `${what}: “${short(value, 50)}”`;
}

function sectionOf(el) {
  // nearest top-level Elementor container/section, used to group fields
  let cur = el, top = null;
  while (cur && cur.parentNode) {
    const t = cur.getAttribute?.("data-element_type");
    if (t === "container" || t === "section") top = cur;
    if (cur.getAttribute?.("data-elementor-type")) break;
    cur = cur.parentNode;
  }
  return top;
}

function zoneOf(el) {
  for (let cur = el; cur; cur = cur.parentNode) {
    const tag = cur.rawTagName?.toLowerCase();
    if (tag === "header" && cur.getAttribute("id") === "masthead") return "header";
    if (tag === "footer") return "footer";
  }
  return null;
}

function domPath(el, stopAt) {
  const parts = [];
  for (let cur = el; cur && cur !== stopAt && cur.parentNode; cur = cur.parentNode) {
    const sibs = cur.parentNode.childNodes.filter((c) => isEl(c) && c.rawTagName === cur.rawTagName);
    parts.push(`${cur.rawTagName}${sibs.indexOf(cur)}`);
  }
  return parts.reverse().join("/");
}

const pages = [];
const global = { header: {}, footer: {} };
const globalFields = { header: [], footer: [] };

for (const file of await listHtml(SITE)) {
  const rel = path.relative(SITE, file).split(path.sep).join("/");
  if (rel.startsWith("admin/")) continue;
  // archives, 404, thank-you: only their header/footer are tagged (shared fields)
  const editable = isEditablePage(rel);
  const raw = await fs.readFile(file, "utf8");
  if (raw.includes("data-cms=")) throw new Error(`${rel} is already tagged; restore site/ (npm run export) before extracting again.`);
  const root = parse(raw, PARSE_OPTS);
  const body = root.querySelector("body");
  if (!body) continue;

  const slug = pageSlug(rel);
  const content = { seo: {} };
  const sections = new Map(); // key -> {label, fields: []}
  let n = 0;

  const title = root.querySelector("title")?.text.trim() || slug;
  const desc = root.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  content.seo = { title, description: desc };

  const add = (el, kind, value, extra) => {
    const zone = zoneOf(el);
    if (!zone && !editable) return;
    let key;
    if (zone) {
      const zoneRoot = (() => { for (let c = el; c; c = c.parentNode) if (["header", "footer"].includes(c.rawTagName?.toLowerCase())) return c; })();
      key = `g${kind}_${hash(zone + domPath(el, zoneRoot) + value).slice(0, 10)}`;
      if (!(key in global[zone])) {
        global[zone][key] = value;
        globalFields[zone].push(fieldDef(key, kind, labelFor(el, kind, value)));
        if (kind === "i") { global[zone][key + "_alt"] = extra; globalFields[zone].push({ label: "↳ Alt text", name: key + "_alt", widget: "string", required: false }); }
      }
    } else {
      key = `${kind}${++n}`;
      const sec = sectionOf(el);
      const skey = sec ? `s_${sec.getAttribute("data-id")}` : "content";
      if (!sections.has(skey)) {
        const heading = sec?.querySelector("h1,h2,h3,h4,h5,h6")?.text;
        sections.set(skey, { label: sec ? `Section ${sections.size + 1}${heading ? ": " + short(heading, 40) : ""}` : "Page content", fields: [], values: {} });
      }
      const s = sections.get(skey);
      s.values[key] = value;
      s.fields.push(fieldDef(key, kind, labelFor(el, kind, value)));
      if (kind === "i") { s.values[key + "_alt"] = extra; s.fields.push({ label: "↳ Alt text", name: key + "_alt", widget: "string", required: false }); }
    }
    el.setAttribute("data-cms", key);
    el.setAttribute("data-cms-h", hash(value));
  };

  (function walk(node) {
    for (const c of node.childNodes) {
      if (!isEl(c)) continue;
      const tag = c.rawTagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === "img") {
        const src = c.getAttribute("src");
        if (src && !src.startsWith("data:")) add(c, "i", src, c.getAttribute("alt") || "");
        continue;
      }
      // animated counters keep their number in an attribute
      if (c.hasAttribute("data-end-digit")) add(c, "n", c.getAttribute("data-end-digit"));
      const kind = textKind(c);
      if (kind) { add(c, kind, valueOf(c, kind)); continue; }
      walk(c);
    }
  })(body);

  await fs.writeFile(file, root.toString());
  if (!editable) continue;
  for (const [skey, s] of sections) content[skey] = s.values;
  await fs.mkdir(path.join(CONTENT, "pages"), { recursive: true });
  await fs.writeFile(path.join(CONTENT, "pages", `${slug}.json`), JSON.stringify(content, null, 2) + "\n");
  pages.push({ slug, rel, title, sections });
  console.log(`${rel}: ${n} fields`);
}

await fs.writeFile(path.join(CONTENT, "global.json"), JSON.stringify(global, null, 2) + "\n");

function fieldDef(name, kind, label) {
  if (kind === "i") return { label, name, widget: "image", required: false, choose_url: true };
  if (kind === "m") return { label, name, widget: "markdown", required: false, buttons: ["bold", "italic", "link"], editor_components: [], modes: ["rich_text", "raw"], minimal: true };
  return { label, name, widget: "text", required: false };
}

// ---- generate the CMS config ----------------------------------------------

const pageLabel = (p) => (p.slug === "homepage" ? "Home page" : p.title.replace(/\s*[-–|]\s*Elevar Architects Group Ltd\s*$/i, ""));
const order = (p) => (p.slug === "homepage" ? 0 : p.rel.startsWith("portfolio/") ? 2 : 1);
pages.sort((a, b) => order(a) - order(b) || a.rel.localeCompare(b.rel));

const config = {
  backend: { name: "github", repo: "chretie17/elevararchitectsgroup", branch: "main" },
  site_url: "https://elevararchitectsgroup.com",
  display_url: "https://elevararchitectsgroup.com",
  logo_url: "/wp-content/uploads/2025/12/elevar_1-05-scaled-e1764947847136-1075x500.png",
  media_folder: "site/wp-content/uploads/cms",
  public_folder: "/wp-content/uploads/cms",
  collections: [
    {
      name: "pages", label: "Pages", editor: { preview: false },
      files: pages.map((p) => ({
        name: p.slug, label: pageLabel(p), url: "/" + p.rel.replace(/index\.html$/, ""), file: `content/pages/${p.slug}.json`, format: "json",
        fields: [
          { label: "Search engine (SEO)", name: "seo", widget: "object", collapsed: true, fields: [
            { label: "Page title", name: "title", widget: "string" },
            { label: "Description", name: "description", widget: "text", required: false },
          ] },
          ...[...p.sections].map(([skey, s]) => ({ label: s.label, name: skey, widget: "object", collapsed: true, fields: s.fields })),
        ],
      })),
    },
    {
      name: "global", label: "Header & footer", editor: { preview: false },
      files: [{
        name: "global", label: "Header & footer (all pages)", file: "content/global.json", format: "json",
        fields: [
          { label: "Header", name: "header", widget: "object", collapsed: true, fields: globalFields.header },
          { label: "Footer", name: "footer", widget: "object", collapsed: true, fields: globalFields.footer },
        ],
      }],
    },
  ],
};

await fs.mkdir(ADMIN, { recursive: true });
await fs.writeFile(path.join(ADMIN, "config.yml"),
  "# Generated by scripts/extract-content.mjs (JSON is valid YAML).\n" +
  "# Set backend.repo to your GitHub repo, e.g. \"yourname/elevararchitectsgroup\".\n" +
  JSON.stringify(config, null, 2) + "\n");
console.log(`\n${pages.length} pages, ${globalFields.header.length + globalFields.footer.length} header/footer fields. Config: admin/config.yml`);
