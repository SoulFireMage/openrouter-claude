# OpenRouter Chat: notes for Claude sessions

A personal chat client for OpenRouter that runs entirely in the browser and is
installed on an Android phone from GitHub Pages, served on the owner's custom
domain: https://starship-whisperer.com/openrouter-claude/. The old
`soulfiremage.github.io` address redirects there, and browser storage is per
address, so data saved under the old one does not follow. The owner works from a
phone, so every change ships as a PR that is merged to `main`, which deploys.

## Architecture

- No backend and no build step. Static files served by GitHub Pages.
- `index.html` holds all CSS, markup and JavaScript in one IIFE.
- `sw.js` precaches the shell and `vendor/` files. **Bump `CACHE_NAME` on every
  change to a shell file**, or installed copies keep the old version, **and
  set `APP_VERSION` in `index.html` to the same number**: it is shown in
  settings, and a test fails if the two differ.
- `vendor/` holds marked, DOMPurify and KaTeX (fonts as woff2), vendored so
  nothing loads from a CDN. The service worker's file list must match it.
- `vendor/skapi.js` is the Skapi SDK (`skapi-js` from npm, `dist/skapi.js`,
  unmodified). It is injected by `loadSkapi()` only when someone signs in or
  was signed in, so signed-out use never loads it.
- The OpenRouter key is typed into settings and lives only in `localStorage`.
  The repo is public: never commit a key, never put one in code, tests or
  commit messages.
- Intelligence scores come from Artificial Analysis, whose API refuses
  browser requests. `.github/workflows/aa-scores.yml` runs
  `.github/scripts/fetch-aa-scores.mjs` daily with the repository secret
  `AA_API_KEY`, refetches when the published data is over 7 days old, and
  commits `data/aa-models.json`, which the app reads from its own site.
  Don't reintroduce a browser-side key.

- Image models use OpenRouter's image API (`POST /images`, catalogue at
  `/images/models`), not chat. Generated images are stored as Blobs in
  IndexedDB (database `orc`, store `images`, indexed by `chatId`); chat
  messages hold only `images: [{ id, type }]` references, because
  localStorage is far too small for image data.

- Accounts and sync are optional and local-first ("Account and sync" block
  in `index.html`). `localStorage` stays the source of truth on a device;
  sync only merges. Accounts live in the owner's shared Skapi project
  (project id in `SKAPI_PROJECT_ID`, public by design, same one as
  `rhetoric-salle`). Each chat is one record in the private table
  `orc_chats` with unique id `orc:<user id>:<chat id>`; a deleted chat
  becomes a `{ deleted: true }` record. Sync pulls, merges, then pushes.
  The merge rules are listed at the top of that block: keep them
  loss-free. Profiles travel as one record (unique id ending `~profiles`,
  `kind: "profiles"`): newest copy of each profile wins, deletes are listed
  in `gone`. Images are never uploaded.
- The OpenRouter key is uploaded only if the user ticks the box, and then
  only as AES-GCM ciphertext (record ending `~key`, `kind: "key"`). The
  encrypting key is derived from the account password at sign-in
  (`cloudDeriveKek`) and kept on the device as `orc_cloud_kek`; the
  password itself is never stored. Never upload the key in the clear, and
  never log it or the derived key. `keyPrint` in `orc_cloud_state` decides
  direction: a key changed here goes up, a key changed elsewhere comes
  down only if this device's is unchanged since the last sync.

## Things that bite

- Inside the IIFE, `history` is the current chat's message array. Use
  `window.history` for the browser's history API.
- Never put generated image data into the DOM as markup. Images are shown
  through `<img src="blob:...">` only, so a returned SVG's scripts can't run.
- Model output is rendered with marked plus KaTeX and then sanitised with
  DOMPurify; raw HTML from the model is escaped to text. Keep it that way.
- Chat history entries are only `user` and `assistant`. Errors are transient
  UI and must never be stored or sent to the API.
- Android's share sheet refuses `application/json` files with "Permission
  denied" even when `canShare()` says yes. Shared files go out as
  `text/plain` `.txt`; a single chat is shared as text.
- A backgrounded phone kills the streaming connection. `sendMessage`
  reconnects only when no text had arrived, and otherwise keeps the partial
  reply marked `interrupted`. Don't auto-retry anything that may already
  have been billed in full (images).
- The Skapi SDK keeps its session in `localStorage` under
  `CognitoIdentityServiceProvider.*` keys. Never clear `localStorage`
  wholesale.
- Skapi facts checked against the live service: listing a private table
  returns only the caller's records; `record_id` accepts a unique id;
  creating a taken unique id fails with "already taken"; updating a missing
  record fails with "User has no access to update this record"; record data
  over 32 KB is stored as a file transparently; `$updated` works as an index
  on private tables. The fake in `tests/e2e.mjs` copies these.
- Skapi has no conditional write, so two devices can upload over each
  other. Each chat upload carries a version vector (`vv`: uploads per
  device); a pulled copy that shows fewer uploads from this device than it
  has made is merged as a conflict, never taken as a plain update. A chat
  whose account copy could not be merged in (storage full, busy) must not
  be uploaded in that sync.
- An interrupted reply can be continued or regenerated (`redoLast`). The
  cut-off reply is taken off `history` in memory only and stays in storage
  until its replacement is filed, so it must be put back on every path
  that files nothing (`restorePrior`). The continue note is API input
  only: never store or show it.
- A regenerated assistant entry carries `versions` (snapshots, the shown
  one included) and `v` (index shown). Its ordinary fields always mirror
  `versions[v]`, so the API, export, share and sync only ever see the
  shown version's text.
- A service worker cannot update through a redirect. A browser that
  installed the app from the old github.io address stays on that old copy
  until its site data is cleared; nothing deployed can reach it.
- Import never sets a default profile (a file must not change behaviour of
  new chats); only sync carries the default star.
- Artificial Analysis ids do not map to OpenRouter ids. Models are joined by
  creator alias plus name tokens (`joinAA` and helpers). Keep matching
  conservative: a wrong intelligence score is worse than a missing one.

## localStorage keys

`orc_api_key`, `orc_model`, `orc_system_prompt`, `orc_filters`,
`orc_chats` (index) and `orc_chat_<id>` (messages), `orc_current_chat`,
`orc_profiles`, `orc_active_profile`, `orc_image_models` (cached image
catalogue), `orc_image_opts` (per-model image options), `orc_cloud_user`
(`{ id, email, expired? }` while signed in) and `orc_cloud_state` (sync
bookkeeping: cursor, per-chat synced stamps, pending deletes, last synced
profiles and deleted profile ids, key-sync flags and fingerprint) and
`orc_cloud_kek` (the password-derived encrypting key, removed on sign-out).
Legacy keys cleaned up on load:
`orc_history` (migrated into a chat) and `orc_aa_key`, `orc_aa_cache`,
`orc_aa_attempt` (from the abandoned per-device Artificial Analysis key).

## Testing

`tests/e2e.mjs` is a Playwright suite that mocks OpenRouter and Artificial
Analysis inside the page. Serve the repo on port 8765 and run it; see
`tests/README.md`. Add checks for every behaviour change and keep it green.
The cloud sandbox cannot reach openrouter.ai or artificialanalysis.ai, so
the mocks are the only verification available there. Skapi is replaced by
an in-page fake (`fakeSkapi`), enabled per check with the `__skapiFake`
flag; `docs.skapi.com` and the Skapi API were reachable from the sandbox in
November 2026, so SDK behaviour can be probed for real with a throwaway
account when it matters. The scores Action can
be triggered and its logs read through the GitHub tools; it logs the
response's field names (never the key) to make shape changes easy to spot.

## Workflow

- Develop on the session's feature branch, restarted from `origin/main` for
  each new piece of work, then open a PR and merge it (merge commit).
- Copilot reviews PRs automatically. Treat its findings as bug reports:
  verify, fix what is real, and reply on the thread when declining one.
- Keep README.md's feature list current.
