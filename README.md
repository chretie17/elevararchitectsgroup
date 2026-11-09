# Elevar Architects Group – website

Static copy of the former WordPress site (Hostinger), hosted on **Netlify**, with an
editor at **`/admin`** (Decap CMS) for changing text and images.

## How it works

```
site/       exported HTML, CSS, JS and images (the design; don't edit by hand)
content/    the editable text/images, one JSON file per page + global.json (header/footer)
admin/      the /admin editor (Decap CMS) and its generated field list (config.yml)
scripts/    export-static.mjs, extract-content.mjs, build.mjs
```

When someone saves in `/admin`, Decap commits the change to `content/` in GitHub.
Netlify sees the commit, runs `npm run build` (copies `site/` to `dist/` and puts the
new text/images in), and publishes `dist/`. Changes are live in about a minute.

## Signing in to /admin

`/admin` uses a password instead of GitHub accounts. Click **Login with GitHub**;
a small window asks for the password (handled by `netlify/functions/auth.mjs`).

Set these in Netlify → Site configuration → Environment variables, then redeploy:

- `ADMIN_PASSWORD`: the password you type at /admin (use a long one)
- `GITHUB_TOKEN`: a fine-grained GitHub token for this repo only, with
  **Contents: Read and write**. The CMS uses it to save your edits.

To change the password, edit `ADMIN_PASSWORD` and redeploy.

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
