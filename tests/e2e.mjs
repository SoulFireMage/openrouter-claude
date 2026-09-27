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
  const sse = (events, delayMs = 0, signal) => new ReadableStream({
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
  window.fetch = async (url, opts = {}) => {
    // The scores file the GitHub Action publishes. "404" (not published yet)
    // is the default so earlier checks see an app without scores.
    if (String(url).endsWith("data/aa-models.json")) {
      window.__aaRequests.push(String(url));
      const mode = localStorage.getItem("__aaMode") || "404";
      if (mode === "404") return new Response("Not found", { status: 404 });
      if (mode === "bad") return new Response("{not json", { status: 200 });
      return new Response(JSON.stringify({ source: "Artificial Analysis", fetchedAt: new Date(Date.now() - 2 * 86400000).toISOString(), data: window.__aaFixture.data }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (!String(url).startsWith("https://openrouter.ai/")) return realFetch(url, opts);
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
    if (sc.kind === "http") {
      return new Response(JSON.stringify({ error: { message: sc.message, code: sc.status } }), { status: sc.status });
    }
    const words = (sc.text || "").split(/(?<=\s)/);
    const served = sc.servedModel || JSON.parse(opts.body).model;
    const events = words.map(w => ({ model: served, provider: "MockProvider", choices: [{ delta: { content: w } }] }));
    if (sc.kind === "midstream-error") events.push({ error: { message: sc.message } });
    else events.push({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: words.length, cost: 0.00042 } });
    const body = sse(events, sc.delayMs || 0, opts.signal);
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  };
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  .catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }));
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
await ctx.addInitScript(fakeFetch);
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
await page.click("#browse-list .mcard:nth-child(1) .mcard-main");
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

check("no page errors", errors.length === 0, JSON.stringify(errors));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(Object.values(results).some(v => v.startsWith("FAIL")) ? 1 : 0);
