import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE = path.join(ROOT, "site");
export const CONTENT = path.join(ROOT, "content");
export const DIST = path.join(ROOT, "dist");
export const ADMIN = path.join(ROOT, "admin");

export const PARSE_OPTS = {
  comment: true,
  blockTextElements: { script: true, noscript: true, style: true, pre: true },
};

export const hash = (s) => crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 10);

// "index.html" -> "homepage", "about/index.html" -> "about",
// "portfolio/kwigira/index.html" -> "portfolio-kwigira"
export function pageSlug(rel) {
  const p = rel.replace(/(^|\/)index\.html$/, "");
  return p ? p.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() : "homepage";
}

// Real pages only: no archives (author/category/tag/date), 404, thank-you or admin.
export function isEditablePage(rel) {
  if (!/(^|\/)index\.html$/.test(rel)) return false;
  return !/^(admin|author|category|tag|page|thank-you|wp-content|wp-includes|\d{4})\//.test(rel);
}

export async function listHtml(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile() && e.name.endsWith(".html")) out.push(path.join(e.parentPath ?? e.path, e.name));
  }
  return out;
}
