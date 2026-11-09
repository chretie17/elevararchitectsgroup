// Minimal GitHub client: read a file, and commit several files in one commit.
const API = () => process.env.GITHUB_API_URL || "https://api.github.com";
const REPO = () => process.env.GITHUB_REPO || "chretie17/elevararchitectsgroup";
const BRANCH = () => process.env.GITHUB_BRANCH || "main";

async function gh(path, { method = "GET", body, accept } = {}) {
  const res = await fetch(`${API()}/repos/${REPO()}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: accept || "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "elevar-dashboard",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function readFile(path) {
  const res = await gh(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(BRANCH())}`, {
    accept: "application/vnd.github.raw+json",
  });
  return res.text();
}

// files: [{ path, content, encoding: "utf-8" | "base64" }]
export async function commitFiles(files, message) {
  const tree = [];
  for (const f of files) {
    const blob = await (await gh("/git/blobs", { method: "POST", body: { content: f.content, encoding: f.encoding || "utf-8" } })).json();
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  for (let attempt = 0; ; attempt++) {
    const ref = await (await gh(`/git/ref/heads/${BRANCH()}`)).json();
    const parent = ref.object.sha;
    const parentCommit = await (await gh(`/git/commits/${parent}`)).json();
    const newTree = await (await gh("/git/trees", { method: "POST", body: { base_tree: parentCommit.tree.sha, tree } })).json();
    const commit = await (await gh("/git/commits", { method: "POST", body: { message, tree: newTree.sha, parents: [parent] } })).json();
    try {
      await gh(`/git/refs/heads/${BRANCH()}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
      return commit.sha;
    } catch (e) {
      if (e.status !== 422 || attempt >= 2) throw e; // someone else pushed meanwhile: retry on top
    }
  }
}
