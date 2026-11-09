# Elevar Architects Group – website

Static copy of the former WordPress site (Hostinger), hosted on **Netlify**, with an
visual editor at **`/admin`** for changing text, photos and SEO.

## How it works

```
site/       exported HTML, CSS, JS and images (the design; don't edit by hand)
content/    the editable text/images, one JSON file per page + global.json (header/footer)
admin/      the /admin dashboard and its generated field list (config.yml)
netlify/    serverless functions behind the dashboard (login, read, publish)
scripts/    export-static.mjs, extract-content.mjs, build.mjs
```

When someone publishes in `/admin`, the dashboard commits the change to `content/` in GitHub.
Netlify sees the commit, runs `npm run build` (copies `site/` to `dist/` and puts the
new text/images in), and publishes `dist/`. Changes are live in about a minute.

## The dashboard (/admin)

Open `/admin`, sign in with the password, pick a page, click any text, photo or
number on it, edit it in the side panel, then press **Publish**. Changes are live
in about a minute (the dashboard tells you when).

- Photo library: all site photos; uploads are resized in the browser and stored in
  `site/wp-content/uploads/cms/`.
- Google title/description per page, with a live Google preview.
- Business details: company info, services and social links used for Google.

How it works: `netlify/functions/` (login, content, save) read and commit
`content/*.json` and photos through the GitHub API. The GitHub token never
reaches the browser; the browser only gets a signed, HttpOnly session cookie.
The build writes click-to-edit copies of each page to `dist/admin/edit/`, the
photo list to `dist/admin/media.json` and the deployed commit to `dist/admin/build.json`.

Netlify → Site configuration → Environment variables (then redeploy):

- `ADMIN_PASSWORD`: the dashboard password. Changing it signs everyone out.
- `GITHUB_TOKEN`: fine-grained token for this repo only, **Contents: Read and write**.

## What can be edited in /admin

- Every heading, paragraph, button label, list item and counter number on each page
- Every image (`<img>`) and its alt text; new uploads go to `site/wp-content/uploads/cms/`
- Page title and description (SEO) per page
- Header and footer text/images, once for all pages

Not editable from /admin: layout, colours, section background images set in CSS,
link URLs, and adding new pages or news posts. Those need a code change in `site/`.

## Contact form

The contact form is a Netlify Form named `contact-3`. Submissions appear in
Netlify → Site → Forms. Add an email notification there (Forms → Form notifications)
so messages reach your inbox. After submitting, visitors land on `/thank-you/`.

## Local commands

```bash
npm install
npm run build      # build dist/
npm run serve      # preview dist/ at http://localhost:3000
```

Re-exporting from WordPress (only while the old site is still online) overwrites
`site/`, and `npm run extract` overwrites `content/` and `admin/config.yml`, so any
edits made in `/admin` would be lost. Normally you never need to run these again.
