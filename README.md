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
3. Branch: `main`, folder: `/ (root)`. Save.
4. GitHub gives you a URL like `https://soulfiremage.github.io/openrouter-claude/`.
5. Open that URL in Chrome on Android → menu → **Add to Home screen**.

## Status

Skeleton only — UI, settings, streaming chat logic, and local storage are in
place, but it hasn't been tested against a live key yet. Once you've reviewed
the code, add a key in the running app (not in the repo) and try a message.

## Ideas for later

- Per-conversation history instead of one running thread.
- Markdown/code-block rendering in assistant messages.
- Per-message cost display (OpenRouter returns usage/cost in the response).
