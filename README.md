# OpenRouter Chat (PWA)

A minimal chat client for [OpenRouter](https://openrouter.ai), built to run entirely
in the browser and install to an Android home screen. No backend, no build step —
just static files.

## How it works

- Everything is client-side: `index.html` holds the UI and logic, `sw.js` is a
  service worker that caches the app shell for offline loading, `manifest.json`
  makes it installable.
- Your OpenRouter API key is entered into the settings panel and saved with
  `localStorage`, on your device only. It is sent **directly from your browser
  to `openrouter.ai`** over HTTPS with every chat request — it never passes
  through any other server, because there is no other server.
- If `localStorage` isn't available for some reason (private browsing, a
  restrictive embedded browser, etc.), the app falls back to holding your key
  and history in memory for that session instead of breaking.

## Features

- Multiple chats, each a separate context, stored on the device. The list
  drawer (top left) starts a new chat, switches between chats, or deletes
  one. A new chat is only saved once you send something. Switching chats
  stops any reply still streaming; the partial reply is kept in its own chat.
- Streaming replies with a **Stop** button (partial text is kept).
- **Retry** on any failed request, including one left dangling by a reload.
- Export and import: the chats drawer writes every chat and profile to one
  JSON file (never the API key), with a Share button on phones that support
  it. Import merges: unchanged chats are skipped, changed ones are added as
  copies, nothing already on the device is overwritten.
- Profiles: named snapshots of model, system prompt and picker filters,
  stored on the device. Each profile records which of those it sets, so a
  prompt-only persona can be applied without changing the model. The starred
  default profile is applied to every new chat. Suggested names come from the
  current chat's title, falling back to the model's name.
- Model picker with provider, capability (vision, reasoning, tools) and budget
  filters plus text search, grouped by provider, with context window and
  per-million-token pricing shown for the selected model.
- Per-reply footer showing model, token counts and cost, as reported by
  OpenRouter.
- Copy: every turn has a copy icon that copies the message's raw markdown,
  and every code block has a header with its language and a Copy button.
- Full markdown (headings, lists, tables, quotes, links, code) and LaTeX
  maths (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) in replies, rendered with
  marked and KaTeX and sanitised with DOMPurify. Raw HTML in model output is
  shown as text, never rendered.
- On a phone, Enter inserts a newline and the button sends. With a physical
  keyboard, Enter sends and Shift+Enter inserts a newline.

## Security notes (read before adding a real key)

- **This repo is public.** Never commit your API key into any file — not in
  `index.html`, not in a `.env`, not in a commit message. The only place it
  should ever be typed is the settings field in the running app. `.gitignore`
  has some guardrails against obvious slip-ups, but it's not a substitute for
  not doing it.
- If a key is ever accidentally committed, treat it as burned: revoke it at
  [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) and issue
  a new one. Rewriting git history doesn't undo exposure on a public repo.
- OpenRouter lets you set a spending limit per key — worth doing for a key
  that lives on a phone.

## Local testing

There's no build step. Any static file server works, e.g.:

```
npx serve .
```

Then open the printed URL in a browser.

## Deploying to GitHub Pages (so it's reachable from your phone)

1. Repo **Settings → Pages**.
2. Under "Build and deployment", set Source to **Deploy from a branch**.
3. Pick the branch the app lives on (`main` once merged), folder: `/ (root)`. Save.
4. GitHub gives you a URL like `https://soulfiremage.github.io/openrouter-claude/`.
5. Open that URL in Chrome on Android → menu → **Add to Home screen**.

After changing `index.html`, `manifest.json` or `icon.svg`, bump `CACHE_NAME`
in `sw.js` so installed copies pick up the new shell on their next launch.

## Status

Reviewed and tested end-to-end in headless Chromium against a mocked
OpenRouter API (streaming, markdown, errors, retry, stop, reload persistence,
HTML escaping). Not yet exercised against a live key: add one in the running
app (never in the repo) and try a message.

## Third-party libraries

Vendored under `vendor/` so the app works offline and depends on no CDN:
[marked](https://github.com/markedjs/marked) (MIT),
[DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0 / MPL-2.0),
[KaTeX](https://katex.org) (MIT). Licences are alongside the files.

## Ideas for later

- Export a single chat as Markdown for sharing.
- Rename chats.
- Cap or summarise old history so long threads don't grow the per-request cost
  without bound.
- PNG icons (192/512 px) if Chrome declines the full install prompt with SVG only.
