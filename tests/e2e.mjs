import { chromium } from "playwright";
// End-to-end checks for OpenRouter Chat. See tests/README.md for how to run.
// OpenRouter and Artificial Analysis are mocked inside the page, so no keys
// or network access are needed. Prints a PASS/FAIL table and exits non-zero
// on any failure.
const BASE = (process.env.BASE_URL || "http://localhost:8765").replace(/\/$/, "");

const fakeFetch = () => {
  window.__requests = [];
  window.__scenarios = [];
  const realFetch = window.fetch.bind(window);
  const sse = (events, delayMs = 0, signal, failAtEnd) => new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      let aborted = false;
      if (signal) signal.addEventListener("abort", () => { aborted = true; try { ctrl.error(new DOMException("The user aborted a request.", "AbortError")); } catch (e) {} });
      for (const e of events) {
        if (delayMs) await new Promise(r => setTimeout(r, delayMs));
        if (aborted) return;
        ctrl.enqueue(enc.encode(typeof e === "string" ? e : "data: " + JSON.stringify(e) + "\n\n"));
      }
      if (aborted) return;
      // A connection that dies part-way, as when a phone backgrounds the app.
      // (Erroring at once would discard the chunks still queued, so wait for them to be read.)
      if (failAtEnd) { await new Promise(r => setTimeout(r, 80)); ctrl.error(new TypeError("network error")); return; }
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    }
  });
  window.__aaRequests = [];
  window.__aaFixture = { status: 200, data: [
    { id: "aa-1", name: "Claude 4 Sonnet", slug: "claude-4-sonnet", release_date: "2025-05-22",
      model_creator: { id: "c-anth", name: "Anthropic", slug: "anthropic" },
      evaluations: { artificial_analysis_intelligence_index: 44.4, artificial_analysis_coding_index: 40.1, artificial_analysis_math_index: 60.2, gpqa: 0.683, hle: 0.04, mmlu_pro: 0.837 },
      pricing: { price_1m_blended_3_to_1: 6, price_1m_input_tokens: 3, price_1m_output_tokens: 15 },
      median_output_tokens_per_second: 55.2, median_time_to_first_token_seconds: 1.3 },
    { id: "aa-2", name: "Claude 4 Sonnet Thinking", slug: "claude-4-sonnet-thinking", release_date: "2025-05-22",
      model_creator: { id: "c-anth", name: "Anthropic", slug: "anthropic" },
      evaluations: { artificial_analysis_intelligence_index: 58.7 } },
    { id: "aa-3", name: "GPT-4o mini", slug: "gpt-4o-mini", model_creator: { name: "OpenAI", slug: "openai" },
      evaluations: { artificial_analysis_intelligence_index: 21.2 } },
    { id: "aa-4", name: "GPT-4o (Nov '24)", slug: "gpt-4o", model_creator: { name: "OpenAI", slug: "openai" },
      evaluations: { artificial_analysis_intelligence_index: 29.5 } },
    { id: "aa-5", name: "Gemma 3 4B Instruct", slug: "gemma-3-4b", model_creator: { name: "Google", slug: "google" },
      evaluations: { artificial_analysis_intelligence_index: 12.1 } },
    { id: "aa-6", name: "Llama 3 Instruct 8B", slug: "llama-3-instruct-8b", model_creator: { name: "Meta", slug: "meta" },
      evaluations: { artificial_analysis_intelligence_index: 9.8 } },
    { id: "aa-7", name: "Command A", slug: "command-a", model_creator: { name: "Cohere", slug: "cohere" },
      evaluations: { artificial_analysis_intelligence_index: 13.4 } },
    { id: "aa-8", name: "Impostor Sonnet", slug: "claude-4-sonnet", model_creator: { name: "Someone Else", slug: "someone-else" },
      evaluations: { artificial_analysis_intelligence_index: 99 } },
    // Newer entries that used to collide with the base names above: "+" was
    // stripped and "non-reasoning" was dropped. They carry no index, so the
    // tier percentiles are unchanged, but a wrong match would lose the score.
    { id: "aa-9", name: "Claude 4 Sonnet (Non-reasoning)", slug: "claude-4-sonnet-non-reasoning", release_date: "2025-06-01",
      model_creator: { name: "Anthropic", slug: "anthropic" }, evaluations: { artificial_analysis_coding_index: 1 } },
    { id: "aa-10", name: "GPT-4o mini+", slug: "gpt-4o-mini-plus", release_date: "2025-06-01",
      model_creator: { name: "OpenAI", slug: "openai" }, evaluations: {} },
    { junk: true }, null
  ] };
  // Every OpenRouter org -> Artificial Analysis creator alias the matcher
  // knows, plus a same-name pair, so a typo in any mapping fails a check.
  window.__aliasPairs = [
    ["allenai", "ai2"], ["stepfun-ai", "stepfun"], ["arcee-ai", "arcee"], ["meituan", "longcat"], ["nex-agi", "nex"],
    ["lgai", "lg"], ["meta-llama", "meta"], ["mistralai", "mistral"], ["x-ai", "xai"], ["qwen", "alibaba"],
    ["moonshotai", "kimi"], ["z-ai", "zai"], ["amazon", "aws"], ["microsoft", "azure"], ["nousresearch", "nous-research"],
    ["ibm-granite", "ibm"], ["bytedance-seed", "bytedance_seed"], ["ai21", "ai21-labs"], ["liquid", "liquidai"],
    ["deepseek", "deepseek"],
    ["mistral-ai", "mistral"], ["qwen", "alibaba-cloud"], ["moonshot-ai", "kimi"], ["z-ai", "zhipu"], ["zhipu-ai", "zai"],
    ["microsoft", "microsoft-azure"], ["liquid", "liquid-ai"], ["deepseek-ai", "deepseek"], ["google", "google-deepmind"],
    ["cohere", "cohereforai"], ["cohere", "cohere-for-ai"], ["meituan-longcat", "longcat"], ["lgai-exaone", "lg"],
    ["lgai", "lg-ai-research"]
  ];
  window.__imgRequests = [];
  window.__tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
  window.__imageModels = [
    { id: "acme/pixel-1", name: "Pixel 1", created: 1790000000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["image"] },
      supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1", "16:9", "auto"] }, quality: { type: "enum", values: ["auto", "low", "high"] },
        n: { type: "range", min: 1, max: 6 }, input_references: { type: "range", min: 0, max: 4 } },
      supports_streaming: false },
    { id: "openai/gpt-image-9", name: "GPT Image 9", created: 1790000001,
      architecture: { input_modalities: ["text"], output_modalities: ["image"] },
      supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1", "3:2"] }, n: { type: "range", min: 1, max: 1 } },
      supports_streaming: true }
  ];
  window.fetch = async (url, opts = {}) => {
    // The scores file the GitHub Action publishes. "404" (not published yet)
    // is the default so earlier checks see an app without scores.
    if (String(url).endsWith("data/aa-models.json")) {
      window.__aaRequests.push(String(url));
      const mode = localStorage.getItem("__aaMode") || "404";
      if (mode === "404") return new Response("Not found", { status: 404 });
      if (mode === "bad") return new Response("{not json", { status: 200 });
      if (mode === "empty") return new Response(JSON.stringify({ fetchedAt: new Date().toISOString(), data: [] }), { status: 200 });
      if (mode === "missing") return new Response(JSON.stringify({ fetchedAt: new Date().toISOString() }), { status: 200 });
      if (mode === "notarray") return new Response(JSON.stringify({ fetchedAt: new Date().toISOString(), data: { models: [] } }), { status: 200 });
      if (mode === "aliases") {
        const data = window.__aliasPairs.map(([, aa], i) => ({ id: "al" + i, name: "Alias Probe " + i, slug: "alias-probe-" + i,
          model_creator: { name: aa, slug: aa }, evaluations: { artificial_analysis_intelligence_index: 10 + i } }));
        data.push({ id: "al99", name: "Alias Probe 99", slug: "alias-probe-99", model_creator: { name: "Someone", slug: "someone" },
          evaluations: { artificial_analysis_intelligence_index: 99 } });
        return new Response(JSON.stringify({ fetchedAt: new Date().toISOString(), data }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ source: "Artificial Analysis", fetchedAt: new Date(Date.now() - 2 * 86400000).toISOString(), data: window.__aaFixture.data }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (!String(url).startsWith("https://openrouter.ai/")) return realFetch(url, opts);

    // OpenRouter's image API. Off unless "__imgMode" is set, so earlier
    // checks see no image models. Modes: on, fail, slow, svg.
    if (String(url).startsWith("https://openrouter.ai/api/v1/images")) {
      const u = String(url);
      const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
      const mode = localStorage.getItem("__imgMode");
      if (u.endsWith("/images/models")) return json({ data: mode ? window.__imageModels : [] });
      if (u.endsWith("/endpoints")) {
        const id = decodeURIComponent(u.split("/images/models/")[1].replace(/\/endpoints$/, ""));
        const prices = { "acme/pixel-1": [0.04], "openai/gpt-image-9": [0.02, 0.08] }[id] || [];
        return json({ id, endpoints: [{ provider_name: "Mock", pricing: prices.map((c) => ({ billable: "output_image", unit: "image", cost_usd: c })) }] });
      }
      const body = JSON.parse(opts.body);
      window.__imgRequests.push(body);
      if (mode === "fail") return json({ error: { message: "Generation failed", code: 502 } }, 502);
      if (mode === "drop") throw new TypeError("Failed to fetch");
      if (mode === "slow") {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, 4000);
          if (opts.signal) opts.signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("The user aborted a request.", "AbortError")); });
        });
      }
      if (mode === "svg") {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><script>window.__svgpwned = 1</script><rect width="4" height="4" fill="blue"/></svg>';
        return json({ data: [{ b64_json: btoa(svg), media_type: "image/svg+xml" }], usage: { cost: 0.01 } });
      }
      const n = body.n || 1;
      return json({ created: 1, data: Array.from({ length: n }, () => ({ b64_json: window.__tinyPng, media_type: "image/png" })),
        usage: { prompt_tokens: 0, completion_tokens: 100, cost: 0.04 * n } });
    }

    if (String(url).endsWith("/models") && localStorage.getItem("__orMode") === "aliases") {
      const data = window.__aliasPairs.map(([org], i) => ({ id: org + "/alias-probe-" + i, name: "Probe" + i + ": Alias Probe " + i,
        pricing: { prompt: "0.000001", completion: "0.000002" } }));
      data.push({ id: "unknownorg/alias-probe-99", name: "Unknown: Alias Probe 99", pricing: { prompt: "0.000001", completion: "0.000002" } });
      return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).endsWith("/models")) {
      return new Response(JSON.stringify({ data: [
        { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o mini", context_length: 128000,
          pricing: { prompt: "0.00000015", completion: "0.0000006" },
          architecture: { modality: "text+image->text", input_modalities: ["text", "image"], output_modalities: ["text"] },
          supported_parameters: ["tools", "temperature"] },
        { id: "anthropic/claude-sonnet-4", name: "Anthropic: Claude Sonnet 4", context_length: 200000,
          pricing: { prompt: "0.000003", completion: "0.000015" },
          architecture: { input_modalities: ["text", "image"] },
          supported_parameters: ["tools", "reasoning", "include_reasoning"] },
        { id: "meta-llama/llama-3-8b:free", name: "Meta: Llama 3 8B (free)", context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { input_modalities: ["text"] },
          supported_parameters: ["temperature"] },
        { id: "google/gemma-3-4b-it", name: "Google: Gemma 3 4B", context_length: 131072,
          pricing: { prompt: "0.00000002", completion: "0.00000004" },
          architecture: { input_modalities: ["text", "image"] },
          supported_parameters: [] },
        { id: "openrouter/auto", name: "Auto Router", pricing: { prompt: "-1", completion: "-1" } },
        { id: "weird/no-fields" }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    window.__requests.push(JSON.parse(opts.body));
    const sc = window.__scenarios.shift() || { kind: "ok", text: "default" };
    // "drop": the request never connects. "hang": it connects to nothing and
    // stays silent until aborted. "drop-mid": it dies after some text.
    if (sc.kind === "drop") throw new TypeError("Failed to fetch");
    if (sc.kind === "hang") {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new DOMException("The user aborted a request.", "AbortError")));
      });
    }
    if (sc.kind === "http") {
      return new Response(JSON.stringify({ error: { message: sc.message, code: sc.status } }), { status: sc.status });
    }
    const words = (sc.text || "").split(/(?<=\s)/);
    const served = sc.servedModel || JSON.parse(opts.body).model;
    const events = words.map(w => ({ model: served, provider: "MockProvider", choices: [{ delta: { content: w } }] }));
    if (sc.kind === "midstream-error") events.push({ error: { message: sc.message } });
    else if (sc.kind !== "drop-mid") events.push({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: words.length, cost: 0.00042 } });
    const body = sse(events, sc.delayMs || 0, opts.signal, sc.kind === "drop-mid");
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  };
};

// A stand-in for the Skapi SDK (vendor/skapi.js), installed only while the
// "__skapiFake" flag is set so that signed-out checks can prove the real one
// is never loaded. Its "server" lives in localStorage under "__skapi_db",
// which survives the device swaps the sync checks do. Error codes, messages
// and response shapes copy what the real service returned when probed.
const fakeSkapi = () => {
  if (!localStorage.getItem("__skapiFake")) return;
  const load = () => JSON.parse(localStorage.getItem("__skapi_db") || '{"users":{},"session":null,"records":[],"clock":0}');
  const save = (db) => localStorage.setItem("__skapi_db", JSON.stringify(db));
  const err = (code, message) => Object.assign(new Error(message), { code });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const tick = (db) => { db.clock = Math.max(Date.now(), (db.clock || 0) + 1); return db.clock; };
  window.__skapiCalls = [];
  window.Skapi = class {
    constructor(id) { window.__skapiProject = id; this.more = {}; }
    async net(name) {
      window.__skapiCalls.push(name);
      await new Promise(r => setTimeout(r, 5));
      if (localStorage.getItem("__skapiDown")) throw new TypeError("Failed to fetch");
    }
    me(db) {
      const u = db.session && db.users[db.session];
      if (!u) throw err("INVALID_REQUEST", "User needs to login.");
      return u;
    }
    async getProfile() {
      await this.net("getProfile");
      const db = load();
      const u = db.session && db.users[db.session];
      return u ? { user_id: u.id, email: u.email, access_group: 1 } : null;
    }
    async login({ email, password }) {
      await this.net("login");
      const db = load();
      const u = db.users[email];
      if (!u || u.password !== password) throw err("INCORRECT_USERNAME_OR_PASSWORD", "Incorrect username or password.");
      db.session = email; save(db);
      return { user_id: u.id, email: u.email, access_group: 1 };
    }
    async signup({ email, password }, opts = {}) {
      await this.net("signup");
      const db = load();
      if (db.users[email]) throw err("EXISTS", "The account already exists.");
      const u = db.users[email] = { id: "user-" + (Object.keys(db.users).length + 1), email, password };
      if (opts.login) db.session = email;
      save(db);
      return opts.login ? { user_id: u.id, email, access_group: 1 } : "SUCCESS: The account has been created.";
    }
    async logout() { await this.net("logout"); const db = load(); db.session = null; save(db); return "SUCCESS: The user has been logged out."; }
    async forgotPassword({ email }) {
      await this.net("forgotPassword");
      const db = load();
      if (!db.users[email]) throw err("NOT_EXISTS", "Username/client id combination not found.");
      db.users[email].code = "246810"; save(db);
      return "SUCCESS: Verification code has been sent.";
    }
    async resetPassword({ email, code, new_password }) {
      await this.net("resetPassword");
      const db = load();
      const u = db.users[email];
      if (!u || String(code) !== u.code) throw err("INVALID_PARAMETER", "Invalid verification code provided, please try again.");
      u.password = new_password; delete u.code; save(db);
      return "SUCCESS: New password has been set.";
    }
    async postRecord(data, cfg) {
      await this.net("postRecord");
      const db = load();
      const me = this.me(db);
      if (cfg.record_id) {
        const r = db.records.find(r => r.record_id === cfg.record_id || r.unique_id === cfg.record_id);
        if (!r || r.user_id !== me.id) throw err("INVALID_REQUEST", "User has no access to update this record.");
        r.data = clone(data); r.updated = tick(db); save(db);
        return clone(r);
      }
      if (cfg.unique_id && db.records.some(r => r.unique_id === cfg.unique_id)) throw err("INVALID_REQUEST", 'Unique ID "' + cfg.unique_id + '" is already taken.');
      const r = { record_id: "rec" + (db.records.length + 1), unique_id: cfg.unique_id, user_id: me.id, table: clone(cfg.table), data: clone(data), updated: tick(db) };
      r.uploaded = r.updated;
      db.records.push(r); save(db);
      return clone(r);
    }
    async getRecords(q, o = {}) {
      await this.net("getRecords");
      const db = load();
      const me = this.me(db);
      if (q.unique_id) {
        const r = db.records.find(r => r.unique_id === q.unique_id && r.user_id === me.id);
        if (!r) throw err("NOT_EXISTS", "Unique ID does not exists.");
        return { list: [clone(r)], endOfList: true, startKey: "end" };
      }
      let list = db.records.filter(r => r.user_id === me.id && r.table.name === q.table.name && r.table.access_group === q.table.access_group);
      if (q.index) {
        if (q.index.name !== "$updated" || q.index.condition !== ">") throw err("INVALID_PARAMETER", "fake: unsupported index query");
        list = list.filter(r => r.updated > q.index.value);
      }
      // Index lag: a record written a moment ago is not listed yet.
      const hide = localStorage.getItem("__skapiLag");
      if (hide) list = list.filter(r => r.data.id !== hide);
      list.sort((a, b) => a.updated - b.updated);
      const key = JSON.stringify(q);
      const limit = Number(localStorage.getItem("__skapiPage")) || o.limit || 50;
      const start = o.fetchMore ? (this.more[key] || 0) : 0;
      const page = list.slice(start, start + limit);
      this.more[key] = start + page.length;
      return { list: clone(page), endOfList: start + page.length >= list.length };
    }
  };
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  .catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }));
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
await ctx.addInitScript(fakeFetch);
await ctx.addInitScript(fakeSkapi);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("dialog", d => d.accept());
const curChat = () => page.evaluate(() => JSON.parse(localStorage.getItem("orc_chat_" + localStorage.getItem("orc_current_chat"))));
const chatIndex = () => page.evaluate(() => JSON.parse(localStorage.getItem("orc_chats") || "[]"));

const results = {};
const check = (name, cond, detail) => { results[name] = cond ? "PASS" : "FAIL" + (detail ? " " + detail : ""); };
const assistantTexts = () => page.$$eval(".msg.assistant", els => els.map(e => e.innerHTML));

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.waitForTimeout(800);
check("sw active", (await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && r.active ? "active" : "none"; })) === "active");
check("composer disabled initially", await page.$eval("#composer", e => e.disabled));

// Settings: key -> models load -> filter -> pick -> save
await page.click("#open-settings");
await page.fill("#api-key", "sk-or-v1-test");
await page.dispatchEvent("#api-key", "change");
await page.waitForFunction(() => document.querySelectorAll("#model-select option").length >= 7);
const optionLabels = await page.$$eval("#model-select option", os => os.map(o => o.textContent));
check("placeholder first, then provider-sorted", optionLabels[0] === "Choose a model…" && optionLabels[1].startsWith("Anthropic"), JSON.stringify(optionLabels));
const groups = await page.$$eval("#model-select optgroup", gs => gs.map(g => g.label));
check("grouped by provider incl. fallbacks", JSON.stringify(groups) === JSON.stringify(["Anthropic","Google","Meta","OpenAI","openrouter","weird"]), JSON.stringify(groups));
const providerOpts = await page.$$eval("#filter-provider option", os => os.map(o => o.textContent));
check("provider dropdown with counts", providerOpts.includes("Google (1)") && providerOpts[0] === "Any provider", JSON.stringify(providerOpts));
const vals = async () => page.$$eval("#model-select option", os => os.map(o => o.value).filter(Boolean));
await page.fill("#model-filter", ":free");
check("text filter", JSON.stringify(await vals()) === JSON.stringify(["meta-llama/llama-3-8b:free"]), JSON.stringify(await vals()));
await page.fill("#model-filter", "");
await page.selectOption("#filter-capability", "reasoning");
check("capability: reasoning", JSON.stringify(await vals()) === JSON.stringify(["anthropic/claude-sonnet-4"]), JSON.stringify(await vals()));
await page.selectOption("#filter-capability", "vision");
check("capability: vision incl. modality-string fallback", (await vals()).length === 3 && (await vals()).includes("openai/gpt-4o-mini"), JSON.stringify(await vals()));
await page.selectOption("#filter-capability", "");
await page.selectOption("#filter-budget", "free");
check("budget: free", JSON.stringify(await vals()) === JSON.stringify(["meta-llama/llama-3-8b:free"]), JSON.stringify(await vals()));
await page.selectOption("#filter-budget", "low");
check("budget: under $1 excludes unknown price", (await vals()).length === 3 && !(await vals()).includes("openrouter/auto") && !(await vals()).includes("anthropic/claude-sonnet-4"), JSON.stringify(await vals()));
await page.selectOption("#filter-budget", "high");
check("budget: over $10", JSON.stringify(await vals()) === JSON.stringify(["anthropic/claude-sonnet-4"]), JSON.stringify(await vals()));
await page.selectOption("#filter-budget", "");
await page.selectOption("#filter-provider", "Google");
check("provider filter, no optgroups", JSON.stringify(await vals()) === JSON.stringify(["google/gemma-3-4b-it"]) && (await page.$$("#model-select optgroup")).length === 0, JSON.stringify(await vals()));
check("match count hint", (await page.textContent("#model-refresh-hint")) === "1 of 6 models match.", await page.textContent("#model-refresh-hint"));
await page.selectOption("#filter-provider", "Anthropic");
await page.selectOption("#model-select", "anthropic/claude-sonnet-4");
check("info line", (await page.textContent("#model-info")) === "200k context · $3.00 in / $15.00 out per 1M tokens · vision · reasoning · tools", await page.textContent("#model-info"));
await page.fill("#system-prompt", "Be terse.");
await page.click("#save-settings");
check("composer enabled after save", !(await page.$eval("#composer", e => e.disabled)));
check("header shows model", (await page.textContent("#current-model-label")) === "anthropic/claude-sonnet-4");

// 1. Happy path with markdown + usage
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "Hello **world** and `x`.\n```js\nconsole.log(1);\n```\nDone <b>not bold</b>" }));
await page.fill("#composer", "hi there");
await page.click("#send-btn");
await page.waitForSelector(".msg.assistant .meta");
let html = (await assistantTexts())[0];
check("markdown bold", html.includes("<strong>world</strong>"), html);
check("markdown inline code", html.includes("<code>x</code>"));
check("markdown fence with language class", /<pre><code class="language-js">console\.log\(1\);\n?<\/code><\/pre>/.test(html), html);
check("raw html shown as text", html.includes("&lt;b&gt;not bold&lt;/b&gt;") && !html.includes("<b>"), html);
check("libraries loaded", await page.evaluate(() => !!(window.marked && window.DOMPurify && window.katex)));
check("meta shows served model via provider, tokens, cost", html.includes("anthropic/claude-sonnet-4 via MockProvider") && !html.includes("requested") && html.includes("tokens") && html.includes("$0.0004"), html);
let req = await page.evaluate(() => window.__requests[0]);
check("request has system + usage + stream", req.messages[0].role === "system" && req.messages[0].content === "Be terse." && req.usage.include === true && req.stream === true, JSON.stringify(req));
check("request carries the chat id as session_id", req.session_id === (await page.evaluate(() => localStorage.getItem("orc_current_chat"))) && !!req.session_id, JSON.stringify(req));

// 1b. Rich markdown + LaTeX + injection attempts
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: [
  "# Spinors",
  "Some *emphasis* and a [link](https://example.com/x).",
  "",
  "- one",
  "- two",
  "",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "Inline $E = mc^2$ costs $5 and $10 today.",
  "",
  "$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$",
  "",
  "Also \\(\\psi(\\theta) = e^{-i\\theta\\sigma_z/2}\\) and block:",
  "\\[ R(4\\pi) = 1 \\]",
  "",
  "In code: `not $math$ here` and a_b_c stays.",
  "",
  "<img src=x onerror=\"window.__pwned=1\"> <script>window.__pwned=2</script> [click](javascript:alert(1))"
].join("\n") }));
await page.fill("#composer", "render test");
await page.click("#send-btn");
await page.waitForFunction(() => document.querySelectorAll(".msg.assistant .meta").length === 2);
const rich = await page.$eval(".msg.assistant:nth-of-type(4)", el => ({
  h1: el.querySelectorAll("h1").length,
  em: el.querySelectorAll("em").length,
  li: el.querySelectorAll("li").length,
  table: el.querySelectorAll("table").length,
  link: el.querySelector("a[href='https://example.com/x']"),
  linkTarget: el.querySelector("a[href='https://example.com/x']")?.getAttribute("target"),
  linkRel: el.querySelector("a[href='https://example.com/x']")?.getAttribute("rel"),
  katex: el.querySelectorAll(".katex").length,
  display: el.querySelectorAll(".katex-display").length,
  hasMoneyText: el.textContent.includes("costs $5 and $10 today"),
  codeLiteral: [...el.querySelectorAll("code")].some(c => c.textContent === "not $math$ here"),
  underscoresKept: el.textContent.includes("a_b_c stays"),
  imgs: el.querySelectorAll("img").length,
  scripts: el.querySelectorAll("script").length,
  jsLinks: [...el.querySelectorAll("a")].filter(a => (a.getAttribute("href") || "").startsWith("javascript")).length,
  rawShown: el.textContent.includes("<script>") && el.textContent.includes("onerror"),
  mathml: el.querySelectorAll("math").length
}));
check("rich: headings/emphasis/list/table", rich.h1 === 1 && rich.em === 1 && rich.li === 2 && rich.table === 1, JSON.stringify(rich));
check("rich: link opens new tab safely", !!rich.link && rich.linkTarget === "_blank" && /noopener/.test(rich.linkRel), JSON.stringify(rich));
check("rich: katex inline+display (4 formulas, 2 display)", rich.katex === 4 && rich.display === 2 && rich.mathml === 4, JSON.stringify(rich));
check("rich: money is not maths", rich.hasMoneyText, JSON.stringify(rich));
check("rich: maths in code stays literal, underscores kept", rich.codeLiteral && rich.underscoresKept, JSON.stringify(rich));
check("rich: injection neutralised", rich.imgs === 0 && rich.scripts === 0 && rich.jsLinks === 0 && rich.rawShown, JSON.stringify(rich));
check("rich: nothing executed", (await page.evaluate(() => window.__pwned)) === undefined);
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "ok" }));
await page.fill("#composer", "again please");
await page.click("#send-btn");
await page.waitForFunction(() => document.querySelectorAll(".msg.assistant .meta").length === 3);

// 2. HTTP error -> retry bubble; retry works; no error roles replayed
await page.evaluate(() => window.__scenarios.push({ kind: "http", status: 429, message: "Rate limited" }, { kind: "ok", text: "second reply", servedModel: "someone/else" }));
await page.fill("#composer", "again");
await page.click("#send-btn");
await page.waitForSelector(".msg.error .retry-btn");
check("http error shown", (await page.textContent(".msg.error")).includes("HTTP 429: Rate limited"));
check("streaming ui reset after error", !(await page.$eval("#send-btn", b => b.classList.contains("stop"))));
await page.click(".retry-btn");
await page.waitForFunction(() => document.querySelectorAll(".msg.assistant").length === 4);
check("retry produced reply, error removed", (await page.$$(".msg.error")).length === 0);
check("served/requested mismatch flagged", (await assistantTexts())[3].includes("someone/else via MockProvider · requested anthropic/claude-sonnet-4"), (await assistantTexts())[1]);
req = await page.evaluate(() => window.__requests[4]);
const roles = req.messages.map(m => m.role);
check("retry replays clean roles, no duplicate user", JSON.stringify(roles) === JSON.stringify(["system","user","assistant","user","assistant","user","assistant","user"]), JSON.stringify(roles));

// 3. Mid-stream error
await page.evaluate(() => window.__scenarios.push({ kind: "midstream-error", text: "partial ", message: "Provider exploded" }));
await page.fill("#composer", "third");
await page.click("#send-btn");
await page.waitForSelector(".msg.error .retry-btn");
check("midstream error surfaced", (await page.textContent(".msg.error")).includes("Provider exploded"));
check("no dangling streaming bubble", (await page.$$(".msg.assistant.streaming")).length === 0);

// 4. Stop mid-stream keeps partial
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "one two three four five six seven eight nine ten", delayMs: 150 }));
await page.click(".retry-btn");
await page.waitForFunction(() => document.querySelector("#send-btn").classList.contains("stop"));
await page.waitForFunction(() => (document.querySelector(".msg.assistant.streaming") || {}).textContent?.length > 8);
await page.click("#send-btn");
await page.waitForFunction(() => !document.querySelector("#send-btn").classList.contains("stop"));
const lastHtml = (await assistantTexts()).pop();
check("stop keeps partial + marks stopped", lastHtml.includes("one two") && lastHtml.includes("stopped") && !lastHtml.includes("ten"), lastHtml);

// 5. Reload: persistence, open settings and Save without touching model (old bug wiped it)
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
check("history persisted", (await page.$$(".msg.assistant")).length === 5 && (await page.$$(".msg.user")).length === 5);
await page.click("#open-settings");
check("filters persisted across reload", (await page.$eval("#filter-provider", e => e.value)) === "Anthropic", await page.$eval("#filter-provider", e => e.value));
await page.click("#reset-filters");
check("reset filters", (await page.$eval("#filter-provider", e => e.value)) === "" && (await page.textContent("#model-refresh-hint")) === "6 models loaded.", await page.textContent("#model-refresh-hint"));
await page.selectOption("#filter-provider", "Google");
const withCurrent = await page.$$eval("#model-select option", os => os.map(o => o.textContent));
check("chosen model kept visible under a hiding filter", withCurrent[0] === "anthropic/claude-sonnet-4 (current)", JSON.stringify(withCurrent));
await page.click("#save-settings");   // immediately, before/regardless of model list
check("save keeps model", (await page.evaluate(() => localStorage.getItem("orc_model"))) === "anthropic/claude-sonnet-4");
check("composer still enabled", !(await page.$eval("#composer", e => e.disabled)));
const stored = (await curChat()).map(m => m.role);
check("stored history only user/assistant", stored.every(r => r === "user" || r === "assistant"), JSON.stringify(stored));

// 6. Dangling user message on reload gets a retry
await page.evaluate(() => { const k = "orc_chat_" + localStorage.getItem("orc_current_chat"); const h = JSON.parse(localStorage.getItem(k)); h.push({ role: "user", content: "lost" }); localStorage.setItem(k, JSON.stringify(h)); });
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
check("dangling user shows retry", (await page.$$(".msg.error .retry-btn")).length === 1);


// ---------- Chats ----------
check("header shows chat title", (await page.textContent("#chat-title")) === "hi there", await page.textContent("#chat-title"));
await page.click("#open-chats");
let rows = await page.$$eval(".chat-row .chat-title", els => els.map(e => e.textContent));
check("one chat listed with first-message title", JSON.stringify(rows) === JSON.stringify(["hi there"]), JSON.stringify(rows));
check("active row highlighted", (await page.$$(".chat-row.active")).length === 1);
const firstChatId = await page.evaluate(() => localStorage.getItem("orc_current_chat"));
await page.click("#new-chat-btn");
check("new chat: header + empty state", (await page.textContent("#chat-title")) === "New chat" && (await page.$("#empty-state")) !== null);
check("new chat not saved until sent", (await chatIndex()).length === 1 && (await page.evaluate(() => localStorage.getItem("orc_current_chat"))) === null);
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "fresh reply" }));
await page.fill("#composer", "second chat msg");
await page.click("#send-btn");
await page.waitForSelector(".msg.assistant .meta");
req = await page.evaluate(() => window.__requests[window.__requests.length - 1]);
check("new chat sends only its own context", req.messages.filter(m => m.role !== "system").length === 1, JSON.stringify(req.messages));
check("chat created on first send", (await chatIndex()).length === 2 && (await chatIndex())[0].title === "second chat msg" && (await page.textContent("#chat-title")) === "second chat msg", JSON.stringify(await chatIndex()));
const secondChatId = await page.evaluate(() => localStorage.getItem("orc_current_chat"));
await page.click("#open-chats");
await page.click(`.chat-row:nth-child(2) .chat-open`);
check("switch back restores old chat", (await page.textContent("#chat-title")) === "hi there" && (await page.$$(".msg.user")).length === 6 && (await page.$$(".retry-btn")).length === 1);

// Switch away mid-stream: reply must land in the chat it was sent from.
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "slow one two three four five six", delayMs: 120 }));
await page.click(".retry-btn");
await page.waitForFunction(() => (document.querySelector(".msg.assistant.streaming") || {}).textContent?.length > 4);
await page.click("#open-chats");
await page.click(`.chat-row:nth-child(1) .chat-open`);
await page.waitForTimeout(1200);
check("switched chat shows no stray streaming bubble", (await page.$$(".msg.assistant")).length === 1 && (await page.$$(".msg.assistant.streaming")).length === 0 && (await page.textContent("#chat-title")) === "second chat msg");
const oldChatMsgs = await page.evaluate(id => JSON.parse(localStorage.getItem("orc_chat_" + id)), firstChatId);
check("reply filed to originating chat (stopped or complete)", oldChatMsgs[oldChatMsgs.length - 1].role === "assistant" && oldChatMsgs[oldChatMsgs.length - 1].content.startsWith("slow"), JSON.stringify(oldChatMsgs.slice(-1)));
check("streaming ui reset after switch", !(await page.$eval("#send-btn", b => b.classList.contains("stop"))));

// Delete current chat from settings
await page.click("#open-settings");
await page.click("#clear-chat");
check("delete current chat -> new chat", (await page.textContent("#chat-title")) === "New chat" && (await chatIndex()).length === 1 && (await chatIndex())[0].id === firstChatId);
check("deleted chat storage removed", (await page.evaluate(id => localStorage.getItem("orc_chat_" + id), secondChatId)) === null);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
check("reload with no current chat stays on new chat", (await page.textContent("#chat-title")) === "New chat");

// Legacy migration
await page.evaluate(() => {
  localStorage.removeItem("orc_chats"); localStorage.removeItem("orc_current_chat");
  Object.keys(localStorage).filter(k => k.startsWith("orc_chat_")).forEach(k => localStorage.removeItem(k));
  localStorage.setItem("orc_history", JSON.stringify([{ role: "user", content: "old thread question" }, { role: "assistant", content: "old answer", model: "google/gemma-3-4b-it" }, { role: "error", content: "junk" }]));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
const migrated = await chatIndex();
check("legacy thread migrated", migrated.length === 1 && migrated[0].title === "old thread question" && migrated[0].model === "google/gemma-3-4b-it" && migrated[0].count === 2, JSON.stringify(migrated));
check("legacy key removed, messages shown", (await page.evaluate(() => localStorage.getItem("orc_history"))) === null && (await page.$$(".msg.assistant")).length === 1 && (await page.textContent("#chat-title")) === "old thread question");


// ---------- Profiles ----------
// State here: current chat "old thread question" (migrated), model anthropic/claude-sonnet-4, no system prompt.
await page.click("#open-settings");
await page.click("#reset-filters");
await page.waitForFunction(() => document.querySelectorAll("#model-select option").length >= 6);
await page.fill("#system-prompt", "Be terse.");
await page.click("#profile-new");
check("editor opens with chat-derived name", !(await page.$eval("#profile-editor", e => e.hidden)) && (await page.$eval("#profile-name", e => e.value)) === "old thread question", await page.$eval("#profile-name", e => e.value));
await page.fill("#profile-name", "Terse Sonnet");
await page.click("#profile-save");
const profileOpts = async () => page.$$eval("#profile-select option", os => os.map(o => o.textContent));
check("profile saved and active", (await profileOpts()).includes("Terse Sonnet") && (await page.$eval("#profile-select", e => e.selectedOptions[0].textContent)) === "Terse Sonnet");
check("saving profile also saved settings", (await page.evaluate(() => localStorage.getItem("orc_system_prompt"))) === "Be terse." && (await page.evaluate(() => localStorage.getItem("orc_model"))) === "anthropic/claude-sonnet-4");
check("header shows profile", (await page.textContent("#current-model-label")).endsWith("· Terse Sonnet"), await page.textContent("#current-model-label"));

// Prompt-only persona: different prompt, model tick off.
await page.fill("#system-prompt", "You are a pirate.");
await page.click("#profile-new");
check("second suggestion de-duplicates", (await page.$eval("#profile-name", e => e.value)) === "old thread question", await page.$eval("#profile-name", e => e.value));
await page.fill("#profile-name", "Pirate");
await page.uncheck("#profile-inc-model");
await page.click("#profile-save");
check("two profiles, Pirate active", (await profileOpts()).length === 3 && (await page.$eval("#profile-select", e => e.selectedOptions[0].textContent)) === "Pirate");
check("hint says prompt+filters only", (await page.textContent("#profile-hint")).startsWith("Sets prompt, filters."), await page.textContent("#profile-hint"));

// Change model manually, then apply Terse Sonnet (sets model + prompt), then Pirate (prompt only).
await page.selectOption("#filter-provider", "");
await page.selectOption("#model-select", "google/gemma-3-4b-it");
await page.click("#save-settings");
await page.click("#open-settings");
check("model change is not drift for a prompt-only profile", !/changed since/.test(await page.textContent("#profile-hint")), await page.textContent("#profile-hint"));
await page.fill("#system-prompt", "Arr, matey.");
await page.click("#save-settings");
await page.click("#open-settings");
check("prompt change flagged as drift", /changed since/.test(await page.textContent("#profile-hint")), await page.textContent("#profile-hint"));
const terseId = await page.$$eval("#profile-select option", os => os.find(o => o.textContent === "Terse Sonnet").value);
const pirateId = await page.$$eval("#profile-select option", os => os.find(o => o.textContent === "Pirate").value);
await page.selectOption("#profile-select", terseId);
check("apply full profile sets model + prompt", (await page.evaluate(() => localStorage.getItem("orc_model"))) === "anthropic/claude-sonnet-4" && (await page.$eval("#system-prompt", e => e.value)) === "Be terse." && (await page.$eval("#model-select", e => e.value)) === "anthropic/claude-sonnet-4");
await page.selectOption("#model-select", "google/gemma-3-4b-it");
await page.click("#save-settings");
await page.click("#open-settings");
await page.selectOption("#profile-select", pirateId);
check("apply prompt-only profile keeps model", (await page.evaluate(() => localStorage.getItem("orc_model"))) === "google/gemma-3-4b-it" && (await page.$eval("#system-prompt", e => e.value)) === "You are a pirate.");
check("header shows Pirate with kept model", (await page.textContent("#current-model-label")) === "google/gemma-3-4b-it · Pirate", await page.textContent("#current-model-label"));

// Default profile applies on New chat.
await page.click("#profile-default");
check("default marked with star", (await profileOpts()).includes("★ Pirate") && (await page.textContent("#profile-default")) === "Unset default");
await page.selectOption("#profile-select", terseId);   // switch away: prompt terse, model sonnet
check("switched to Terse", (await page.evaluate(() => localStorage.getItem("orc_system_prompt"))) === "Be terse.");
await page.click("#save-settings");
await page.click("#open-chats");
await page.click("#new-chat-btn");
check("new chat applied default (prompt only)", (await page.evaluate(() => localStorage.getItem("orc_system_prompt"))) === "You are a pirate." && (await page.evaluate(() => localStorage.getItem("orc_model"))) === "anthropic/claude-sonnet-4" && (await page.textContent("#current-model-label")).endsWith("· Pirate"), await page.textContent("#current-model-label"));
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "arr" }));
await page.fill("#composer", "ahoy");
await page.click("#send-btn");
await page.waitForSelector(".msg.assistant .meta");
req = await page.evaluate(() => window.__requests[window.__requests.length - 1]);
check("request carries profile prompt", req.messages[0].role === "system" && req.messages[0].content === "You are a pirate." && req.model === "anthropic/claude-sonnet-4", JSON.stringify(req.messages[0]));

// Update, reload persistence, delete.
await page.click("#open-settings");
await page.fill("#system-prompt", "You are a polite pirate.");
await page.click("#profile-update");
check("update editor prefilled", (await page.$eval("#profile-name", e => e.value)) === "Pirate" && !(await page.$eval("#profile-inc-model", e => e.checked)));
await page.click("#profile-save");
check("profile updated", (await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles")).find(p => p.name === "Pirate").systemPrompt)) === "You are a polite pirate.");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
check("active profile persists across reload", (await page.textContent("#current-model-label")).endsWith("· Pirate"), await page.textContent("#current-model-label"));
await page.click("#open-settings");
await page.click("#profile-delete");
check("delete leaves settings, clears active", (await profileOpts()).length === 2 && (await page.$eval("#profile-select", e => e.value)) === "" && (await page.evaluate(() => localStorage.getItem("orc_system_prompt"))) === "You are a polite pirate." && !(await page.textContent("#current-model-label")).includes("·"));
await page.selectOption("#profile-select", "");


// ---------- Profile with no model (Copilot review on #6) ----------
await page.evaluate(() => {
  localStorage.removeItem("orc_model");
  // A legacy-shaped profile claiming to set an empty model must be normalised on load.
  localStorage.setItem("orc_profiles", JSON.stringify([{ id: "legacy1", name: "Legacy empty", model: "", systemPrompt: "hi", filters: {}, includes: { model: true, prompt: true, filters: true } }]));
  localStorage.setItem("orc_active_profile", "legacy1");
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
await page.click("#open-settings");
check("legacy empty-model profile normalised", (await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles"))[0].includes.model)) === false || (await page.textContent("#profile-hint")).startsWith("Sets prompt, filters"), await page.textContent("#profile-hint"));
await page.click("#profile-new");
check("model tick disabled when no model chosen", (await page.$eval("#profile-inc-model", e => e.disabled && !e.checked)));
await page.fill("#profile-name", "No model yet");
await page.click("#profile-save");
check("saved without model sets prompt+filters only", (await page.textContent("#profile-hint")).startsWith("Sets prompt, filters."), await page.textContent("#profile-hint"));
await page.waitForFunction(() => document.querySelectorAll("#model-select option").length >= 6);
await page.selectOption("#model-select", "google/gemma-3-4b-it");
await page.click("#save-settings");
await page.click("#open-settings");
check("choosing a model is not drift for that profile", !/changed since/.test(await page.textContent("#profile-hint")), await page.textContent("#profile-hint"));
const noModelId = await page.$$eval("#profile-select option", os => os.find(o => o.textContent === "No model yet").value);
await page.selectOption("#profile-select", "");
await page.selectOption("#profile-select", noModelId);
check("re-applying it keeps the chosen model", (await page.evaluate(() => localStorage.getItem("orc_model"))) === "google/gemma-3-4b-it" && !(await page.$eval("#composer", e => e.disabled)));


// ---------- Export / import ----------
await page.selectOption("#profile-select", "");
await page.click("#save-settings");
await page.click("#open-chats");
const chatsBefore = await chatIndex();
const profilesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles")));
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-btn")]);
const exportPath = await download.path();
const exportText = (await import("fs")).readFileSync(exportPath, "utf8");
const exported = JSON.parse(exportText);
check("export file name", /^openrouter-chat-export-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
check("export has chats with messages and profiles", exported.format === "openrouter-chat" && exported.chats.length === chatsBefore.length && exported.chats.every(c => Array.isArray(c.messages) && c.messages.length > 0) && exported.profiles.length === profilesBefore.length, JSON.stringify({ chats: exported.chats.length, profiles: exported.profiles.length }));
check("export never contains the api key", !exportText.includes("sk-or-v1"));
check("export status shown", /^Exported \d+ chats? and \d+ profiles?\.$/.test(await page.textContent("#transfer-status")), await page.textContent("#transfer-status"));

// Import the same file: everything skipped.
await page.setInputFiles("#import-file", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(exportText) });
await page.waitForFunction(() => /^Imported/.test(document.querySelector("#transfer-status").textContent));
check("re-import skips duplicates", (await page.textContent("#transfer-status")) === `Imported 0 chats, ${chatsBefore.length} already here, ${profilesBefore.length} profiles already here.` && (await chatIndex()).length === chatsBefore.length, await page.textContent("#transfer-status"));

// Wipe chats, import: all restored, current chat state fine.
await page.evaluate(() => { const idx = JSON.parse(localStorage.getItem("orc_chats")); idx.forEach(c => localStorage.removeItem("orc_chat_" + c.id)); localStorage.removeItem("orc_chats"); localStorage.removeItem("orc_current_chat"); });
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
await page.click("#open-chats");
check("chats gone before restore", (await chatIndex()).length === 0);
await page.setInputFiles("#import-file", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(exportText) });
await page.waitForFunction(() => /^Imported/.test(document.querySelector("#transfer-status").textContent));
const restored = await chatIndex();
check("restore brings chats back with titles and counts", restored.length === chatsBefore.length && restored.every(c => c.title && c.count > 0) && (await page.$$(".chat-row")).length === chatsBefore.length, JSON.stringify(restored.map(c => [c.title, c.count])));
check("restored chat opens", await (async () => { await page.click(".chat-row:nth-child(1) .chat-open"); return (await page.$$(".msg.assistant")).length > 0; })());

// Same id, different content: added as a copy, original untouched. Junk entries dropped, missing title rebuilt.
const tampered = JSON.parse(exportText);
const target = tampered.chats[0];
const originalMsgs = await page.evaluate(id => JSON.parse(localStorage.getItem("orc_chat_" + id)), target.id);
target.messages = [{ role: "user", content: "tampered question" }, { role: "error", content: "junk" }, { role: "assistant", content: "tampered answer", model: "x/y" }];
delete target.title;
tampered.profiles = [{ id: "brandnew", name: profilesBefore[0].name, model: "google/gemma-3-4b-it", systemPrompt: "dup name", filters: {}, includes: { model: true, prompt: true, filters: true }, isDefault: true }];
await page.click("#open-chats");
await page.setInputFiles("#import-file", { name: "t.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(tampered)) });
await page.waitForFunction(() => /^Imported 1 chat/.test(document.querySelector("#transfer-status").textContent));
const afterTamper = await chatIndex();
const copy = afterTamper.find(c => c.title === "tampered question (imported copy)");
check("changed chat imported as copy, original kept", !!copy && copy.count === 2 && JSON.stringify(await page.evaluate(id => JSON.parse(localStorage.getItem("orc_chat_" + id)), target.id)) === JSON.stringify(originalMsgs), JSON.stringify(afterTamper.map(c => c.title)));
const profsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles")));
check("imported profile renamed, never default", profsAfter.some(p => p.name === profilesBefore[0].name + " (imported)" && p.isDefault === false), JSON.stringify(profsAfter.map(p => [p.name, p.isDefault])));

// Copilot review on #8: blank profile names, key-order-insensitive profile dedupe.
const reordered = JSON.parse(exportText);
reordered.chats = [];
reordered.profiles = reordered.profiles.map(p => ({ includes: { filters: p.includes.filters, prompt: p.includes.prompt, model: p.includes.model }, filters: Object.fromEntries(Object.entries(p.filters || {}).reverse()), systemPrompt: p.systemPrompt, model: p.model, name: p.name, id: p.id }));
reordered.profiles.push({ id: "blank1", name: "   ", model: "", systemPrompt: "x", filters: {}, includes: {} });
const profsBeforeReorder = (await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles")))).length;
await page.setInputFiles("#import-file", { name: "r.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(reordered)) });
await page.waitForFunction(() => /^Imported 0 chats/.test(document.querySelector("#transfer-status").textContent));
const profsAfterReorder = await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles")));
check("reordered keys do not duplicate profiles", profsAfterReorder.length === profsBeforeReorder + 1, await page.textContent("#transfer-status"));
check("blank profile name replaced", profsAfterReorder.some(p => p.id === "blank1" && p.name === "Imported profile"), JSON.stringify(profsAfterReorder.map(p => p.name)));

// Bad files.
await page.setInputFiles("#import-file", { name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{not json") });
await page.waitForFunction(() => /valid JSON/.test(document.querySelector("#transfer-status").textContent));
check("invalid json reported", (await page.$eval("#transfer-status", e => e.classList.contains("error"))));
await page.setInputFiles("#import-file", { name: "other.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ hello: 1 })) });
await page.waitForFunction(() => /Not an OpenRouter Chat export/.test(document.querySelector("#transfer-status").textContent));
check("wrong format reported", true);


// ---------- Copy buttons ----------
await page.evaluate(() => document.getElementById("chats-overlay").classList.remove("open"));
await page.click("#open-chats");
await page.click("#new-chat-btn");
const copySource = "Intro line\n\n```python\nprint('hi')\nx = 1\n```\n\nTail with `inline` and\n\n```\nplain block\n```";
await page.evaluate(src => window.__scenarios.push({ kind: "ok", text: src }), copySource);
await page.fill("#composer", "give me code");
await page.click("#send-btn");
await page.waitForSelector(".msg.assistant .msg-actions .copy-btn");
const readClip = () => page.evaluate(() => navigator.clipboard.readText());
await page.click(".msg.user .copy-btn");
check("copy user message", (await readClip()) === "give me code");
await page.click(".msg.assistant .msg-actions .copy-btn");
check("copy assistant message copies raw markdown", (await readClip()) === copySource, JSON.stringify(await readClip()));
check("copied feedback shown", await page.$eval(".msg.assistant .msg-actions .copy-btn", b => b.classList.contains("copied")));
const heads = await page.$$eval(".msg.assistant .codeblock-head", hs => hs.map(h => h.firstChild.textContent));
check("code blocks get headers with language", JSON.stringify(heads) === JSON.stringify(["python", "code"]), JSON.stringify(heads));
await page.click(".msg.assistant .codeblock:nth-of-type(1) .copy-btn");
check("copy first code block", (await readClip()) === "print('hi')\nx = 1", JSON.stringify(await readClip()));
const blocks = await page.$$(".msg.assistant .codeblock .copy-btn");
await blocks[1].click();
check("copy second code block", (await readClip()) === "plain block", JSON.stringify(await readClip()));
check("code button label flips to Copied", await blocks[1].evaluate(b => b.querySelector("span").textContent === "Copied"));
await page.waitForTimeout(1700);
check("code button label resets", await blocks[1].evaluate(b => b.querySelector("span").textContent === "Copy" && !b.classList.contains("copied")));
check("code block not double-wrapped after reload", await (async () => { await page.reload({ waitUntil: "load" }); await page.waitForTimeout(300); return (await page.$$(".msg.assistant .codeblock")).length === 2 && (await page.$$(".msg.assistant .codeblock .codeblock")).length === 0; })());


// ---------- Timing footer ----------
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "one two three four five six seven eight", delayMs: 50 }));
await page.fill("#composer", "speed?");
await page.click("#send-btn");
await page.waitForFunction(() => document.querySelectorAll(".msg.assistant .meta").length === 2);
const metaText = await page.$$eval(".msg.assistant .meta", ms => ms[ms.length - 1].textContent);
check("footer shows wait and tok/s", /\d+\.\ds wait · \d+(\.\d)? tok\/s$/.test(metaText), metaText);
const tps = parseFloat(metaText.match(/([\d.]+) tok\/s/)[1]);
check("tok/s plausible for 8 tokens over ~350ms", tps > 10 && tps < 60, String(tps));
const storedTiming = (await curChat()).pop().timing;
check("timing persisted", storedTiming && storedTiming.wait >= 0 && storedTiming.gen > 0, JSON.stringify(storedTiming));


// ---------- Artificial Analysis scores (published by the GitHub Action) ----------
await page.evaluate(() => {
  localStorage.removeItem("orc_filters");
  localStorage.setItem("orc_aa_key", "old-key"); localStorage.setItem("orc_aa_cache", "{}"); localStorage.setItem("orc_aa_attempt", "1");
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(400);
check("aa: legacy per-device key and cache removed", await page.evaluate(() => ["orc_aa_key", "orc_aa_cache", "orc_aa_attempt"].every(k => localStorage.getItem(k) === null)));
check("aa: scores file requested once", (await page.evaluate(() => window.__aaRequests.length)) === 1);
await page.click("#open-settings");
check("aa: unpublished file is silent", await page.$eval("#filter-intel", e => e.hidden) && await page.$eval("#aa-status", e => e.hidden));
check("aa: no key field any more", (await page.$("#aa-key")) === null);
await page.click("#save-settings");

await page.evaluate(() => localStorage.setItem("__aaMode", "bad"));
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(400);
await page.click("#open-settings");
check("aa: unreadable file reported, no scores", /Couldn't load intelligence scores/.test(await page.textContent("#aa-status")) && await page.$eval("#filter-intel", e => e.hidden), await page.textContent("#aa-status"));
await page.click("#save-settings");

await page.evaluate(() => localStorage.setItem("__aaMode", "empty"));
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(400);
await page.click("#open-settings");
check("aa: empty published file reported, not silent", /no usable models/.test(await page.textContent("#aa-status")) && await page.$eval("#filter-intel", e => e.hidden), await page.textContent("#aa-status"));
await page.click("#save-settings");

await page.evaluate(() => localStorage.setItem("__aaMode", "ok"));
await page.reload({ waitUntil: "load" });
await page.click("#open-settings");
await page.waitForFunction(() => !document.getElementById("filter-intel").hidden);
check("aa: status shows source, age and matched count", (await page.textContent("#aa-status")) === "Intelligence scores from Artificial Analysis, updated 2 days ago. Matched 4 of 6 models.", await page.textContent("#aa-status"));
const intelOpts = await page.$$eval("#filter-intel option", os => os.map(o => o.textContent));
check("aa: intel bands from rounded scores", JSON.stringify(intelOpts) === JSON.stringify(["Any intelligence", "Has a score (4)", "40+ (1)", "20–29 (1)", "10–19 (2)"]), JSON.stringify(intelOpts));
const aaLabels = await page.$$eval("#model-select option", os => os.map(o => o.textContent));
check("aa: picker labels carry scores; creator decoy and gpt-4o decoy ignored",
  aaLabels.includes("Anthropic: Claude Sonnet 4 · AI 44") && aaLabels.includes("OpenAI: GPT-4o mini · AI 21") &&
  aaLabels.includes("Google: Gemma 3 4B · AI 12") && aaLabels.includes("Meta: Llama 3 8B (free) · AI 10") &&
  aaLabels.includes("Auto Router") && !aaLabels.some(l => / 99| 30$/.test(l)), JSON.stringify(aaLabels));
check("aa: '+' and non-reasoning variants don't steal the base match",
  aaLabels.includes("Anthropic: Claude Sonnet 4 · AI 44") && aaLabels.includes("OpenAI: GPT-4o mini · AI 21"), JSON.stringify(aaLabels));
const optVals = () => page.$$eval("#model-select option", os => os.filter(o => o.value && !o.textContent.endsWith("(current)")).map(o => o.value));
await page.selectOption("#filter-intel", "b40");
check("aa: band 40+", JSON.stringify(await optVals()) === JSON.stringify(["anthropic/claude-sonnet-4"]), JSON.stringify(await optVals()));
await page.selectOption("#filter-intel", "b10");
check("aa: band 10–19", JSON.stringify(await optVals()) === JSON.stringify(["google/gemma-3-4b-it", "meta-llama/llama-3-8b:free"]), JSON.stringify(await optVals()));
await page.selectOption("#filter-intel", "scored");
check("aa: scored only", (await optVals()).length === 4, JSON.stringify(await optVals()));
await page.selectOption("#filter-intel", "");
await page.selectOption("#model-select", "anthropic/claude-sonnet-4");
check("aa: info line leads with scores", (await page.textContent("#model-info")).startsWith("AI index 44 (59 reasoning) · coding 40 · math 60 · 200k context"), await page.textContent("#model-info"));

// Profiles carry the intelligence filter.
await page.selectOption("#filter-intel", "b20");
await page.click("#profile-new");
await page.fill("#profile-name", "Mid tier");
await page.click("#profile-save");
check("aa: profile stores intel filter", (await page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles")).find(p => p.name === "Mid tier").filters.intel)) === "b20");
await page.click("#reset-filters");
const midId = await page.$$eval("#profile-select option", os => os.find(o => o.textContent === "Mid tier").value);
await page.selectOption("#profile-select", "");
await page.selectOption("#profile-select", midId);
check("aa: applying profile restores intel filter", (await page.$eval("#filter-intel", e => e.value)) === "b20");
await page.click("#reset-filters");
await page.selectOption("#profile-select", "");
await page.click("#save-settings");

// ---------- Model browser ----------
await page.click("#open-settings");
await page.waitForFunction(() => !document.getElementById("filter-intel").hidden);
await page.click("#browse-open");
await page.waitForSelector("#browse-view:not([hidden]) .mcard");
const bNames = () => page.$$eval("#browse-list .mcard .mcard-name", ns => ns.map(n => n.textContent));
check("browse: sorted by intelligence, unscored last", JSON.stringify(await bNames()) === JSON.stringify(["Anthropic: Claude Sonnet 4", "OpenAI: GPT-4o mini", "Google: Gemma 3 4B", "Meta: Llama 3 8B (free)", "Auto Router", "weird/no-fields"]), JSON.stringify(await bNames()));
const pills = await page.$$eval("#browse-list .mcard .score", ss => ss.map(s => s.className + "|" + s.textContent));
check("browse: tier pills from percentiles", pills[0] === "score tier-strong|44" && pills[1] === "score tier-capable|21" && pills[2] === "score tier-light|12" && pills[4] === "score|–", JSON.stringify(pills));
check("browse: status line", (await page.textContent("#browse-status")) === "6 of 6 models · 4 with scores", await page.textContent("#browse-status"));
check("browse: attribution link", await page.$eval("#browse-attrib a", a => a.href === "https://artificialanalysis.ai/" && a.target === "_blank"));
check("browse: cards start collapsed for screen readers", await page.$eval("#browse-list .mcard:nth-child(1) .mcard-main", b => b.getAttribute("aria-expanded") === "false"));
await page.click("#browse-list .mcard:nth-child(1) .mcard-main");
check("browse: expanded card says so", await page.$eval("#browse-list .mcard:nth-child(1) .mcard-main", b => b.getAttribute("aria-expanded") === "true"));
const brief = await page.$eval("#browse-list .mcard:nth-child(1) .mcard-detail", d => d.textContent);
check("browse: briefing card", brief.includes("Strong · top 30%") && brief.includes("Reasoning mode") && brief.includes("GPQA Diamond") && brief.includes("68.3%") && brief.includes("55 tok/s") && brief.includes("Artificial Analysis entry: Claude 4 Sonnet, released 2025-05-22.") && brief.includes("Current model"), brief);
await page.click("#browse-list .mcard:nth-child(2) .mcard-main");
await page.click("#browse-list .mcard:nth-child(2) .btn.primary");
await page.waitForFunction(() => document.getElementById("browse-view").hidden);
check("browse: use this model", (await page.evaluate(() => localStorage.getItem("orc_model"))) === "openai/gpt-4o-mini" && (await page.$eval("#model-select", s => s.value)) === "openai/gpt-4o-mini" && (await page.textContent("#current-model-label")).startsWith("openai/gpt-4o-mini"));
await page.click("#browse-open");
await page.waitForSelector("#browse-view:not([hidden])");
await page.goBack();
await page.waitForFunction(() => document.getElementById("browse-view").hidden);
check("browse: back button closes it", page.url().endsWith("/index.html") && await page.$eval("#settings-overlay", e => e.classList.contains("open")));
await page.click("#browse-open");
await page.waitForSelector("#browse-view:not([hidden]) .mcard");
await page.selectOption("#browse-intel", "b10");
check("browse: intelligence band filter", JSON.stringify(await bNames()) === JSON.stringify(["Google: Gemma 3 4B", "Meta: Llama 3 8B (free)"]), JSON.stringify(await bNames()));
await page.selectOption("#browse-intel", "");
await page.selectOption("#browse-sort", "price");
const byPrice = await bNames();
check("browse: sort by price, unknown last", byPrice[0] === "Meta: Llama 3 8B (free)" && byPrice[3] === "Anthropic: Claude Sonnet 4" && byPrice[5] === "weird/no-fields", JSON.stringify(byPrice));
await page.fill("#browse-search", "claude 4 sonnet");
check("browse: search matches Artificial Analysis names", JSON.stringify(await bNames()) === JSON.stringify(["Anthropic: Claude Sonnet 4"]), JSON.stringify(await bNames()));
await page.fill("#browse-search", "");

// The header button opens the browser directly.
await page.click("#browse-close");
await page.waitForFunction(() => document.getElementById("browse-view").hidden);
await page.click("#save-settings");
await page.click("#open-browse");
await page.waitForSelector("#browse-view:not([hidden]) .mcard");
check("browse: header button opens it", (await page.$$("#browse-list .mcard")).length === 6 && !(await page.$eval("#settings-overlay", e => e.classList.contains("open"))));
await page.click("#browse-close");
await page.waitForFunction(() => document.getElementById("browse-view").hidden);

// Export never carries the Artificial Analysis key or cache.
await page.click("#open-chats");
const [dlAA] = await Promise.all([page.waitForEvent("download"), page.click("#export-btn")]);
const exportAA = (await import("fs")).readFileSync(await dlAA.path(), "utf8");
check("export excludes intelligence scores", !exportAA.includes("GPQA") && !exportAA.includes("gpqa"));


// ---------- Image generation ----------
const idbCount = () => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open("orc");
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains("images")) { resolve(0); return; }
    const c = db.transaction("images").objectStore("images").count();
    c.onsuccess = () => resolve(c.result);
  };
  r.onerror = () => resolve(-1);
}));
const imgsLoaded = (n) => page.waitForFunction((n) => {
  const imgs = [...document.querySelectorAll(".msg.assistant .msg-images img")];
  return imgs.length === n && imgs.every(i => i.complete && i.naturalWidth > 0);
}, n);
const lastMeta = () => page.$$eval(".msg.assistant .meta", ms => ms[ms.length - 1].textContent);

await page.evaluate(() => localStorage.setItem("__imgMode", "on"));
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(300);
await page.click("#open-chats");
await page.click("#new-chat-btn");
await page.click("#open-settings");
await page.click("#reset-filters");
await page.waitForFunction(() => [...document.querySelectorAll("#model-select option")].some(o => o.value === "acme/pixel-1"));
const imgLabels = await page.$$eval("#model-select option", os => os.map(o => o.textContent));
check("img: image-only models merged and labelled; org label borrowed", imgLabels.includes("acme: Pixel 1 · image") && imgLabels.includes("OpenAI: GPT Image 9 · image"), JSON.stringify(imgLabels));
await page.selectOption("#filter-capability", "image");
const imgOnly = await page.$$eval("#model-select option", os => os.filter(o => o.value && !o.textContent.endsWith("(current)")).map(o => o.value).sort());
check("img: capability filter", JSON.stringify(imgOnly) === JSON.stringify(["acme/pixel-1", "openai/gpt-image-9"]), JSON.stringify(imgOnly));
await page.selectOption("#model-select", "openai/gpt-image-9");
await page.waitForFunction(() => /per image/.test(document.getElementById("model-info").textContent));
check("img: info line with price range from endpoints", (await page.textContent("#model-info")) === "generates images · from $0.020 per image · 2 shapes", await page.textContent("#model-info"));
await page.selectOption("#model-select", "acme/pixel-1");
await page.waitForFunction(() => /per image/.test(document.getElementById("model-info").textContent));
check("img: info line lists capabilities", (await page.textContent("#model-info")) === "generates images · $0.040 per image · 2 shapes · up to 6 per request · can refine reference images", await page.textContent("#model-info"));
await page.selectOption("#filter-capability", "");
await page.click("#save-settings");

check("img: composer switches to image mode", (await page.$eval("#composer", e => e.placeholder)) === "Describe an image…" && !(await page.$eval("#image-options", e => e.hidden)));
const optShape = await page.$$eval("#image-options select", ss => ss.map(s => [s.getAttribute("data-param"), [...s.options].map(o => o.textContent)]));
check("img: every option control has an accessible name", await page.$$eval("#image-options select", ss => ss.length === 3 && ss.every(s => (s.getAttribute("aria-label") || "").length > 0)), JSON.stringify(await page.$$eval("#image-options select", ss => ss.map(s => s.getAttribute("aria-label")))));
check("img: options built from the model's capabilities", JSON.stringify(optShape) === JSON.stringify([["aspect_ratio", ["Any shape", "1:1", "16:9"]], ["quality", ["Any quality", "low", "high"]], ["n", ["1 image", "2 images", "3 images", "4 images"]]]), JSON.stringify(optShape));
check("img: no refine option before any image", (await page.$("#img-refine")) === null);
await page.selectOption('#image-options select[data-param="aspect_ratio"]', "16:9");
await page.selectOption('#image-options select[data-param="n"]', "2");
const chatReqsBefore = await page.evaluate(() => window.__requests.length);
await page.fill("#composer", "a red panda astronaut");
await page.click("#send-btn");
await imgsLoaded(2);
const imgReq = await page.evaluate(() => window.__imgRequests[window.__imgRequests.length - 1]);
check("img: request body carries chosen options only", imgReq.model === "acme/pixel-1" && imgReq.prompt === "a red panda astronaut" && imgReq.aspect_ratio === "16:9" && imgReq.n === 2 && !("quality" in imgReq) && !imgReq.input_references, JSON.stringify(imgReq));
check("img: no chat request made", (await page.evaluate(() => window.__requests.length)) === chatReqsBefore);
check("img: footer shows cost, count and time", /^acme\/pixel-1 · \$0\.0800 · 2 images · took \d+\.\ds$/.test(await lastMeta()), await lastMeta());
const storedImgChat = await curChat();
const lastStored = storedImgChat[storedImgChat.length - 1];
check("img: chat stores references, not image data", lastStored.content === "" && lastStored.images.length === 2 && lastStored.images.every(r => r.type === "image/png") && !JSON.stringify(storedImgChat).includes("iVBOR"), JSON.stringify(lastStored));
check("img: image files in IndexedDB", (await idbCount()) === 2);

check("img: refine offered and on after an image", await page.$eval("#img-refine", c => c.checked));
await page.fill("#composer", "make it dusk");
await page.click("#send-btn");
await imgsLoaded(4);
const refineReq = await page.evaluate(() => window.__imgRequests[window.__imgRequests.length - 1]);
check("img: refine sends the last image as a reference", Array.isArray(refineReq.input_references) && refineReq.input_references.length === 1 && refineReq.input_references[0].image_url.url.startsWith("data:image/png;base64,") && refineReq.n === 2 && refineReq.aspect_ratio === "16:9", JSON.stringify(refineReq).slice(0, 200));
check("img: refined footer", (await lastMeta()).includes("2 images, refined from the last one"), await lastMeta());

await page.click(".msg.assistant .msg-images .img-thumb");
await page.waitForSelector("#image-viewer:not([hidden])");
check("img: viewer shows the image", await page.$eval("#viewer-img", i => i.src.startsWith("blob:")));
const [dlImg] = await Promise.all([page.waitForEvent("download"), page.click("#viewer-save")]);
check("img: save downloads a named png", /^openrouter-image-\d{8}-\d{6}\.png$/.test(dlImg.suggestedFilename()), dlImg.suggestedFilename());
await page.click("#viewer-copy");
await page.waitForFunction(() => /Copied|Couldn't copy/.test(document.getElementById("viewer-status").textContent));
const clipTypes = await page.evaluate(async () => { try { return (await navigator.clipboard.read()).flatMap(i => i.types); } catch (e) { return ["error: " + e.message]; } });
check("img: copy puts a png on the clipboard", clipTypes.includes("image/png"), JSON.stringify(clipTypes) + " / " + await page.textContent("#viewer-status"));
await page.goBack();
await page.waitForFunction(() => document.getElementById("image-viewer").hidden);
check("img: back button closes the viewer", page.url().endsWith("/index.html"));

// The viewer behaves as a modal dialog, and Share hands over the image file.
await page.evaluate(() => {
  window.__shared = [];
  window.__shareError = null;
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => {
    window.__shared.push(d.files.map(f => [f.name, f.type, f.size]));
    if (window.__shareError) throw window.__shareError;
  } });
});
await page.click(".msg.assistant .msg-images .img-thumb");
await page.waitForSelector("#image-viewer:not([hidden])");
check("img: viewer is a modal dialog", await page.$eval("#image-viewer", v => v.getAttribute("role") === "dialog" && v.getAttribute("aria-modal") === "true" && !!v.getAttribute("aria-label")));
check("img: focus moves into the viewer; page behind is inert", await page.evaluate(() => document.activeElement.id === "viewer-close" && document.querySelector("header").inert && document.getElementById("messages").inert && document.getElementById("input-bar").inert));
await page.keyboard.press("Tab");
const afterTab = await page.evaluate(() => document.activeElement.id);
await page.keyboard.press("Shift+Tab");
const afterShiftTab = await page.evaluate(() => document.activeElement.id);
check("img: Tab is trapped inside the viewer", afterTab === "viewer-save" && afterShiftTab === "viewer-close", afterTab + " / " + afterShiftTab);
await page.click("#viewer-share");
await page.waitForFunction(() => window.__shared.length === 1);
const sharedFile = await page.evaluate(() => window.__shared[0]);
check("img: share hands over the image as a png file", sharedFile.length === 1 && /^openrouter-image-\d{8}-\d{6}\.png$/.test(sharedFile[0][0]) && sharedFile[0][1] === "image/png" && sharedFile[0][2] > 0, JSON.stringify(sharedFile));
await page.evaluate(() => { window.__shareError = new Error("share target failed"); });
await page.click("#viewer-share");
await page.waitForFunction(() => /Couldn't share/.test(document.getElementById("viewer-status").textContent));
check("img: a failed share is reported", (await page.textContent("#viewer-status")) === "Couldn't share: share target failed", await page.textContent("#viewer-status"));
await page.keyboard.press("Escape");
await page.waitForFunction(() => document.getElementById("image-viewer").hidden);
check("img: Escape closes the viewer and returns focus", await page.evaluate(() => document.activeElement.classList.contains("img-thumb") && !document.querySelector("header").inert));
await page.evaluate(() => { window.__shareError = new DOMException("cancelled", "AbortError"); });
await page.click(".msg.assistant .msg-images .img-thumb");
await page.waitForSelector("#image-viewer:not([hidden])");
await page.click("#viewer-share");
await page.waitForFunction(() => window.__shared.length === 3);
await page.waitForTimeout(100);
check("img: cancelling the share sheet is silent", (await page.textContent("#viewer-status")) === "");
await page.click("#viewer-close");
await page.waitForFunction(() => document.getElementById("image-viewer").hidden);

await page.reload({ waitUntil: "load" });
await imgsLoaded(4);
check("img: images reload from IndexedDB", true);
check("img: options remembered per model", (await page.$eval('#image-options select[data-param="aspect_ratio"]', s => s.value)) === "16:9" && (await page.$eval('#image-options select[data-param="n"]', s => s.value)) === "2");

// A text model in the same chat sees prompts and placeholders, never empty turns.
await page.click("#open-settings");
await page.waitForFunction(() => document.querySelectorAll("#model-select option").length > 3);
await page.selectOption("#model-select", "anthropic/claude-sonnet-4");
await page.click("#save-settings");
check("img: text model leaves image mode", (await page.$eval("#composer", e => e.placeholder)) === "Message…" && await page.$eval("#image-options", e => e.hidden));
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "Nice pictures." }));
await page.fill("#composer", "what did you make?");
await page.click("#send-btn");
await page.waitForFunction(() => (document.querySelectorAll(".msg.assistant .meta")[document.querySelectorAll(".msg.assistant .meta").length - 1] || {}).textContent?.includes("tokens"));
const mixedReq = await page.evaluate(() => window.__requests[window.__requests.length - 1]);
const assistantTurns = mixedReq.messages.filter(m => m.role === "assistant").map(m => m.content);
check("img: text model gets placeholders for image turns", assistantTurns.length === 2 && assistantTurns.every(c => c === "(An image model generated 2 images here.)"), JSON.stringify(assistantTurns));

// Failure, retry, stop.
await page.click("#open-settings");
await page.selectOption("#model-select", "acme/pixel-1");
await page.click("#save-settings");
await page.evaluate(() => localStorage.setItem("__imgMode", "fail"));
await page.fill("#composer", "a lighthouse");
await page.click("#send-btn");
await page.waitForSelector(".msg.error .retry-btn");
check("img: failure reported with retry", (await page.textContent(".msg.error")).includes("Image generation failed: HTTP 502: Generation failed"), await page.textContent(".msg.error"));
await page.evaluate(() => localStorage.setItem("__imgMode", "on"));
await page.click(".retry-btn");
await imgsLoaded(6);
check("img: retry generates", (await page.$$(".msg.error")).length === 0 && (await idbCount()) === 6);
await page.evaluate(() => localStorage.setItem("__imgMode", "slow"));
await page.fill("#composer", "a slow one");
await page.click("#send-btn");
await page.waitForFunction(() => /(Generating|Refining) image… \ds/.test((document.querySelector(".msg.assistant.generating") || {}).textContent || ""));
await page.click("#send-btn");
await page.waitForSelector(".msg.error");
check("img: stop cancels without storing anything", (await page.textContent(".msg.error")).includes("Stopped. A cancelled image isn't billed.") && (await idbCount()) === 6 && !(await page.$(".msg.assistant.generating")));

// An SVG with a script is shown only as an image, so the script never runs.
await page.evaluate(() => localStorage.setItem("__imgMode", "svg"));
await page.fill("#composer", "a vector logo");
await page.click("#send-btn");
await imgsLoaded(7);
check("img: svg shown as an image; its script never runs", (await page.evaluate(() => window.__svgpwned)) === undefined);
check("img: svg isn't offered as a refine source", (await page.$("#img-refine")) === null);
await page.evaluate(() => localStorage.setItem("__imgMode", "on"));

await page.click("#open-browse");
await page.waitForSelector("#browse-view:not([hidden]) .mcard");
await page.selectOption("#browse-cap", "image");
const imgCards = await page.$$eval("#browse-list .mcard", cs => cs.map(c => c.querySelector(".mcard-name").textContent + "|" + c.querySelector(".mcard-sub").textContent));
check("img: browser filters image models", imgCards.length === 2 && imgCards.every(c => c.includes("image generation")), JSON.stringify(imgCards));
await page.selectOption("#browse-cap", "");
await page.click("#browse-close");
await page.waitForFunction(() => document.getElementById("browse-view").hidden);

await page.click("#open-chats");
const [dlImgExport] = await Promise.all([page.waitForEvent("download"), page.click("#export-btn")]);
const imgExportText = (await import("fs")).readFileSync(await dlImgExport.path(), "utf8");
check("img: export keeps references but no image data", imgExportText.includes('"images"') && !imgExportText.includes("iVBOR") && !imgExportText.includes("PHN2Zy"));
await page.click("#chats-overlay", { position: { x: 380, y: 400 } });
await page.click("#open-settings");
await page.click("#clear-chat");
await page.waitForFunction(() => document.getElementById("chat-title").textContent === "New chat");
await page.waitForTimeout(300);
check("img: deleting the chat deletes its images", (await idbCount()) === 0);
await page.evaluate(() => localStorage.removeItem("__imgMode"));


// ---------- Copilot follow-ups on #14 and #15 ----------
for (const mode of ["missing", "notarray"]) {
  await page.evaluate((m) => localStorage.setItem("__aaMode", m), mode);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.click("#open-settings");
  check("aa: " + mode + " model list reported, no scores", /no model list/.test(await page.textContent("#aa-status")) && await page.$eval("#filter-intel", e => e.hidden), await page.textContent("#aa-status"));
  await page.click("#save-settings");
}

await page.evaluate(() => { localStorage.setItem("__aaMode", "aliases"); localStorage.setItem("__orMode", "aliases"); localStorage.removeItem("orc_filters"); });
await page.reload({ waitUntil: "load" });
await page.click("#open-settings");
await page.waitForFunction(() => !document.getElementById("filter-intel").hidden);
const aliasPairs = await page.evaluate(() => window.__aliasPairs);
const aliasLabels = await page.$$eval("#model-select option", os => Object.fromEntries(os.map(o => [o.value, o.textContent])));
const aliasMisses = aliasPairs.filter(([org], i) => !(aliasLabels[org + "/alias-probe-" + i] || "").endsWith("· AI " + (10 + i)))
  .map(([org, aa]) => org + "->" + aa);
check("aa: every creator alias matches (" + aliasPairs.length + " pairs)", aliasMisses.length === 0, "missed: " + JSON.stringify(aliasMisses));
// Every alias in the app's own table must appear in a tested pair, so a new
// alias can't be added without a check.
const appSource = await (await fetch(BASE + "/index.html")).text();   // the same code the browser is running
const aliasBlock = /var AA_CREATOR_ALIAS = \{([\s\S]*?)\};/.exec(appSource);
const aliasKeys = aliasBlock ? [...aliasBlock[1].matchAll(/"([^"]+)":/g)].map(m => m[1]) : [];
const tested = new Set(aliasPairs.flat().map(n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-")));
const untested = aliasKeys.filter(k => !tested.has(k));
check("aa: every alias in the app's table has a tested pair (" + aliasKeys.length + " aliases)", aliasKeys.length > 30 && untested.length === 0, "untested: " + JSON.stringify(untested));
check("aa: an unknown org never borrows another creator's score", !/AI/.test(aliasLabels["unknownorg/alias-probe-99"] || "AI"), aliasLabels["unknownorg/alias-probe-99"]);
await page.click("#save-settings");
await page.evaluate(() => { localStorage.removeItem("__aaMode"); localStorage.removeItem("__orMode"); });


// ---------- Export reachability and per-chat export ----------
const savedStorage = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))));
await page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("orc_chats") || "[]");
  for (let i = 0; i < 60; i++) {
    const id = "bulk" + i;
    idx.push({ id, title: "Bulk chat " + i, created: 1, updated: 1000 - i, model: "x/y", count: 2 });
    localStorage.setItem("orc_chat_" + id, JSON.stringify([{ role: "user", content: "question " + i }, { role: "assistant", content: "answer " + i }]));
  }
  localStorage.setItem("orc_chats", JSON.stringify(idx));
  localStorage.removeItem("orc_current_chat");
});
await page.reload({ waitUntil: "load" });
await page.click("#open-chats");
await page.waitForTimeout(300);
const reach = await page.evaluate(() => {
  const b = document.getElementById("export-btn").getBoundingClientRect();
  const list = document.getElementById("chat-list");
  return { onScreen: b.top >= 0 && b.bottom <= innerHeight, listScrolls: list.scrollHeight > list.clientHeight };
});
check("export: drawer buttons stay on screen with a long chat list", reach.onScreen && reach.listScrolls, JSON.stringify(reach));

await page.click("#new-chat-btn");
await page.click("#open-settings");
check("export: an empty chat can't be exported", await page.$eval("#export-chat", b => b.disabled) && (await page.textContent("#chat-export-status")) === "Nothing to export until this chat has messages.", await page.textContent("#chat-export-status"));
await page.click("#save-settings");

await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("Bulk chat 5")) .chat-open');
await page.evaluate(() => {
  window.__sharedData = [];
  window.__shareError = null;
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => {
    const files = [];
    for (const f of d.files || []) files.push([f.name, f.type, await f.text()]);
    window.__sharedData.push({ title: d.title, text: d.text, files });
    if (window.__shareError) throw window.__shareError;
  } });
});
await page.click("#open-settings");
check("export: export and share offered for a chat with messages", !(await page.$eval("#export-chat", b => b.disabled)) && !(await page.$eval("#share-chat", b => b.hidden)));
const [dlChat] = await Promise.all([page.waitForEvent("download"), page.click("#export-chat")]);
const chatFileText = (await import("fs")).readFileSync(await dlChat.path(), "utf8");
const chatFile = JSON.parse(chatFileText);
check("export: this-chat file is named after the chat", /^openrouter-chat-bulk-chat-5-\d{4}-\d{2}-\d{2}\.json$/.test(dlChat.suggestedFilename()), dlChat.suggestedFilename());
check("export: this-chat file holds just that chat, no profiles", chatFile.format === "openrouter-chat" && chatFile.chats.length === 1 && chatFile.chats[0].id === "bulk5" &&
  JSON.stringify(chatFile.chats[0].messages) === JSON.stringify([{ role: "user", content: "question 5" }, { role: "assistant", content: "answer 5" }]) &&
  Array.isArray(chatFile.profiles) && chatFile.profiles.length === 0 && !chatFileText.includes("sk-or-v1"), chatFileText.slice(0, 200));
check("export: status confirms the export", (await page.textContent("#chat-export-status")) === "Exported “Bulk chat 5” (2 messages).", await page.textContent("#chat-export-status"));
// Sharing one chat. Android refuses a shared .json file with "Permission
// denied", so the chat goes out as readable text, and anything the share
// sheet won't take lands on the clipboard instead.
const expectedShare = "# Bulk chat 5\n\n## You\n\nquestion 5\n\n## Assistant\n\nanswer 5\n";
await page.click("#share-chat");
await page.waitForFunction(() => window.__sharedData.length === 1);
const sharedChat = await page.evaluate(() => window.__sharedData[0]);
check("share: one chat is shared as readable text, not a json file", sharedChat.title === "Bulk chat 5" && sharedChat.text === expectedShare && sharedChat.files.length === 0, JSON.stringify(sharedChat).slice(0, 200));
check("share: status confirms", (await page.textContent("#chat-export-status")) === "Shared.", await page.textContent("#chat-export-status"));
await page.evaluate(() => { window.__shareError = new DOMException("Permission denied", "NotAllowedError"); navigator.clipboard.writeText("stale"); });
await page.click("#share-chat");
await page.waitForFunction(() => /copied to the clipboard/.test(document.getElementById("chat-export-status").textContent));
check("share: a refused share falls back to the clipboard", (await page.evaluate(() => navigator.clipboard.readText())) === expectedShare, await page.evaluate(() => navigator.clipboard.readText()));
check("share: the fallback is explained, not shown as an error", !(await page.$eval("#chat-export-status", e => e.classList.contains("error"))) && !(await page.textContent("#chat-export-status")).includes("Permission denied"), await page.textContent("#chat-export-status"));
await page.evaluate(() => { window.__shareError = new DOMException("cancelled", "AbortError"); navigator.clipboard.writeText("untouched"); document.getElementById("chat-export-status").textContent = ""; });
await page.click("#share-chat");
await page.waitForFunction(() => window.__sharedData.length === 3);
await page.waitForTimeout(150);
check("share: dismissing the share sheet copies nothing", (await page.evaluate(() => navigator.clipboard.readText())) === "untouched" && (await page.textContent("#chat-export-status")) === "");
await page.evaluate(() => { Object.defineProperty(navigator, "share", { configurable: true, value: undefined }); navigator.clipboard.writeText("stale"); });
check("share: the button is offered even without a share sheet", !(await page.$eval("#share-chat", b => b.hidden || b.disabled)));
await page.click("#share-chat");
await page.waitForFunction(() => /copied to the clipboard/.test(document.getElementById("chat-export-status").textContent));
check("share: with no share sheet the chat is copied", (await page.evaluate(() => navigator.clipboard.readText())) === expectedShare);
// A very long chat goes as a .txt file, which Android's share sheet accepts.
await page.evaluate(() => {
  window.__shareError = null;
  Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => {
    const files = [];
    for (const f of d.files || []) files.push([f.name, f.type, (await f.text()).length]);
    window.__sharedData.push({ title: d.title, text: d.text, files });
    if (window.__shareError) throw window.__shareError;
  } });
  const big = [{ role: "user", content: "long one" }, { role: "assistant", content: "x".repeat(120000) }];
  localStorage.setItem("orc_chat_bulk5", JSON.stringify(big));
});
await page.reload({ waitUntil: "load" });
await page.evaluate(() => {
  window.__sharedData = [];
  window.__shareError = null;
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => {
    const files = [];
    for (const f of d.files || []) files.push([f.name, f.type, (await f.text()).length]);
    window.__sharedData.push({ title: d.title, text: d.text, files });
    if (window.__shareError) throw window.__shareError;
  } });
});
await page.click("#open-settings");
await page.click("#share-chat");
await page.waitForFunction(() => window.__sharedData.length === 1);
const sharedBig = await page.evaluate(() => window.__sharedData[0]);
check("share: a very long chat goes as a plain-text file", sharedBig.text === undefined && sharedBig.files.length === 1 && /^openrouter-chat-bulk-chat-5-\d{4}-\d{2}-\d{2}\.txt$/.test(sharedBig.files[0][0]) && sharedBig.files[0][1] === "text/plain" && sharedBig.files[0][2] > 120000, JSON.stringify(sharedBig));
await page.evaluate((v) => localStorage.setItem("orc_chat_bulk5", v), JSON.stringify([{ role: "user", content: "question 5" }, { role: "assistant", content: "answer 5" }]));
await page.reload({ waitUntil: "load" });
// Sharing everything: the export goes as text/plain too, and a refusal downloads it.
await page.evaluate(() => {
  window.__sharedData = [];
  window.__shareError = null;
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => {
    const files = [];
    for (const f of d.files || []) files.push([f.name, f.type, await f.text()]);
    window.__sharedData.push({ title: d.title, text: d.text, files });
    if (window.__shareError) throw window.__shareError;
  } });
});
await page.click("#open-chats");
await page.evaluate(() => { document.getElementById("share-btn").hidden = false; });
await page.click("#share-btn");
await page.waitForFunction(() => window.__sharedData.length === 1);
const sharedAll = await page.evaluate(() => window.__sharedData[0]);
check("share: the full export is shared as a text file Android accepts", sharedAll.files.length === 1 && /^openrouter-chat-export-\d{4}-\d{2}-\d{2}\.txt$/.test(sharedAll.files[0][0]) && sharedAll.files[0][1] === "text/plain" && JSON.parse(sharedAll.files[0][2]).format === "openrouter-chat", JSON.stringify(sharedAll).slice(0, 200));
await page.evaluate(() => { window.__shareError = new DOMException("Permission denied", "NotAllowedError"); });
const [dlRefused] = await Promise.all([page.waitForEvent("download"), page.click("#share-btn")]);
check("share: a refused full export is downloaded instead", /\.json$/.test(dlRefused.suggestedFilename()) && (await page.textContent("#transfer-status")).includes("downloaded instead"), await page.textContent("#transfer-status"));
await page.setInputFiles("#import-file", { name: "shared.txt", mimeType: "text/plain", buffer: Buffer.from(sharedAll.files[0][2]) });
await page.waitForFunction(() => /^Imported/.test(document.getElementById("transfer-status").textContent));
check("share: a shared .txt export imports", /^Imported 0 chats, \d+ already here/.test(await page.textContent("#transfer-status")), await page.textContent("#transfer-status"));
check("share: the import picker accepts .txt", (await page.$eval("#import-file", e => e.accept)).includes(".txt"));
await page.click("#chats-overlay", { position: { x: 380, y: 400 } });
await page.click("#open-settings");
await page.click("#save-settings");
await page.click("#open-chats");
await page.setInputFiles("#import-file", { name: "one.json", mimeType: "application/json", buffer: Buffer.from(chatFileText) });
await page.waitForFunction(() => /^Imported/.test(document.getElementById("transfer-status").textContent));
check("export: a single-chat file imports cleanly", (await page.textContent("#transfer-status")) === "Imported 0 chats, 1 already here.", await page.textContent("#transfer-status"));
await page.evaluate((saved) => { localStorage.clear(); for (const [k, v] of Object.entries(JSON.parse(saved))) localStorage.setItem(k, v); }, savedStorage);
await page.reload({ waitUntil: "load" });


// Copilot on #20: with storage full, exports must still include the open
// chat's newest messages, which then exist only in memory.
await page.evaluate(() => localStorage.setItem("orc_model", "anthropic/claude-sonnet-4"));
await page.reload({ waitUntil: "load" });
await page.click("#open-chats");
await page.click("#new-chat-btn");
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "saved reply" }));
await page.fill("#composer", "saved question");
await page.click("#send-btn");
await page.waitForFunction(() => document.querySelectorAll(".msg.assistant .meta").length === 1);
const fullChatId = await page.evaluate(() => localStorage.getItem("orc_current_chat"));
await page.evaluate(() => {
  const real = Storage.prototype.setItem;
  window.__realSetItem = real;
  Storage.prototype.setItem = function (k, v) {
    if (String(k).startsWith("orc_chat")) throw new DOMException("Quota exceeded", "QuotaExceededError");
    return real.call(this, k, v);
  };
});
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "unsaved reply" }));
await page.fill("#composer", "unsaved question");
await page.click("#send-btn");
await page.waitForFunction(() => document.querySelectorAll(".msg.assistant .meta").length === 2);
check("export: storage-full warning shown", (await page.textContent("#messages")).includes("storage is full"));
check("export: setup has messages only in memory", (await page.evaluate((id) => JSON.parse(localStorage.getItem("orc_chat_" + id)).length, fullChatId)) === 2);
await page.click("#open-settings");
const [dlFull] = await Promise.all([page.waitForEvent("download"), page.click("#export-chat")]);
const fullChatFile = JSON.parse((await import("fs")).readFileSync(await dlFull.path(), "utf8"));
check("export: this-chat export includes unsaved messages", JSON.stringify(fullChatFile.chats[0].messages.map(m => m.content)) === JSON.stringify(["saved question", "saved reply", "unsaved question", "unsaved reply"]), JSON.stringify(fullChatFile.chats[0].messages.map(m => m.content)));
check("export: status count matches the file", (await page.textContent("#chat-export-status")).endsWith("(4 messages)."), await page.textContent("#chat-export-status"));
await page.click("#save-settings");
await page.click("#open-chats");
const [dlAllFull] = await Promise.all([page.waitForEvent("download"), page.click("#export-btn")]);
const allFullFile = JSON.parse((await import("fs")).readFileSync(await dlAllFull.path(), "utf8"));
const openInAll = allFullFile.chats.find(c => c.id === fullChatId);
check("export: full export includes the open chat's unsaved messages", openInAll && openInAll.messages.length === 4, JSON.stringify(openInAll && openInAll.messages.length));
await page.evaluate(() => { Storage.prototype.setItem = window.__realSetItem; });
await page.click("#chats-overlay", { position: { x: 380, y: 400 } });


// ---------- Dropped connections (backgrounded tab, flaky mobile network) ----------
const baseDevice = { orc_api_key: "sk-or-v1-test", orc_model: "anthropic/claude-sonnet-4" };
const takeDevice = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith("orc_")).map(k => [k, localStorage.getItem(k)])));
const putDevice = async (device) => {
  await page.evaluate((d) => {
    Object.keys(localStorage).filter(k => k.startsWith("orc_")).forEach(k => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
  }, device);
  await page.reload({ waitUntil: "load" });
};
const setHidden = (hidden) => page.evaluate((h) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
}, hidden);
const send = async (text) => { await page.fill("#composer", text); await page.click("#send-btn"); };
const idle = () => page.waitForFunction(() => !document.querySelector("#send-btn").classList.contains("stop"));

await page.evaluate(() => localStorage.clear());
await putDevice(baseDevice);
check("anon: the account library is never loaded while signed out", await page.evaluate(() => typeof window.Skapi === "undefined" && !document.querySelector('script[src*="skapi"]')));

// Dropped before any text: reconnects by itself, one clean reply.
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "drop" }, { kind: "ok", text: "recovered reply" }); });
await send("first drop");
await idle();
check("drop: reconnects by itself when nothing had arrived", (await page.$$(".msg.error")).length === 0 && (await page.textContent(".msg.assistant")).includes("recovered reply") && (await page.evaluate(() => window.__requests.length)) === 2, await page.textContent("#messages"));
check("drop: the retried turn is stored once", JSON.stringify((await curChat()).map(m => m.role)) === JSON.stringify(["user", "assistant"]) && !(await curChat())[1].interrupted, JSON.stringify(await curChat()));

// Dropped while in the background: waits for the foreground, then reconnects.
await setHidden(true);
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "drop" }, { kind: "ok", text: "after returning" }); });
await send("backgrounded");
await page.waitForFunction(() => /Reconnecting/.test((document.querySelector(".msg.assistant.generating") || {}).textContent || ""));
await page.waitForTimeout(1300);
check("drop: no reconnect attempt while the app is in the background", (await page.evaluate(() => window.__requests.length)) === 1 && await page.$eval("#send-btn", b => b.classList.contains("stop")));
await setHidden(false);
await idle();
check("drop: reconnects on returning to the foreground", (await page.evaluate(() => window.__requests.length)) === 2 && (await page.$$(".msg.error")).length === 0 && (await page.textContent("#messages")).includes("after returning") && !(await page.textContent("#messages")).includes("Reconnecting"), await page.textContent("#messages"));

// Stop while waiting to reconnect.
await setHidden(true);
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "drop" }); });
await send("stop me");
await page.waitForFunction(() => /Reconnecting/.test((document.querySelector(".msg.assistant.generating") || {}).textContent || ""));
await page.click("#send-btn");
await idle();
check("drop: Stop works while waiting to reconnect", (await page.textContent(".msg.error")).includes("Stopped before any reply arrived.") && (await page.evaluate(() => window.__requests.length)) === 1 && (await page.$$(".msg.assistant.generating")).length === 0, await page.textContent("#messages"));
await setHidden(false);

// It gives up after a few attempts, and the message is still there to retry.
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "drop" }, { kind: "drop" }, { kind: "drop" }, { kind: "ok", text: "finally" }); });
await page.click(".retry-btn");
await page.waitForSelector(".msg.error .retry-btn");
check("drop: gives up after repeated drops and says why", (await page.textContent(".msg.error")).includes("couldn't be restored") && (await page.evaluate(() => window.__requests.length)) === 3, await page.textContent(".msg.error"));
check("drop: the unanswered message is still saved", (await curChat()).pop().content === "stop me");
await page.click(".retry-btn");
await idle();
check("drop: Retry still works afterwards", (await page.textContent("#messages")).includes("finally") && (await page.$$(".msg.error")).length === 0);

// Dropped part-way: the text that arrived is kept, never thrown away.
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "drop-mid", text: "half an answer and " }); });
await send("cut me off");
await page.waitForSelector(".msg.error .retry-btn");
await idle();
let cut = await curChat();
check("drop: a partial reply is kept and marked interrupted", cut[cut.length - 1].role === "assistant" && cut[cut.length - 1].content === "half an answer and " && cut[cut.length - 1].interrupted === true, JSON.stringify(cut[cut.length - 1]));
check("drop: no second request is made once text has arrived", (await page.evaluate(() => window.__requests.length)) === 1);
check("drop: the footer and notice say what happened", (await page.$$eval(".msg.assistant .meta", els => els.pop().textContent)).includes("interrupted") && (await page.textContent(".msg.error")).includes("The part that arrived was kept") && (await page.$$eval(".msg.error .retry-btn", bs => bs.map(b => b.textContent))).join() === "Continue,Regenerate", await page.textContent(".msg.error"));
await page.reload({ waitUntil: "load" });
check("drop: the offer to continue or regenerate survives a reload", (await page.$$eval(".msg.error .retry-btn", bs => bs.map(b => b.textContent))).join() === "Continue,Regenerate");
const redoBtn = (label) => page.click('.msg.error .retry-btn:text-is("' + label + '")');
const lastMsg = async () => (await curChat()).pop();

// Continue: the partial reply is sent back with a note, and the new text is added to it.
const beforeRedo = (await curChat()).length;
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "ok", text: "the rest of it." }); });
await redoBtn("Continue");
await page.waitForFunction(() => document.querySelector("#messages").textContent.includes("the rest of it."));
await idle();
cut = await curChat();
check("continue: the new text is added to the part that had arrived", cut.length === beforeRedo && cut[cut.length - 1].content === "half an answer and the rest of it." && !cut[cut.length - 1].interrupted && cut[cut.length - 1].continued === true, JSON.stringify(cut.slice(-1)));
const contReq = await page.evaluate(() => window.__requests[0].messages.slice(-3));
check("continue: the request carries the partial reply and a note to carry on", contReq[0].role === "user" && contReq[0].content === "cut me off" && contReq[1].role === "assistant" && contReq[1].content === "half an answer and " && contReq[2].role === "user" && /Continue it from exactly where it stopped/.test(contReq[2].content), JSON.stringify(contReq));
check("continue: the note is never stored or shown", !JSON.stringify(cut).includes("cut off by a dropped connection") && !(await page.textContent("#messages")).includes("cut off by a dropped connection") && cut.every(m => m.role === "user" || m.role === "assistant"));
check("continue: no error is left and the footer says it was continued", (await page.$$(".msg.error")).length === 0 && (await page.$$eval(".msg.assistant .meta", els => els.pop().textContent)).includes("continued after a drop") && (await page.$$(".versions")).length === 0);

// A continuation that drops again keeps everything so far and can be continued again.
await page.evaluate(() => window.__scenarios.push({ kind: "drop-mid", text: "first part, " }));
await send("cut twice");
await page.waitForSelector(".msg.error .retry-btn");
await idle();
await page.evaluate(() => window.__scenarios.push({ kind: "drop-mid", text: "second part, " }));
await redoBtn("Continue");
await page.waitForFunction(() => document.querySelector("#messages").textContent.includes("second part,") && !!document.querySelector(".msg.error .retry-btn") && !document.querySelector("#send-btn").classList.contains("stop"));
check("continue: a second drop keeps both parts, still marked interrupted", (await lastMsg()).content === "first part, second part, " && (await lastMsg()).interrupted === true, JSON.stringify(await lastMsg()));

// A continuation that fails outright leaves the partial reply exactly as it was.
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "http", status: 500, message: "Upstream down" }); });
await redoBtn("Continue");
await page.waitForFunction(() => document.querySelector("#messages").textContent.includes("Upstream down"));
await idle();
check("continue: a failed attempt leaves the partial reply untouched", (await lastMsg()).content === "first part, second part, " && (await lastMsg()).interrupted === true && (await page.textContent("#messages")).includes("first part, second part,") && (await page.$$eval(".msg.error .retry-btn", bs => bs.map(b => b.textContent))).join() === "Continue,Regenerate", await page.textContent("#messages"));
await page.reload({ waitUntil: "load" });
check("continue: and it is still there after a reload", (await lastMsg()).content === "first part, second part, " && (await page.textContent("#messages")).includes("first part, second part,"));

// Regenerate: a fresh reply, with the cut-off one kept as an earlier version.
const beforeRegen = (await curChat()).length;
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "ok", text: "the whole answer" }); });
await redoBtn("Regenerate");
await page.waitForFunction(() => document.querySelector("#messages").textContent.includes("the whole answer"));
await idle();
cut = await curChat();
check("drop: Regenerate replaces the partial reply", cut.length === beforeRegen && cut[cut.length - 1].content === "the whole answer" && !cut[cut.length - 1].interrupted && !(await page.textContent("#messages")).includes("first part"), JSON.stringify(cut.slice(-2)));
check("drop: Regenerate does not send the partial reply back", !JSON.stringify(await page.evaluate(() => window.__requests[0].messages)).includes("first part"));
check("regenerate: the cut-off reply is kept as an earlier version", cut[cut.length - 1].versions.length === 2 && cut[cut.length - 1].v === 1 && cut[cut.length - 1].versions[0].content === "first part, second part, " && cut[cut.length - 1].versions[0].interrupted === true && (await page.textContent(".versions")) === "‹2/2›", JSON.stringify(cut[cut.length - 1].versions));
await page.click('.versions button[aria-label="Earlier version"]');
await page.waitForFunction(() => document.querySelector(".versions").textContent === "‹1/2›");
check("regenerate: stepping back shows the earlier version and offers to continue it", (await lastMsg()).content === "first part, second part, " && (await lastMsg()).v === 0 && (await page.textContent("#messages")).includes("first part, second part,") && !(await page.textContent("#messages")).includes("the whole answer") && (await page.$$(".msg.error .retry-btn")).length === 2);
// Continuing the earlier version lengthens that version and leaves the other alone.
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "third part." }));
await redoBtn("Continue");
await page.waitForFunction(() => document.querySelector("#messages").textContent.includes("third part."));
await idle();
let ver = await lastMsg();
check("regenerate: continuing an earlier version keeps the other version", ver.content === "first part, second part, third part." && ver.v === 0 && ver.versions.length === 2 && ver.versions[0].content === ver.content && ver.versions[1].content === "the whole answer", JSON.stringify(ver.versions.map(v => v.content)));
await page.click('.versions button[aria-label="Later version"]');
await page.waitForFunction(() => document.querySelector(".versions").textContent === "‹2/2›");
check("regenerate: stepping forward returns to the newer version", (await lastMsg()).content === "the whole answer" && (await page.$$(".msg.error")).length === 0);
await page.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "ok", text: "next" }); });
await send("and then?");
await idle();
const nextReq = JSON.stringify(await page.evaluate(() => window.__requests[0].messages));
check("regenerate: only the shown version is sent on", !nextReq.includes("first part") && nextReq.includes("the whole answer"), nextReq.slice(-300));

// A dropped image request is not retried (it may have been billed), but is explained.
await page.evaluate(() => { localStorage.setItem("__imgMode", "on"); localStorage.setItem("orc_model", "acme/pixel-1"); });
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("composer").placeholder === "Describe an image…");
await page.evaluate(() => { localStorage.setItem("__imgMode", "drop"); window.__imgRequests = []; });
await send("a picture");
await page.waitForSelector(".msg.error .retry-btn");
check("drop: a dropped image request is explained and not retried by itself", (await page.textContent(".msg.error")).includes("may still have been generated and billed") && (await page.evaluate(() => window.__imgRequests.length)) === 1, await page.textContent(".msg.error"));
await page.evaluate(() => { localStorage.removeItem("__imgMode"); localStorage.removeItem("orc_image_models"); });

// ---------- Text selection ----------
await putDevice({ ...baseDevice, orc_chats: JSON.stringify([{ id: "sel1", title: "Selection", created: 1, updated: 1, model: "m/x", count: 2 }]), orc_current_chat: "sel1",
  orc_chat_sel1: JSON.stringify([{ role: "user", content: "pick part of this" }, { role: "assistant", content: "Alpha beta gamma.\n\n```js\nlet x = 1;\n```", model: "m/x", usage: { prompt_tokens: 3, completion_tokens: 4 } }]) });
const sel = await page.evaluate(() => {
  const us = (q) => getComputedStyle(document.querySelector(q)).userSelect;
  const msg = document.querySelector(".msg.assistant");
  const s = window.getSelection();
  s.selectAllChildren(msg);
  const whole = s.toString();
  s.removeAllRanges();
  return { msg: us(".msg.assistant"), user: us(".msg.user"), actions: us(".msg-actions"), copy: us(".copy-btn"), head: us(".codeblock-head"), header: us("header"), whole };
});
check("select: message text is selectable, the controls around it are not", sel.msg === "text" && sel.user === "text" && sel.actions === "none" && sel.copy === "none" && sel.head === "none" && sel.header === "none", JSON.stringify(sel));
check("select: selecting a whole bubble takes its text only", sel.whole.includes("Alpha beta gamma.") && sel.whole.includes("let x = 1;") && !sel.whole.includes("tokens") && !sel.whole.includes("Copy"), JSON.stringify(sel.whole));

// ---------- Optional account and sync ----------
const dev = (chatMap, extra = {}) => {
  const d = { ...baseDevice, ...extra };
  const index = [];
  for (const [id, c] of Object.entries(chatMap)) {
    index.push({ id, title: c.title || id, created: c.updated || 1000, updated: c.updated || 1000, model: "m/x", count: c.messages.length });
    d["orc_chat_" + id] = JSON.stringify(c.messages);
  }
  d.orc_chats = JSON.stringify(index);
  return d;
};
const qa = (...texts) => texts.map((t, i) => ({ role: i % 2 ? "assistant" : "user", content: t }));
const remoteDb = () => page.evaluate(() => JSON.parse(localStorage.getItem("__skapi_db") || "null"));
const remoteChats = async (userId) => Object.fromEntries((await remoteDb()).records.filter(r => r.user_id === userId).map(r => [r.data.id, r.data]));
const localChats = () => page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("orc_chats") || "[]").map(c => [c.id, { title: c.title, messages: JSON.parse(localStorage.getItem("orc_chat_" + c.id) || "[]") }])));
const texts = (c) => c ? c.messages.map(m => m.content).join("|") : "(missing)";
const cloudStatus = () => page.textContent("#cloud-status");
const synced = () => page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent));
const openSettings = async () => { if (!(await page.$eval("#settings-overlay", e => e.classList.contains("open")))) await page.click("#open-settings"); };
const signIn = async (email, password, create) => {
  await openSettings();
  if (create) await page.click("#cloud-toggle");
  await page.fill("#cloud-email", email);
  await page.fill("#cloud-password", password);
  await page.click("#cloud-submit");
};
const syncNow = async () => {
  await openSettings();
  await page.click("#cloud-sync-now");
  await page.waitForFunction(() => !document.getElementById("cloud-sync-now").disabled && /^(Synced at|Couldn't sync)/.test(document.getElementById("cloud-status").textContent));
};

// Upgrading: chats written by the previous version are untouched, and
// nothing about accounts happens until someone signs in.
const deviceA0 = dev({ a1: { messages: qa("a1 q", "a1 a"), updated: 1000 }, a2: { messages: qa("a2 q", "a2 a"), updated: 2000 } }, { orc_current_chat: "a2" });
await page.evaluate(() => localStorage.setItem("__skapiFake", "1"));
await putDevice(deviceA0);
await page.waitForTimeout(300);
// The chat keys, byte for byte, in a fixed order (other keys are caches).
const chatBytes = (d) => JSON.stringify(Object.entries(d).filter(([k]) => /^orc_(chats$|chat_|current_chat$)/.test(k)).sort());
check("sync: an upgrade leaves existing chats exactly as they were", chatBytes(await takeDevice()) === chatBytes(deviceA0), chatBytes(await takeDevice()));
check("sync: no account keys are written while signed out", !Object.keys(await takeDevice()).some(k => k.startsWith("orc_cloud")));
check("sync: nothing is sent anywhere while signed out", (await page.evaluate(() => window.__skapiCalls.length)) === 0 && (await remoteDb()) === null);
await openSettings();
check("sync: signed out shows the sign-in form and the local-only note", !(await page.$eval("#cloud-signed-out", e => e.hidden)) && (await page.$eval("#cloud-signed-in", e => e.hidden)) && (await page.textContent("#storage-status")) === "Settings and history are saved on this device only.");

// A failed sign-in changes nothing.
await signIn("nobody@example.com", "wrong-password");
await page.waitForFunction(() => document.getElementById("cloud-status").classList.contains("error"));
check("sync: a failed sign-in is reported and leaves everything alone", (await cloudStatus()) === "Incorrect username or password." && chatBytes(await takeDevice()) === chatBytes(deviceA0) && !(await page.$eval("#cloud-signed-out", e => e.hidden)), await cloudStatus());

// First sign-in: this device's chats go up to the account.
await signIn("kat@example.com", "secret-one", true);
await synced();
let remote = await remoteChats("user-1");
check("sync: first sign-in uploads the chats already on the device", texts(remote.a1) === "a1 q|a1 a" && texts(remote.a2) === "a2 q|a2 a" && Object.keys(remote).length === 2, JSON.stringify(remote));
check("sync: local chats are unchanged by the first sign-in", texts((await localChats()).a1) === "a1 q|a1 a" && texts((await localChats()).a2) === "a2 q|a2 a" && Object.keys(await localChats()).length === 2);
check("sync: status and storage note reflect the account", (await cloudStatus()).includes("2 chats uploaded") && (await page.textContent("#cloud-who")) === "Signed in as kat@example.com." && (await page.textContent("#storage-status")).includes("sync to your account"), await cloudStatus());
const firstRecords = (await remoteDb()).records;
check("sync: records are private and keyed by user and chat", firstRecords.every(r => r.table.name === "orc_chats" && r.table.access_group === "private" && r.unique_id === "orc:user-1:" + r.data.id), JSON.stringify(firstRecords.map(r => [r.table, r.unique_id])));
check("sync: the OpenRouter key and settings are never uploaded", !JSON.stringify(await remoteDb()).includes("sk-or-v1") && !JSON.stringify(await remoteDb()).includes("claude-sonnet-4"));
check("sync: it uses the shared Skapi project", (await page.evaluate(() => window.__skapiProject)) === "5GJ5SJePWQUiq0jvYr-2ZVgaOLUqOhnse3Hcl8M4d");

// A new message is uploaded shortly after, without asking.
await page.click("#save-settings");
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "a2 more a" }));
await send("a2 more q");
await page.waitForFunction(() => { const db = JSON.parse(localStorage.getItem("__skapi_db")); const r = db.records.find(r => r.data.id === "a2"); return r && r.data.messages.length === 4; }, null, { timeout: 15000 });
check("sync: a new reply is uploaded automatically", texts((await remoteChats("user-1")).a2) === "a2 q|a2 a|a2 more q|a2 more a");
await page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent));
const deviceA1 = await takeDevice();

// A second device with its own chat: signing in merges both ways.
await putDevice(dev({ b1: { messages: qa("b1 q", "b1 a"), updated: 3000 } }));
check("sync: a second device starts signed out", !(await page.$eval("#cloud-signed-out", e => e.hidden)) && (await page.evaluate(() => window.__skapiCalls.length)) === 0);
await page.evaluate(() => localStorage.setItem("__skapiPage", "2"));   // small pages, to exercise paging
await signIn("kat@example.com", "secret-one");
await synced();
await page.evaluate(() => localStorage.removeItem("__skapiPage"));
let local = await localChats();
check("sync: a second device downloads the account's chats (across pages)", texts(local.a1) === "a1 q|a1 a" && texts(local.a2) === "a2 q|a2 a|a2 more q|a2 more a" && texts(local.b1) === "b1 q|b1 a" && Object.keys(local).length === 3, JSON.stringify(local));
check("sync: and uploads its own chat", texts((await remoteChats("user-1")).b1) === "b1 q|b1 a");
check("sync: downloaded chats show in the list", await (async () => { await page.click("#save-settings"); await page.click("#open-chats"); const t = await page.$$eval(".chat-title", els => els.map(e => e.textContent)); await page.click("#chats-overlay", { position: { x: 380, y: 400 } }); return t.includes("a1") && t.includes("a2") && t.includes("b1"); })());

// Continue a chat on device B; device A, which hasn't touched it, catches up.
await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("a1")) .chat-open');
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "a1 from B a" }));
await send("a1 from B q");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("__skapi_db")).records.find(r => r.data.id === "a1").data.messages.length === 4, null, { timeout: 15000 });
await page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent));
const deviceB1 = await takeDevice();
await putDevice(deviceA1);
await page.waitForFunction(() => JSON.parse(localStorage.getItem("orc_chat_a1") || "[]").length === 4 && !!localStorage.getItem("orc_chat_b1"));
check("sync: a chat continued elsewhere is brought up to date on reload", texts((await localChats()).a1) === "a1 q|a1 a|a1 from B q|a1 from B a" && texts((await localChats()).b1) === "b1 q|b1 a");
await synced();

// The open chat is refreshed on screen when it changes underneath.
await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("a1")) .chat-open');
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("__skapi_db"));
  const r = db.records.find(r => r.data.id === "a1");
  r.data.messages.push({ role: "user", content: "a1 live q" }, { role: "assistant", content: "a1 live a" });
  r.data.updated = Date.now(); r.updated = db.clock = Math.max(Date.now(), db.clock + 1);
  localStorage.setItem("__skapi_db", JSON.stringify(db));
});
await syncNow();
check("sync: the open chat updates on screen", (await page.textContent("#messages")).includes("a1 live a") && (await page.$$(".msg.assistant")).length === 3, await page.textContent("#messages"));
await page.click("#save-settings");

// Sync failing: nothing is lost, it says so, and it recovers.
await page.evaluate(() => { localStorage.setItem("__skapiDown", "1"); window.__scenarios.push({ kind: "ok", text: "a2 offline A a" }); });
await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("a2")) .chat-open');
await send("a2 offline A q");
await idle();
await page.waitForFunction(() => /^Couldn't sync/.test(document.getElementById("cloud-status").textContent), null, { timeout: 15000 });
check("sync: a failed sync keeps the chat on the device and says so", texts((await localChats()).a2) === "a2 q|a2 a|a2 more q|a2 more a|a2 offline A q|a2 offline A a" && (await cloudStatus()).includes("safe on this device") && await page.$eval("#cloud-status", e => e.classList.contains("error")), await cloudStatus());
check("sync: still signed in after a network failure", !(await page.$eval("#cloud-signed-in", e => e.hidden)));
const deviceA2 = await takeDevice();   // holds a change to a2 that never reached the account

// Meanwhile device B changes the same chat differently.
await page.evaluate(() => localStorage.removeItem("__skapiDown"));
await putDevice(deviceB1);
await synced();
await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("a2")) .chat-open');
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "a2 from B a" }));
await send("a2 from B q");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("__skapi_db")).records.find(r => r.data.id === "a2").data.messages.length === 6, null, { timeout: 15000 });
await page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent));
const deviceB2 = await takeDevice();

// Back on A: both versions must survive.
await putDevice(deviceA2);
await page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent) && JSON.parse(localStorage.getItem("orc_chats")).length === 4, null, { timeout: 15000 });
local = await localChats();
const copyEntry = Object.entries(local).find(([, c]) => c.title.endsWith("(this device's copy)"));
check("sync: a chat changed in two places keeps both versions", texts(local.a2) === "a2 q|a2 a|a2 more q|a2 more a|a2 from B q|a2 from B a" && !!copyEntry && texts(copyEntry[1]) === "a2 q|a2 a|a2 more q|a2 more a|a2 offline A q|a2 offline A a", JSON.stringify(Object.fromEntries(Object.entries(local).map(([k, c]) => [k, c.title + ": " + texts(c)]))));
check("sync: the conflict is explained", (await cloudStatus()).includes("changed in two places, so both versions were kept"), await cloudStatus());
check("sync: the reader stays on the version they were looking at", (await page.evaluate(() => localStorage.getItem("orc_current_chat"))) === copyEntry[0] && (await page.textContent("#messages")).includes("a2 offline A a"));
remote = await remoteChats("user-1");
check("sync: the kept copy is uploaded too", texts(remote[copyEntry[0]]) === texts(copyEntry[1]) && texts(remote.a2).endsWith("a2 from B a"), JSON.stringify(Object.keys(remote)));

// A record the listing missed (index lag) is merged, never overwritten.
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("__skapi_db"));
  db.clock = Math.max(Date.now(), db.clock + 1);
  db.records.push({ record_id: "lagged", unique_id: "orc:user-1:lag1", user_id: "user-1", table: { name: "orc_chats", access_group: "private" },
    data: { v: 1, id: "lag1", title: "lag1", created: 1, updated: 1, model: "", messages: [{ role: "user", content: "lag remote q" }, { role: "assistant", content: "lag remote a" }] }, updated: db.clock, uploaded: db.clock });
  localStorage.setItem("__skapi_db", JSON.stringify(db));
  localStorage.setItem("__skapiLag", "lag1");
  const index = JSON.parse(localStorage.getItem("orc_chats"));
  index.push({ id: "lag1", title: "lag1", created: 5, updated: 5, model: "", count: 2 });
  localStorage.setItem("orc_chats", JSON.stringify(index));
  localStorage.setItem("orc_chat_lag1", JSON.stringify([{ role: "user", content: "lag local q" }, { role: "assistant", content: "lag local a" }]));
});
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => JSON.parse(localStorage.getItem("orc_chats")).some(c => c.id !== "lag1" && c.title === "lag1 (this device's copy)"), null, { timeout: 15000 });
await page.evaluate(() => localStorage.removeItem("__skapiLag"));
await page.waitForFunction(() => JSON.parse(localStorage.getItem("__skapi_db")).records.some(r => r.data.title === "lag1 (this device's copy)"), null, { timeout: 15000 });
local = await localChats();
remote = await remoteChats("user-1");
const lagCopy = Object.values(local).find(c => c.title === "lag1 (this device's copy)");
check("sync: an unseen account copy is merged rather than overwritten", texts(remote.lag1) === "lag remote q|lag remote a" && texts(local.lag1) === "lag remote q|lag remote a" && texts(lagCopy) === "lag local q|lag local a", JSON.stringify([texts(remote.lag1), texts(local.lag1), texts(lagCopy)]));
await synced();

// Deleting a chat reaches the other device, and doesn't come back.
await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("b1")) .chat-delete');
await page.click("#chats-overlay", { position: { x: 380, y: 400 } });
await page.waitForFunction(() => JSON.parse(localStorage.getItem("__skapi_db")).records.find(r => r.data.id === "b1").data.deleted === true, null, { timeout: 15000 });
await page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent));
await page.reload({ waitUntil: "load" });
await synced();
check("sync: a deleted chat stays deleted on the device that deleted it", !(await localChats()).b1 && (await remoteChats("user-1")).b1.deleted === true);
const deviceA3 = await takeDevice();
await putDevice(deviceB2);
await page.waitForFunction(() => /^Synced at/.test(document.getElementById("cloud-status").textContent) && !localStorage.getItem("orc_chat_b1"), null, { timeout: 15000 });
check("sync: a delete reaches the other device", !(await localChats()).b1 && (await cloudStatus()).includes("deleted on another device"), await cloudStatus());
check("sync: the other device also receives the conflict copy", Object.values(await localChats()).some(c => c.title === "a2 (this device's copy)"));

// But a chat with changes that were never uploaded outranks a delete made elsewhere.
await page.evaluate(() => { localStorage.setItem("__skapiDown", "1"); window.__scenarios.push({ kind: "ok", text: "a1 kept a" }); });
await page.click("#open-chats");
await page.click('.chat-row:has(.chat-title:text-is("a1")) .chat-open');
await send("a1 kept q");
await idle();
await page.waitForFunction(() => /^Couldn't sync/.test(document.getElementById("cloud-status").textContent), null, { timeout: 15000 });
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("__skapi_db"));
  const r = db.records.find(r => r.data.id === "a1");
  r.data = { v: 1, id: "a1", deleted: true, updated: Date.now() };
  r.updated = db.clock = Math.max(Date.now(), db.clock + 1);
  localStorage.setItem("__skapi_db", JSON.stringify(db));
  localStorage.removeItem("__skapiDown");
});
await syncNow();
check("sync: unsynced changes outrank a delete made elsewhere", texts((await localChats()).a1).endsWith("a1 kept q|a1 kept a") && texts((await remoteChats("user-1")).a1).endsWith("a1 kept q|a1 kept a"), JSON.stringify([texts((await localChats()).a1), JSON.stringify((await remoteChats("user-1")).a1).slice(0, 120)]));

// Signing out keeps every chat on the device and stops all traffic.
const beforeSignOut = await localChats();
await page.click("#cloud-sign-out");
await page.waitForFunction(() => /^Signed out/.test(document.getElementById("cloud-status").textContent));
check("sync: signing out keeps the chats on the device", JSON.stringify(await localChats()) === JSON.stringify(beforeSignOut) && (await page.evaluate(() => localStorage.getItem("orc_cloud_user"))) === null && !(await page.$eval("#cloud-signed-out", e => e.hidden)));
await page.reload({ waitUntil: "load" });
await page.evaluate(() => window.__scenarios.push({ kind: "ok", text: "signed out a" }));
await page.click("#open-chats");
await page.click("#new-chat-btn");
await send("signed out q");
await idle();
await page.waitForTimeout(3600);
check("sync: chats survive a reload after signing out, and nothing is uploaded", JSON.stringify(Object.keys(await localChats()).sort()).includes("a1") && (await page.evaluate(() => window.__skapiCalls.length)) === 0 && !JSON.stringify(await remoteDb()).includes("signed out q"));

// Signing back in picks up where it left off, including the chat made while signed out.
await signIn("kat@example.com", "secret-one");
await synced();
check("sync: a chat made while signed out is uploaded on the next sign-in", JSON.stringify(await remoteChats("user-1")).includes("signed out q"));

// The session ending (expired or revoked) loses nothing.
const beforeExpiry = await localChats();
await page.evaluate(() => { const db = JSON.parse(localStorage.getItem("__skapi_db")); db.session = null; localStorage.setItem("__skapi_db", JSON.stringify(db)); });
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => /expired/.test(document.getElementById("cloud-status").textContent));
await openSettings();
check("sync: an expired session keeps every chat and asks to sign in again", JSON.stringify(await localChats()) === JSON.stringify(beforeExpiry) && !(await page.$eval("#cloud-signed-out", e => e.hidden)) && (await page.$eval("#cloud-email", e => e.value)) === "kat@example.com" && (await cloudStatus()).includes("still on this device"), await cloudStatus());
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => /expired/.test(document.getElementById("cloud-status").textContent));
check("sync: the chats are still there on the next load too", JSON.stringify(await localChats()) === JSON.stringify(beforeExpiry) && (await page.$$(".msg")).length > 0);

// Forgotten password: code by email, new password, sign in.
await openSettings();
await page.click("#cloud-forgot");
check("sync: forgot password asks only for the email", (await page.$eval("#cloud-password", e => e.hidden)) && (await page.textContent("#cloud-submit")) === "Email me a code");
await page.fill("#cloud-email", "kat@example.com");
await page.click("#cloud-submit");
await page.waitForFunction(() => document.getElementById("cloud-submit").textContent === "Set new password");
await page.fill("#cloud-code", "246810");
await page.fill("#cloud-password", "secret-two");
await page.click("#cloud-submit");
await page.waitForFunction(() => /Password changed/.test(document.getElementById("cloud-status").textContent));
await signIn("kat@example.com", "secret-two");
await synced();
check("sync: a reset password signs in and syncs again", !(await page.$eval("#cloud-signed-in", e => e.hidden)) && JSON.stringify(await localChats()) === JSON.stringify(beforeExpiry));

// Another person signing in on this device: their account gets this
// device's chats; the first account is not touched.
const kat = JSON.stringify(await remoteChats("user-1"));
await page.click("#cloud-sign-out");
await page.waitForFunction(() => /^Signed out/.test(document.getElementById("cloud-status").textContent));
await signIn("richard@example.com", "secret-three", true);
await synced();
const richard = await remoteChats("user-2");
check("sync: a different account receives this device's chats", Object.keys(richard).length === Object.keys(await localChats()).length && Object.keys(richard).length > 3, JSON.stringify(Object.keys(richard)));
check("sync: and the first account is untouched", JSON.stringify(await remoteChats("user-1")) === kat);
const everything = JSON.stringify(Object.values(await localChats()));
check("sync: no chat was lost along the way", ["a2 offline A a", "a2 from B a", "a1 kept a", "lag local a", "lag remote a", "signed out a"].every(t => everything.includes(t)), everything.slice(0, 300));

// ---------- Profiles sync ----------
const remoteProfiles = async (userId) => ((await remoteDb()).records.find(r => r.user_id === userId && r.data.kind === "profiles") || { data: null }).data;
const localProfiles = () => page.evaluate(() => JSON.parse(localStorage.getItem("orc_profiles") || "[]"));
check("profiles: nothing is uploaded while there are no profiles", (await remoteProfiles("user-2")) === null);
const mkProfile = (id, name, updated, extra = {}) => ({ id, name, model: "a/b", systemPrompt: "prompt of " + name, filters: {}, includes: { model: true, prompt: true, filters: false }, isDefault: false, created: 1, updated, ...extra });
await page.evaluate((list) => localStorage.setItem("orc_profiles", JSON.stringify(list)), [mkProfile("p1", "Coder", 100, { isDefault: true }), mkProfile("p2", "Poet", 100)]);
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => JSON.parse(localStorage.getItem("__skapi_db")).records.some(r => r.data.kind === "profiles" && r.data.profiles.length === 2), null, { timeout: 15000 });
await synced();
let rp = await remoteProfiles("user-2");
check("profiles: profiles are uploaded, in a private record of their own", rp.profiles.map(p => p.name).join() === "Coder,Poet" && rp.profiles[0].isDefault === true && (await remoteDb()).records.find(r => r.data.kind === "profiles").unique_id === "orc:user-2:~profiles" && (await cloudStatus()).includes("profiles brought up to date"), JSON.stringify(rp));
check("profiles: the key is still not uploaded", !JSON.stringify(await remoteDb()).includes("sk-or-v1"));
const profDevice1 = await takeDevice();

// A second device receives them, default star included.
await putDevice(dev({}));
await signIn("richard@example.com", "secret-three");
await synced();
let lp = await localProfiles();
check("profiles: a second device receives the profiles and the default", lp.map(p => p.name).sort().join() === "Coder,Poet" && lp.find(p => p.name === "Coder").isDefault === true && lp.find(p => p.name === "Poet").systemPrompt === "prompt of Poet", JSON.stringify(lp));
check("profiles: they appear in the picker", (await page.$$eval("#profile-select option", os => os.map(o => o.textContent))).join("|") === "No profile|★ Coder|Poet");

// Device 2 deletes one and edits the other; device 1 follows.
await page.selectOption("#profile-select", "p2");
await page.click("#profile-delete");
await page.selectOption("#profile-select", "p1");
await page.fill("#system-prompt", "edited on device two");
await page.click("#profile-update");
await page.click("#profile-save");
await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem("__skapi_db")).records.find(r => r.data.kind === "profiles"); return r.data.profiles.length === 1 && r.data.profiles[0].systemPrompt === "edited on device two" && typeof r.data.gone.p2 === "number"; }, null, { timeout: 15000 });
check("profiles: a delete and an edit are uploaded", true);
// Meanwhile device 1 (not yet synced) adds a profile of its own.
profDevice1.orc_profiles = JSON.stringify([...JSON.parse(profDevice1.orc_profiles), mkProfile("p3", "Analyst", Date.now())]);
await putDevice(profDevice1);
await page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem("orc_profiles") || "[]"); return l.length === 2 && !l.some(p => p.id === "p2"); }, null, { timeout: 15000 });
await page.waitForFunction(() => JSON.parse(localStorage.getItem("__skapi_db")).records.find(r => r.data.kind === "profiles").data.profiles.length === 2, null, { timeout: 15000 });
lp = await localProfiles();
rp = await remoteProfiles("user-2");
check("profiles: the other device gets the edit and the delete, and keeps its own new profile", lp.find(p => p.id === "p1").systemPrompt === "edited on device two" && !lp.some(p => p.id === "p2") && lp.some(p => p.id === "p3"), JSON.stringify(lp.map(p => [p.id, p.systemPrompt])));
check("profiles: the merged set is what the account holds", rp.profiles.map(p => p.id).sort().join() === "p1,p3" && typeof rp.gone.p2 === "number", JSON.stringify(rp));
check("profiles: chats were not disturbed", Object.keys(await remoteChats("user-2")).filter(k => k !== "undefined").length > 3);

// Import brings profiles to a fresh device (never the default star: a file can't change that).
await putDevice(baseDevice);
await page.click("#open-chats");
await page.setInputFiles("#import-file", { name: "p.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "openrouter-chat", version: 1, chats: [], profiles: [mkProfile("i1", "Imported one", 5, { isDefault: true }), mkProfile("i2", "Imported two", 5, { isDefault: true })] })) });
await page.waitForFunction(() => /^Imported/.test(document.getElementById("transfer-status").textContent));
lp = await localProfiles();
check("profiles: import brings profiles to a fresh device", lp.length === 2 && lp.filter(p => p.isDefault).length === 0 && lp[1].systemPrompt === "prompt of Imported two" && (await page.textContent("#transfer-status")).includes("2 profiles"), JSON.stringify(lp.map(p => [p.name, p.isDefault])));
await page.click("#chats-overlay", { position: { x: 380, y: 400 } });

// ---------- Encrypted key sync (opt-in) ----------
const keyRecord = async () => ((await remoteDb()).records.find(r => r.user_id === "user-2" && r.data.kind === "key") || { data: null }).data;
const waitKey = (pred) => page.waitForFunction((src) => { const r = JSON.parse(localStorage.getItem("__skapi_db")).records.find(r => r.user_id === "user-2" && r.data.kind === "key"); return new Function("d", "return " + src)(r ? r.data : null); }, pred, { timeout: 15000 });
const localKey = () => page.evaluate(() => localStorage.getItem("orc_api_key"));
await putDevice(baseDevice);
await signIn("richard@example.com", "secret-three");
await synced();
check("key: nothing about the key is uploaded unless asked", (await keyRecord()) === null && !(await page.$eval("#cloud-key-sync", e => e.checked)) && (await page.textContent("#cloud-key-hint")).startsWith("Off"));
const kek = await page.evaluate(() => localStorage.getItem("orc_cloud_kek"));
check("key: the password is not kept, only a key derived from it", !!kek && kek.length === 44 && !JSON.stringify(await takeDevice()).includes("secret-three"));
await page.check("#cloud-key-sync");
await waitKey("d && typeof d.ct === 'string'");
await synced();
let kr = await keyRecord();
check("key: ticking the box uploads only ciphertext", typeof kr.iv === "string" && typeof kr.ct === "string" && !kr.removed && !JSON.stringify(await remoteDb()).includes("sk-or-v1") && !JSON.stringify(kr).includes(kek) && (await remoteDb()).records.find(r => r.data.kind === "key").unique_id === "orc:user-2:~key", JSON.stringify(kr));
check("key: the status says so", (await cloudStatus()).includes("encrypted key uploaded") && (await page.textContent("#cloud-key-hint")).startsWith("On."), await cloudStatus());
const keyDevice1 = await takeDevice();

// A new device with no key: signing in is enough.
await putDevice({ orc_model: "anthropic/claude-sonnet-4" });
check("key: a fresh device starts without a key", (await localKey()) === null && await page.$eval("#composer", e => e.disabled));
await signIn("richard@example.com", "secret-three");
await synced();
check("key: signing in on a new device brings the key", (await localKey()) === "sk-or-v1-test" && !(await page.$eval("#composer", e => e.disabled)) && (await cloudStatus()).includes("OpenRouter key received") && await page.$eval("#cloud-key-sync", e => e.checked) && (await page.$eval("#api-key", e => e.value)) === "sk-or-v1-test", await cloudStatus());

// Changing the key here reaches the other device, which had not changed its own.
const firstCt = (await keyRecord()).ct;
await page.fill("#api-key", "sk-or-v1-rotated");
await page.click("#save-settings");
await waitKey("d && d.ct !== " + JSON.stringify(firstCt));
check("key: a changed key is uploaded, still as ciphertext", !JSON.stringify(await remoteDb()).includes("sk-or-v1"));
const keyDevice2 = await takeDevice();
await putDevice(keyDevice1);
await page.waitForFunction(() => localStorage.getItem("orc_api_key") === "sk-or-v1-rotated", null, { timeout: 15000 });
check("key: the other device takes up the changed key", (await localKey()) === "sk-or-v1-rotated");

// Forgetting the key on a device sticks, and does not remove it elsewhere.
await synced();
await openSettings();
await page.click("#forget-key");
await syncNow();
check("key: a forgotten key does not come back by itself", (await localKey()) === null && !(await page.$eval("#cloud-key-sync", e => e.checked)) && !(await keyRecord()).removed);
await page.check("#cloud-key-sync");
await page.waitForFunction(() => localStorage.getItem("orc_api_key") === "sk-or-v1-rotated", null, { timeout: 15000 });
check("key: ticking the box again brings it back", (await localKey()) === "sk-or-v1-rotated");

// After a password reset the old copy can't be read; nothing breaks, and a fresh upload fixes it.
await synced();
await page.evaluate(() => { const db = JSON.parse(localStorage.getItem("__skapi_db")); db.users["richard@example.com"].password = "secret-four"; localStorage.setItem("__skapi_db", JSON.stringify(db)); });
await putDevice({ orc_model: "anthropic/claude-sonnet-4" });
await signIn("richard@example.com", "secret-four");
await synced();
check("key: a copy encrypted with an old password is reported, not adopted", (await localKey()) === null && (await cloudStatus()).includes("earlier password") && await page.$eval("#cloud-status", e => e.classList.contains("error")), await cloudStatus());
await page.fill("#api-key", "sk-or-v1-retyped");
await page.dispatchEvent("#api-key", "change");
await page.click("#save-settings");
await openSettings();
const staleCt = (await keyRecord()).ct;
await page.check("#cloud-key-sync");
await waitKey("d && d.ct !== " + JSON.stringify(staleCt));
await synced();
await putDevice({ orc_model: "anthropic/claude-sonnet-4" });
await signIn("richard@example.com", "secret-four");
await synced();
check("key: re-entering it uploads a copy the new password can read", (await localKey()) === "sk-or-v1-retyped");

// Turning it off removes the encrypted copy from the account and keeps the key here.
await page.uncheck("#cloud-key-sync");
await waitKey("d && d.removed === true");
await synced();
kr = await keyRecord();
check("key: turning it off removes the copy from the account, not from the device", kr.removed === true && kr.ct === undefined && (await localKey()) === "sk-or-v1-retyped" && (await cloudStatus()).includes("removed from your account"), JSON.stringify(kr));
await putDevice({ orc_model: "anthropic/claude-sonnet-4" });
await signIn("richard@example.com", "secret-four");
await synced();
check("key: once removed, a new device gets no key", (await localKey()) === null && !(await page.$eval("#cloud-key-sync", e => e.checked)));

// A session from before this feature has no derived key: the box explains instead of half-working.
await page.evaluate(() => localStorage.removeItem("orc_cloud_kek"));
await page.reload({ waitUntil: "load" });
await synced();
await openSettings();
await page.click("#cloud-key-sync");
check("key: an older session is asked to sign in again before it can be turned on", !(await page.$eval("#cloud-key-sync", e => e.checked)) && (await page.textContent("#cloud-key-hint")).includes("sign out and sign in again") && (await keyRecord()).removed === true);
await page.click("#cloud-sign-out");
await page.waitForFunction(() => /^Signed out/.test(document.getElementById("cloud-status").textContent));
check("key: signing out forgets the derived key", (await page.evaluate(() => localStorage.getItem("orc_cloud_kek"))) === null);

// The real library: vendored, loaded only when someone signs in, and
// reported cleanly when it can't reach its server.
const offline = await browser.newContext({ viewport: { width: 390, height: 780 } });
await offline.addInitScript(fakeFetch);
await offline.route(url => !String(url).startsWith(BASE), route => route.abort());
const p2 = await offline.newPage();
await p2.goto(BASE + "/index.html", { waitUntil: "load" });
check("sdk: not loaded on a plain visit", await p2.evaluate(() => typeof window.Skapi === "undefined"));
await p2.click("#open-settings");
await p2.fill("#cloud-email", "kat@example.com");
await p2.fill("#cloud-password", "secret-one");
await p2.click("#cloud-submit");
await p2.waitForFunction(() => typeof window.Skapi === "function", null, { timeout: 15000 });
check("sdk: the vendored library loads when signing in", await p2.evaluate(() => !!document.querySelector('script[src="vendor/skapi.js"]')));
await p2.waitForFunction(() => document.getElementById("cloud-status").classList.contains("error"), null, { timeout: 60000 });
check("sdk: an unreachable server is an error message, not a broken app", (await p2.textContent("#cloud-status")).length > 0 && !(await p2.$eval("#cloud-signed-out", e => e.hidden)) && !(await p2.$eval("#cloud-submit", e => e.disabled)), await p2.textContent("#cloud-status"));

// A connection that comes back from the background dead but unreported.
await p2.evaluate(() => { localStorage.setItem("orc_api_key", "sk-or-v1-test"); localStorage.setItem("orc_model", "anthropic/claude-sonnet-4"); });
await p2.reload({ waitUntil: "load" });
await p2.clock.install();
await p2.evaluate(() => { window.__requests = []; window.__scenarios.push({ kind: "hang" }, { kind: "ok", text: "after the stall" }); });
await p2.fill("#composer", "stall");
await p2.click("#send-btn");
await p2.waitForFunction(() => window.__requests.length === 1);
await p2.clock.fastForward(60000);
check("stall: a slow reply is left alone while the app stays in the foreground", (await p2.evaluate(() => window.__requests.length)) === 1 && await p2.$eval("#send-btn", b => b.classList.contains("stop")));
await p2.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p2.clock.fastForward(30000);
check("stall: silence shorter than the limit after returning is tolerated", (await p2.evaluate(() => window.__requests.length)) === 1);
await p2.clock.fastForward(20000);
await p2.waitForFunction(() => window.__requests.length === 2, null, { timeout: 10000 });
await p2.clock.fastForward(2000);
await p2.waitForFunction(() => document.querySelector("#messages").textContent.includes("after the stall"));
check("stall: a dead connection after returning is dropped and retried", (await p2.$$(".msg.error")).length === 0);
await offline.close();

check("no page errors", errors.length === 0, JSON.stringify(errors));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(Object.values(results).some(v => v.startsWith("FAIL")) ? 1 : 0);
