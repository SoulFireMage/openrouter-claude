// Fetches model scores from Artificial Analysis and writes data/aa-models.json,
// which the app reads from its own site. Run by .github/workflows/aa-scores.yml.
//
// The browser can't call Artificial Analysis directly (their API refuses
// cross-origin requests), so this runs on GitHub's servers with the key held
// as the repository secret AA_API_KEY. Only the fields the app uses are kept.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUT = "data/aa-models.json";
const SOURCE = process.env.AA_URL || "https://artificialanalysis.ai/api/v2/language/models/free";
const MAX_AGE_HOURS = 20; // daily runs refresh daily, with slack for schedule drift
const MIN_MODELS = 20; // refuse to replace good data with a suspiciously small response
const force = process.env.FORCE === "true";
const key = process.env.AA_API_KEY;

if (!key) {
  console.log("::warning title=No Artificial Analysis key::Add a repository secret named AA_API_KEY to publish intelligence scores. Skipping.");
  process.exit(0);
}

if (!force) {
  try {
    const previous = JSON.parse(await readFile(OUT, "utf8"));
    const ageHours = (Date.now() - Date.parse(previous.fetchedAt)) / 3600000;
    if (ageHours < MAX_AGE_HOURS) {
      console.log(`Scores are ${ageHours.toFixed(1)} hours old; they refresh after ${MAX_AGE_HOURS}. Skipping.`);
      process.exit(0);
    }
  } catch {
    // No previous file, or unreadable: fetch.
  }
}

// The free endpoint is paginated (200 a page, with pagination.has_more). Read
// every page: stopping at the first one silently drops most models. The free
// tier allows 100 requests a day, so a handful of pages daily is well inside it.
const MAX_PAGES = 25;
const raw = [];
let meta = {};
for (let page = 1; page <= MAX_PAGES; page++) {
  const url = new URL(SOURCE);
  if (page > 1) url.searchParams.set("page", String(page));
  const res = await fetch(url, { headers: { "x-api-key": key, accept: "application/json" } });
  if (!res.ok) {
    console.log(`::error title=Artificial Analysis request failed::HTTP ${res.status} ${res.statusText} on page ${page}`);
    process.exit(1);
  }
  const json = await res.json();
  const rows = Array.isArray(json) ? json : (json?.data ?? json?.models ?? []);
  if (!Array.isArray(rows)) {
    console.log(`::error::Unexpected response shape. Top-level keys: ${Object.keys(json ?? {}).join(", ")}`);
    process.exit(1);
  }
  if (page === 1) {
    meta = { tier: json?.tier, version: json?.intelligence_index_version };
    console.log(`Tier ${meta.tier ?? "?"}, Intelligence Index v${meta.version ?? "?"}, remaining today: ${res.headers.get("x-ratelimit-remaining") ?? "?"}`);
  }
  raw.push(...rows);
  const p = json?.pagination;
  console.log(`Page ${page}: ${rows.length} records${p ? ` (of ${p.total_pages} pages)` : ""}.`);
  if (!p || !p.has_more || !rows.length) break;
  if (page === MAX_PAGES) {
    console.log(`::error::Still more pages after ${MAX_PAGES}; keeping the previous file rather than publishing part of the list.`);
    process.exit(1);
  }
}

// Log the shape (never the key) so field-name changes are easy to spot.
const sample = raw.find((r) => r && typeof r === "object") ?? {};
console.log(`Received ${raw.length} records. Fields: ${Object.keys(sample).join(", ")}`);
console.log(`Evaluation fields: ${Object.keys(sample.evaluations ?? {}).join(", ")}`);

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
// Speed: performance_v3 (means) is the current measure; the older medians in
// "performance" (and, before that, at the top level) go null on 10 Dec 2026.
const speed = (r) => num(r.performance_v3?.mean_output_tokens_per_second)
  ?? num(r.performance?.median_output_tokens_per_second) ?? num(r.median_output_tokens_per_second);
const firstToken = (r) => num(r.performance_v3?.mean_time_to_first_token_seconds)
  ?? num(r.performance?.median_time_to_first_token_seconds) ?? num(r.median_time_to_first_token_seconds);
const models = raw
  .filter((r) => r && typeof r === "object" && (typeof r.name === "string" || typeof r.slug === "string"))
  .map((r) => {
    const evaluations = {};
    for (const [k, v] of Object.entries(r.evaluations ?? {})) if (num(v) !== undefined) evaluations[k] = v;
    const creator = r.model_creator ?? {};
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      release_date: r.release_date,
      // The free endpoint gives the creator's id and name but no slug; the app
      // matches on the name when there is no slug.
      model_creator: { id: creator.id, name: creator.name, slug: creator.slug },
      evaluations,
      output_tokens_per_second: speed(r),
      time_to_first_token_seconds: firstToken(r),
    };
  });

const scored = models.filter((m) => num(m.evaluations.artificial_analysis_intelligence_index) !== undefined).length;
if (models.length < MIN_MODELS) {
  console.log(`::error::Only ${models.length} usable models in the response; keeping the previous file.`);
  process.exit(1);
}

await mkdir("data", { recursive: true });
await writeFile(OUT, JSON.stringify({
  source: "Artificial Analysis",
  sourceUrl: "https://artificialanalysis.ai/",
  fetchedAt: new Date().toISOString(),
  intelligenceIndexVersion: num(meta.version),
  data: models,
}) + "\n");
console.log(`Wrote ${models.length} models (${scored} with an intelligence index) to ${OUT}.`);
