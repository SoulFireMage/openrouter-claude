# Tests

One end-to-end suite, `e2e.mjs`, drives the real app in headless Chromium.
OpenRouter and Artificial Analysis are replaced by in-page mocks, so it needs
no API keys and no network access beyond the local server.

## Run

From the repository root, serve the app:

```
python3 -m http.server 8765
```

In another shell:

```
cd tests
npm install
npx playwright install chromium   # skip if a Chromium is already available
npm test
```

Environment variables:

- `BASE_URL`: where the app is served. Defaults to `http://localhost:8765`.
- `CHROMIUM_PATH`: use a specific Chromium binary instead of Playwright's.

The run prints a table of named checks and exits non-zero if any fail. Add a
check for every behaviour change; the mocks at the top of the file show the
shapes of the OpenRouter and Artificial Analysis responses the app expects.
