#!/usr/bin/env node
// Asks the buyer questions in brief.json from the AIs through DataForSEO and saves the answers. Node 18+, no dependencies.
//   node dataforseo.mjs estimate --dir <work folder> [--engines chatgpt,gemini,aimode,perplexity] [--runs 2]
//   node dataforseo.mjs fetch    --dir <work folder> [--engines ...] [--runs 2] [--location 2246] [--language fi] [--country FI]
// Credentials come from the environment: DATAFORSEO_LOGIN (or DATAFORSEO_USERNAME) and DATAFORSEO_PASSWORD.
// ChatGPT and Gemini are read from the real apps (LLM Scraper), Google AI Mode from the result page, and
// Perplexity through its model API with web search on. Raw responses are cached in <dir>/raw, so a rerun is free.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseDataforseo, engineLabel } from "./core.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? ".");
const briefPath = path.join(dir, "brief.json");
if (!fs.existsSync(briefPath)) {
  console.error(`brief.json not found in ${dir}. Write it first, see SKILL.md step 1.`);
  process.exit(1);
}
const brief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
const questions = (brief.questions ?? []).map((q) => String(q).trim()).filter(Boolean);
const engines = String(args.engines ?? (brief.engines ?? ["chatgpt", "gemini"]).join(",")).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const runs = Math.max(1, Math.min(5, Number(args.runs ?? brief.runs ?? 2)));
const location = Number(args.location ?? brief.market?.location_code ?? 2246);
const language = String(args.language ?? brief.market?.language_code ?? "fi");
const country = String(args.country ?? brief.market?.country ?? "FI").toUpperCase();

// Price of one answer in US dollars, as charged in November 2026. Perplexity varies with the answer length.
const PRICE = { chatgpt: 0.004, gemini: 0.004, aimode: 0.004, perplexity: 0.007 };
const CALL = {
  chatgpt: (q) => ["/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced", { keyword: q, location_code: location, language_code: language, force_web_search: true }],
  gemini: (q) => ["/v3/ai_optimization/gemini/llm_scraper/live/advanced", { keyword: q, location_code: location, language_code: language }],
  aimode: (q) => ["/v3/serp/google/ai_mode/live/advanced", { keyword: q, location_code: location, language_code: language }],
  perplexity: (q) => ["/v3/ai_optimization/perplexity/llm_responses/live", { user_prompt: q, model_name: "sonar", web_search_country_iso_code: country }],
};
const unknown = engines.filter((e) => !CALL[e]);
if (unknown.length) {
  console.error(`Unknown engine: ${unknown.join(", ")}. Available: ${Object.keys(CALL).join(", ")}.`);
  process.exit(1);
}
if (!questions.length) {
  console.error("brief.json has no questions.");
  process.exit(1);
}
const calls = questions.length * engines.length * runs;
const estimate = questions.length * runs * engines.reduce((s, e) => s + PRICE[e], 0);

if (cmd === "estimate") {
  console.log(`${questions.length} questions × ${engines.length} AIs (${engines.map(engineLabel).join(", ")}) × ${runs} runs = ${calls} answers`);
  console.log(`Estimated cost: about $${estimate.toFixed(2)}`);
  process.exit(0);
}
if (cmd !== "fetch") {
  console.error("Usage: node dataforseo.mjs estimate|fetch --dir <work folder> [--engines ...] [--runs 2]");
  process.exit(1);
}

const login = process.env.DATAFORSEO_LOGIN ?? process.env.DATAFORSEO_USERNAME;
const password = process.env.DATAFORSEO_PASSWORD;
if (!login || !password) {
  console.error("Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the environment. Never write them into a file or the chat.");
  process.exit(1);
}
const auth = "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
const rawDir = path.join(dir, "raw");
fs.mkdirSync(rawDir, { recursive: true });
let spent = 0;

async function ask(engine, question, run) {
  const [endpoint, body] = CALL[engine](question);
  const hash = crypto.createHash("sha1").update(JSON.stringify([endpoint, body, run])).digest("hex").slice(0, 12);
  const file = path.join(rawDir, `${engine}-${hash}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.dataforseo.com" + endpoint, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify([body]) });
      const json = await res.json();
      const task = json?.tasks?.[0];
      if (task?.status_code === 20000 && task.result?.length) {
        spent += Number(json.cost ?? task.cost ?? 0);
        fs.writeFileSync(file, JSON.stringify(json));
        return json;
      }
      last = `${task?.status_code ?? res.status} ${task?.status_message ?? json?.status_message ?? ""}`;
    } catch (err) {
      last = String(err?.message ?? err);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.error(`  failed: ${engineLabel(engine)} · "${question.slice(0, 50)}" · ${last}`);
  return null;
}

const jobs = [];
for (const q of questions) for (const e of engines) for (let r = 1; r <= runs; r++) jobs.push({ q, e, r });
console.log(`Fetching ${jobs.length} answers, estimated cost about $${estimate.toFixed(2)} ...`);
const answers = [];
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(6, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const json = await ask(job.e, job.q, job.r);
      if (!json) continue;
      const a = parseDataforseo(job.e, json);
      if (!a.text.trim()) {
        console.error(`  empty answer: ${engineLabel(job.e)} · "${job.q.slice(0, 50)}"`);
        continue;
      }
      answers.push({ ...a, question: job.q, run: job.r, date: new Date().toISOString().slice(0, 10), source: "DataForSEO" });
    }
  }),
);
const order = (a) => questions.indexOf(a.question) * 100 + engines.indexOf(a.engine) * 10 + a.run;
answers.sort((a, b) => order(a) - order(b));
fs.writeFileSync(path.join(dir, "answers.json"), JSON.stringify(answers, null, 2));
console.log(`Saved ${answers.length} of ${jobs.length} answers to answers.json. Spent now: $${spent.toFixed(3)} (cached answers cost nothing).`);
