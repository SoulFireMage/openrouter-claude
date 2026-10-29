# Handoff: OpenRouter Chat

Written 2026-10-29 at the end of a long build session, so a fresh session can
pick up without the old conversation. Read `CLAUDE.md` first: it holds the
architecture, the pitfalls and the workflow rules. This file holds the state
of play and what comes next.

## Starting a new session

Paste something like this as the first message:

> Read CLAUDE.md and HANDOFF.md in SoulFireMage/openrouter-claude, then help
> me design and build a multi-agent chat mode. I'll describe what I want.

## What the app is today

A browser-only chat client for OpenRouter, installed on an Android phone from
GitHub Pages: https://soulfiremage.github.io/openrouter-claude/. No backend,
no build step. Everything is in `index.html` (about 4,000 lines, one IIFE).

Features, roughly in the order they were built:

- Streaming chat with Stop and Retry; full markdown and LaTeX rendering
  (marked, KaTeX, DOMPurify, all vendored in `vendor/`).
- Multiple chats stored on the device; chats drawer (top left).
- Model picker with provider, capability, intelligence and budget filters.
- Profiles: named snapshots of model, system prompt and filters; a default
  profile applies to new chats.
- Export and import of all chats and profiles as JSON; Export this chat and
  Share this chat in settings for one conversation. Images are not exported.
- Copy buttons on every turn and every code block.
- Reply footer: served model and provider, tokens, cost, wait, tokens/sec.
- Every chat request sends the chat id as OpenRouter's `session_id` (PR #19,
  from another session, for grouping traces in logs).
- Intelligence scores from Artificial Analysis, published weekly by a GitHub
  Action into `data/aa-models.json`; model browser page (bar-chart icon in
  the header) with tiers and briefings.
- Image generation through OpenRouter's image API, with per-model options,
  refine-last-image, a full-screen viewer, and images kept in IndexedDB.

## State of `main`

- Service worker cache: `orc-shell-v22`. Bump it on every shell change.
- Tests: `tests/e2e.mjs`, about 200 named checks, all passing at handoff.
  Run as described in `tests/README.md` (serve the repo on port 8765; the
  suite mocks OpenRouter and Artificial Analysis in the page).
- Scheduled workflow `.github/workflows/aa-scores.yml` runs daily and needs
  the repository secret `AA_API_KEY`, which is set.
- Every Copilot review thread up to PR #21 is answered and resolved.

## Environment notes for cloud sessions

- The sandbox could reach `openrouter.ai` by October 2026 (model lists and
  docs), but there is no OpenRouter key, so real chat or image requests can't
  be made. Verify against the live catalogue and docs, then mock requests.
- `artificialanalysis.ai` and `github.io` were blocked; read Pages
  deployments and Action logs through the GitHub tools instead.
- In a fresh container, Playwright must be reinstalled outside the repo, for
  example in the scratchpad with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i
  playwright`, and launched with `executablePath: /opt/pw-browsers/chromium`.
- `pkill -f` with a pattern that appears in your own command line kills the
  shell; stop the local server by PID instead.

## Working conventions that served well

- Owner works from a phone: every change is a PR merged straight to `main`.
- Restart the feature branch from `origin/main` for each piece of work.
- Before building against an external API, check the live docs or catalogue
  where reachable. Earlier rounds learned the hard way, through Artificial
  Analysis's browser block and OpenRouter's separate image API.
- Copilot reviews every PR, often after the merge. Read its threads, fix
  what is real with a test, decline with evidence otherwise, then resolve.
- For tests that guard against a specific mistake, prove the test can fail:
  break the code in a scratch copy and run the suite against it.

## Known gaps and caveats

- A real image generation has not been verified end to end from this side,
  because there's no key. The owner's phone is the real test.
- Images live only in IndexedDB on the device; exports carry references, not
  image data.
- localStorage holds about 5 MB. Very long histories can fill it; the app
  warns, and exports now include the open chat's unsaved messages.
- Ideas parked in README "Ideas for later": streamed image previews, images
  in exports, attaching your own photos, chat rename, Markdown export.

## Next: multi-agent chat mode

The owner will specify it in the new session. Points worth settling early,
from how the code is built:

- **Where it plugs in.** `sendMessage` already branches: image models go to
  `generateImage`, everything else streams from `/chat/completions`. A
  multi-agent mode would be a third branch, and `fileReply` already files a
  reply into the chat it belongs to.
- **Message shape.** Assistant entries hold `model`, `usage`, `timing` and
  optionally `images`. Several agents in one chat need each reply to record
  which agent spoke, and the UI needs to show it.
- **What each agent sees.** `buildApiMessages` turns history into one
  model's view. With several agents, decide whether each sees the others'
  turns as assistant turns, as user turns labelled by name, or as a
  transcript, and whether each gets its own system prompt.
- **Profiles as agents.** A profile already bundles a model and a system
  prompt, which is most of an agent definition.
- **Turn-taking and cost.** Round-robin, an orchestrator, or user-directed
  turns; a cap on rounds; Stop must halt the whole exchange; and each round
  multiplies cost, so the footer or a running total should show it.
- **Storage and export.** Keep agent definitions with the chat so exports
  and imports carry them.
