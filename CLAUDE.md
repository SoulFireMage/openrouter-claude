# OpenRouter Chat: notes for Claude sessions

A personal chat client for OpenRouter that runs entirely in the browser and is
installed on an Android phone from GitHub Pages
(https://soulfiremage.github.io/openrouter-claude/). The owner works from a
phone, so every change ships as a PR that is merged to `main`, which deploys.

## Architecture

- No backend and no build step. Static files served by GitHub Pages.
- `index.html` holds all CSS, markup and JavaScript in one IIFE.
- `sw.js` precaches the shell and `vendor/` files. **Bump `CACHE_NAME` on every
  change to a shell file**, or installed copies keep the old version.
- `vendor/` holds marked, DOMPurify and KaTeX (fonts as woff2), vendored so
  nothing loads from a CDN. The service worker's file list must match it.
- API keys (OpenRouter, Artificial Analysis) are typed into settings and live
  only in `localStorage`. The repo is public: never commit a key, never put
  one in code, tests or commit messages.

## Things that bite

- Inside the IIFE, `history` is the current chat's message array. Use
  `window.history` for the browser's history API.
- Model output is rendered with marked plus KaTeX and then sanitised with
  DOMPurify; raw HTML from the model is escaped to text. Keep it that way.
- Chat history entries are only `user` and `assistant`. Errors are transient
  UI and must never be stored or sent to the API.
- Artificial Analysis ids do not map to OpenRouter ids. Models are joined by
  creator alias plus name tokens (`joinAA` and helpers). Keep matching
  conservative: a wrong intelligence score is worse than a missing one.

## localStorage keys

`orc_api_key`, `orc_model`, `orc_system_prompt`, `orc_filters`,
`orc_chats` (index) and `orc_chat_<id>` (messages), `orc_current_chat`,
`orc_profiles`, `orc_active_profile`, `orc_aa_key`, `orc_aa_cache`,
`orc_aa_attempt`. The legacy single-thread key `orc_history` is migrated
into a chat on load.

## Testing

`tests/e2e.mjs` is a Playwright suite that mocks OpenRouter and Artificial
Analysis inside the page. Serve the repo on port 8765 and run it; see
`tests/README.md`. Add checks for every behaviour change and keep it green.
The cloud sandbox cannot reach openrouter.ai or artificialanalysis.ai, so
the mocks are the only verification available there.

## Workflow

- Develop on the session's feature branch, restarted from `origin/main` for
  each new piece of work, then open a PR and merge it (merge commit).
- Copilot reviews PRs automatically. Treat its findings as bug reports:
  verify, fix what is real, and reply on the thread when declining one.
- Keep README.md's feature list current.
