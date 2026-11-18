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
  `AA_API_KEY`, refetches when the published data is over 20 hours old, and
  commits `data/aa-models.json`, which the app reads from its own site.
  Don't reintroduce a browser-side key. The source is the free
  `/api/v2/language/models/free` (OpenAPI spec at `/api/v2/openapi`): it is
  paginated (`pagination.has_more`, `?page=`), and reading only page 1 once
  silently dropped most models. Its creators have an id and name but no
  slug, so the app matches creators by name (aliases in
  `AA_CREATOR_ALIAS`). Speed comes from `performance_v3` (means); the older
  `performance` medians go null on 10 December 2026. The Action writes
  speed as `output_tokens_per_second` / `time_to_first_token_seconds`; the
  app still reads the older `median_*` names.

- Image models use OpenRouter's image API (`POST /images`, catalogue at
  `/images/models`), not chat. Generated images are stored as Blobs in
  IndexedDB (database `orc`, store `images`, indexed by `chatId`); chat
  messages hold only `images: [{ id, type }]` references, because
  localStorage is far too small for image data.

- Chat messages live in IndexedDB: database `orc_chats`, store `chats`,
  one `{ id, json }` record per chat ("Where chats are kept" in
  `index.html`). Every chat is also held in memory (`chatMirror`), so
  `loadChat` and `saveChat` stay synchronous; each save is written through
  as it is made. The chat index, settings and sync bookkeeping stay in
  `localStorage`. Init waits for `openChatStore()` before anything about
  chats is shown, sent or synced. Always go through `loadChat`, `saveChat`
  and `dropChat`.
- Accounts and sync are optional and local-first ("Account and sync" block
  in `index.html`). The device's own storage stays the source of truth on it;
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

- `orc_store` = `idb` records that a device has moved its chats to
  IndexedDB. After that, a database that won't open sets
  `chatStoreBlocked` and is reported as an error: never fall back to
  `localStorage` there, it would show every chat as gone and sync would
  act on that. Only a device that never moved (no IndexedDB at all) keeps
  chats under `orc_chat_<id>` in `localStorage`.
- A chat found under `orc_chat_<id>` after the move (a tab still on an
  older version wrote it) is merged by `moveOldChats` on the next launch:
  longer wins, diverged copies are both kept. An old copy is removed only
  after the database has confirmed the write that replaces it.
- `saveChat` returns before the database has committed. Cleanup that
  can't be undone goes through `whenChatSaved`. A refused write is listed
  in `orc_unsaved`; if the app closes before a retry succeeds, the next
  launch sets `fullAt` to 0 so sync re-reads the whole account.
- `chatReady()` is false until the chat store has opened and for good if
  it can't be. Every entry point that changes a chat, the chat list or
  the account checks it.
- IndexedDB reports "full" only after a write was accepted. `saveChat`
  therefore refuses up front when the browser's estimate says it won't
  fit, and while an earlier write is still being refused; callers rely on
  its `false` to leave an account copy alone.
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
- Skapi (its SDK, before sending) refuses record data over 2 MB: "Data
  should not exceed 2MB". A chat whose messages are over `CLOUD_ZIP_OVER`
  is uploaded with them gzipped and base64 encoded in `z` (count in `zn`)
  instead of `messages`; `cloudUnpack` restores `messages` on every record
  read (`cloudSync`'s list, `cloudGet`). A record that can't be unpacked is
  never applied and never uploaded over (`locked` in `orc_cloud_state`).
  Versions before 29 ignore a record without `messages`. Read account
  records through `cloudGet`, not `sk.getRecords` directly.
- An incremental pull only sees records changed since `cursor`, so a
  record it misses once is never seen again. `cloudSync` therefore turns
  itself into a full pull when `fullAt` in `orc_cloud_state` is over a day
  old. Keep that, and keep full pulls loss-free.
- A pending delete carries the account revision this device last saw
  (`delStamp`, taken from `rev`, which `cloudSaw` keeps; `synced` is this
  device's own stamp and is not the same thing). If the account's record
  has a different `updated`, another device changed the chat since: the
  delete is dropped and the chat restored. The check is made both on the
  pull and, because the listing can lag, on the record itself in
  `cloudPushDelete`. Never let a delete overwrite a version the deleting
  device had not seen.
- `cloudSendChat` (the mark beside a chat in the list) sends one chat on
  demand: fetch the account's record, mark this device's copy as changed,
  merge with `cloudApply`, push, read back. It shares the `cloudSyncing`
  lock with `cloudSync`. If the merge is refused ("full", "later") the
  "changed" marker must be put back as it was, or a later sync would
  upload over a copy it never merged.
- An interrupted reply can be continued or regenerated (`redoLast`). The
  cut-off reply is taken off `history` in memory only and stays in storage
  until its replacement is filed, so it must be put back on every path
  that files nothing (`restorePrior`). The continue note is API input
  only: never store or show it.
- Regenerate (any last reply, any model kind), Edit (last user message)
  and Remove (any turn) live in the "Changing what was said" block.
  `refreshTailActions` puts the last-exchange buttons on by matching
  `el._entry` to `history`, so a message element must be built from the
  very object that is in `history`. An edit only touches the chat when the
  edited message is sent (`applyEdit`). Removing the only message deletes
  the chat. Pictures only the removed messages showed are dropped by
  `pruneWhenSaved`: which ones is settled at the moment of removal, and
  they are deleted only once that save has committed.
- In `cloudApply`, a chat changed here while the account still holds the
  revision this device last saw (`rev`) is a plain update and goes up as
  it is. Without that rule a chat made shorter here counts as "the shorter
  side" and the removal is undone, and a regenerated reply becomes a
  conflict copy.
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
`orc_chats` (index), `orc_store` (`idb` once chats are in IndexedDB),
`orc_unsaved` (ids of chats whose last write the database refused) and
`orc_chat_<id>` (messages, only before that move or where there is no
IndexedDB), `orc_current_chat`,
`orc_profiles`, `orc_active_profile`, `orc_image_models` (cached image
catalogue), `orc_image_opts` (per-model image options), `orc_cloud_user`
(`{ id, email, expired? }` while signed in) and `orc_cloud_state` (sync
bookkeeping: cursor, time of the last full pull, per-chat synced stamps,
the account revision last seen per chat, pending deletes and the
revisions they were aimed at, last synced
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
the mocks are the only verification available there. Chats are read, planted and
wiped in the checks through `window.__chatGet`, `__chatSet`, `__chatDump`
and `__chatWipe` (top of `fakeFetch`); `putDevice` plants a device's chats
in the old `localStorage` place, so every device swap also runs the move.
Skapi is replaced by
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
