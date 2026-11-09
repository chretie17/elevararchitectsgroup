// Netlify build: copy site/ to dist/ and apply the CMS content from content/.
// Only fields whose value changed since extraction are rewritten, so untouched
// pages stay byte-for-byte identical to the exported WordPress HTML.

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";
import { marked } from "marked";
import { SITE, CONTENT, DIST, ADMIN, PARSE_OPTS, hash, pageSlug, isEditablePage, listHtml } from "./lib.mjs";

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
let pagesChanged = 0, fieldsChanged = 0;

for (const file of await listHtml(DIST)) {
  const raw = await fs.readFile(file, "utf8");
  if (!raw.includes("data-cms=")) continue;
  const rel = path.relative(DIST, file).split(path.sep).join("/");
  const page = isEditablePage(rel) ? await readJson(path.join(CONTENT, "pages", `${pageSlug(rel)}.json`)) : {};
  const { seo = {}, ...rest } = page;
  const vals = { ...globalVals, ...flatten(rest) };

  const root = parse(raw, PARSE_OPTS);
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
    for (const m of root.querySelectorAll('meta[property="og:description"], meta[name="twitter:description"]')) m.setAttribute("content", seo.description);
    changed++;
  }

  let out = changed ? root.toString() : raw;
  out = out.replace(/\sdata-cms(?:-h)?="[^"]*"/g, "");
  await fs.writeFile(file, out);
  if (changed) { pagesChanged++; fieldsChanged += changed; }
}

console.log(`Built dist/: ${fieldsChanged} edited field(s) applied across ${pagesChanged} page(s).`);
