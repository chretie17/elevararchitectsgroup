// GET /api/content?path=content/pages/about.json -> { content } (latest from GitHub)
import { isSignedIn, json } from "../lib/session.mjs";
import { readFile } from "../lib/github.mjs";

export const config = { path: "/api/content" };

export default async (req) => {
  if (!isSignedIn(req)) return json({ error: "Please sign in." }, 401);
  const path = new URL(req.url).searchParams.get("path") || "";
  if (!/^content\/[\w-]+(\/[\w-]+)*\.json$/.test(path)) return json({ error: "Invalid path" }, 400);
  try {
    return json({ content: await readFile(path) });
  } catch (e) {
    return json({ error: e.status === 404 ? "File not found" : "Could not read from GitHub. Check GITHUB_TOKEN." }, e.status === 404 ? 404 : 502);
  }
};
