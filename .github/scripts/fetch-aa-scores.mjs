// Fetches model scores from Artificial Analysis and writes data/aa-models.json,
// which the app reads from its own site. Run by .github/workflows/aa-scores.yml.
//
// The browser can't call Artificial Analysis directly (their API refuses
// cross-origin requests), so this runs on GitHub's servers with the key held
// as the repository secret AA_API_KEY. Only the fields the app uses are kept.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUT = "data/aa-models.json";
const SOURCE = process.env.AA_URL || "https://artificialanalysis.ai/api/v2/data/llms/models";
const MAX_AGE_DAYS = 7;
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
    const ageDays = (Date.now() - Date.parse(previous.fetchedAt)) / 86400000;
    if (ageDays < MAX_AGE_DAYS) {
      console.log(`Scores are ${ageDays.toFixed(1)} days old; they refresh after ${MAX_AGE_DAYS} days. Skipping.`);
      process.exit(0);
    }
  } catch {
    // No previous file, or unreadable: fetch.
  }
}

const res = await fetch(SOURCE, { headers: { "x-api-key": key, accept: "application/json" } });
if (!res.ok) {
  console.log(`::error title=Artificial Analysis request failed::HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}

const json = await res.json();
const raw = Array.isArray(json) ? json : (json?.data ?? json?.models ?? []);
if (!Array.isArray(raw)) {
  console.log(`::error::Unexpected response shape. Top-level keys: ${Object.keys(json ?? {}).join(", ")}`);
  process.exit(1);
}

// Log the shape (never the key) so field-name changes are easy to spot.
const sample = raw.find((r) => r && typeof r === "object") ?? {};
console.log(`Received ${raw.length} records. Fields: ${Object.keys(sample).join(", ")}`);
console.log(`Evaluation fields: ${Object.keys(sample.evaluations ?? {}).join(", ")}`);

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
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
      model_creator: { name: creator.name, slug: creator.slug },
      evaluations,
      median_output_tokens_per_second: num(r.median_output_tokens_per_second),
      median_time_to_first_token_seconds: num(r.median_time_to_first_token_seconds),
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
  data: models,
}) + "\n");
console.log(`Wrote ${models.length} models (${scored} with an intelligence index) to ${OUT}.`);
