// POST /api/save { message, files: [{ path, content, encoding }] } -> { commit }
// Commits edited content and uploaded photos to GitHub; Netlify then redeploys.
import { isSignedIn, json, isJsonRequest } from "../lib/session.mjs";
import { commitFiles } from "../lib/github.mjs";

export const config = { path: "/api/save" };

const CONTENT = /^content\/[\w-]+(\/[\w-]+)*\.json$/;
const PHOTO = /^site\/wp-content\/uploads\/cms\/[\w.-]+\.(jpe?g|png|webp|gif)$/i;
const MAX_PHOTO = 4.5 * 1024 * 1024;

export default async (req) => {
  if (!isSignedIn(req)) return json({ error: "Please sign in." }, 401);
  if (req.method !== "POST" || !isJsonRequest(req)) return json({ error: "Not allowed" }, 405);

  const { message, files } = await req.json().catch(() => ({}));
  if (!Array.isArray(files) || !files.length || files.length > 30) return json({ error: "Nothing to save." }, 400);

  for (const f of files) {
    if (CONTENT.test(f.path)) {
      if (f.encoding && f.encoding !== "utf-8") return json({ error: `Bad encoding for ${f.path}` }, 400);
      try { JSON.parse(f.content); } catch { return json({ error: `${f.path} is not valid JSON` }, 400); }
    } else if (PHOTO.test(f.path)) {
      if (f.encoding !== "base64" || typeof f.content !== "string") return json({ error: `Bad photo data for ${f.path}` }, 400);
      if (f.content.length * 0.75 > MAX_PHOTO) return json({ error: `${f.path} is too large` }, 413);
    } else {
      return json({ error: `Not allowed to change ${f.path}` }, 403);
    }
  }

  try {
    const commit = await commitFiles(files, String(message || "Edit via dashboard").slice(0, 200));
    return json({ commit });
  } catch (e) {
    console.error(e);
    return json({ error: "Could not save to GitHub. Check that GITHUB_TOKEN can write to the repository." }, 502);
  }
};
