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
- Model picker with provider, capability (vision, reasoning, tools),
  intelligence and budget filters plus text search, grouped by provider, with
  context window and per-million-token pricing shown for the selected model.
- Optional intelligence scores from Artificial Analysis (see below): each
  model in the picker shows its index, and a **Browse & compare models** page
  sorts and filters the whole catalogue by intelligence, coding, maths, price,
  speed, context or age, with a briefing card per model.
- Per-reply footer showing the model and provider that served it, token
  counts and cost as reported by OpenRouter, time to first token, and
  generation speed in tokens per second.
- Copy: every turn has a copy icon that copies the message's raw markdown,
  and every code block has a header with its language and a Copy button.
- Full markdown (headings, lists, tables, quotes, links, code) and LaTeX
  maths (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) in replies, rendered with
  marked and KaTeX and sanitised with DOMPurify. Raw HTML in model output is
  shown as text, never rendered.
- On a phone, Enter inserts a newline and the button sends. With a physical
  keyboard, Enter sends and Shift+Enter inserts a newline.

## Model intelligence scores

Hundreds of models sound fluent in conversation; far fewer hold up on
multi-step reasoning or agentic work. To help tell them apart, the app can
show [Artificial Analysis](https://artificialanalysis.ai/) scores.

- Add a free Artificial Analysis API key in settings. Like the OpenRouter key,
  it is stored only on the device and never committed or exported.
- Scores are fetched once, cached on the device, and refetched when the cache
  is more than 7 days old. After a failed fetch the app waits an hour before
  trying again on its own; **Refresh scores** in the model browser forces it.
- Artificial Analysis ids share nothing with OpenRouter's, so models are
  matched by creator plus the words in the model name, in any order. Matching
  is deliberately strict because a wrong score is worse than none. A near
  match is used only when unambiguous and is marked with "~". Unmatched
  models simply show no score; settings reports how many matched.
- Where Artificial Analysis benchmarks a separate thinking or reasoning
  variant, its score is shown alongside, e.g. "AI index 44 (59 reasoning)".
- The picker's intelligence filter uses 10-point bands built from the data.
  The browser's tiers (Light, Capable, Strong, Frontier) are percentiles of
  every model Artificial Analysis measures, so they stay meaningful if the
  index is rescaled.
- Data is attributed to Artificial Analysis in the model browser, as their
  free API requires.

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

The end-to-end suite in `tests/` drives the app in headless Chromium with both
APIs mocked, so it needs no keys. See `tests/README.md`.

## Deploying to GitHub Pages (so it's reachable from your phone)

1. Repo **Settings → Pages**.
2. Under "Build and deployment", set Source to **Deploy from a branch**.
3. Pick the branch the app lives on (`main` once merged), folder: `/ (root)`. Save.
4. GitHub gives you a URL like `https://soulfiremage.github.io/openrouter-claude/`.
5. Open that URL in Chrome on Android → menu → **Add to Home screen**.

After changing `index.html`, `manifest.json` or `icon.svg`, bump `CACHE_NAME`
in `sw.js` so installed copies pick up the new shell on their next launch.

## Status

In daily use against the live OpenRouter API. Every feature is covered by the
end-to-end suite in `tests/`, which mocks OpenRouter and Artificial Analysis.
The Artificial Analysis integration was built against its documented response
shape and has not yet been run against the live API from a browser.

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
