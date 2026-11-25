#!/usr/bin/env node
// Checks that import.mjs and answers.mjs read the export and answer layouts of the common tools,
// and that the site's own search data (Search Console, Bing Webmaster Tools) lands in site.json and in the report.
// The sample files are built here from each tool's column and field names. They are not real exports.
//   node tests/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "avainsanatutkimus", "scripts");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "avainsanatutkimus-test-"));
let failed = 0;
let n = 0;

function importCase(name, file, content, expect, extra = []) {
  const dir = path.join(tmp, `case-${++n}`);
  fs.mkdirSync(dir);
  const f = path.join(dir, file);
  fs.writeFileSync(f, content);
  let problems = [];
  try {
    execFileSync("node", [path.join(scripts, "import.mjs"), "--dir", dir, "--file", f, "--source", name, ...extra], { encoding: "utf8" });
    const rows = JSON.parse(fs.readFileSync(path.join(dir, "keywords.json"), "utf8"));
    const row = rows.find((r) => r.keyword === "solar panels");
    if (!row) problems.push("row 'solar panels' missing");
    else
      for (const [k, v] of Object.entries(expect)) {
        const got = k === "months" ? row.months?.length : k === "month1" ? row.months?.[0]?.month : row[k];
        if (got !== v) problems.push(`${k}: expected ${v}, got ${JSON.stringify(got)}`);
      }
  } catch (e) {
    problems = [String(e.stderr || e.message).trim()];
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;
}

const utf16 = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);

// --- SEM ---
importCase(
  "Google Keyword Planner (CSV export, UTF-16)",
  "kp.csv",
  utf16('Keyword Stats 2026-11-23 at 10_00_00\nNovember 1, 2025 - October 31, 2026\nKeyword\tCurrency\tAvg. monthly searches\tThree month change\tYoY change\tCompetition\tCompetition (indexed value)\tTop of page bid (low range)\tTop of page bid (high range)\tSearches: Nov 2025\tSearches: Dec 2025\nsolar panels\tEUR\t"1,000"\t0%\t0%\tHigh\t88\t0.52\t2.31\t880\t720\n'),
  { volume: 1000, bid_low: 0.52, bid_high: 2.31, competition: "HIGH", months: 2, month1: "2025-11" },
);
importCase(
  "Google Keyword Planner (ranges, no ad spend)",
  "kp-range.csv",
  "Keyword,Avg. monthly searches,Competition\nsolar panels,1K – 10K,High\n",
  { volume: undefined, competition: "HIGH" },
);
importCase(
  "Google Ads API (KeywordPlanIdeaService JSON)",
  "gads.json",
  JSON.stringify({ results: [{ text: "solar panels", keywordIdeaMetrics: { avgMonthlySearches: "1000", competition: "HIGH", competitionIndex: "88", lowTopOfPageBidMicros: "520000", highTopOfPageBidMicros: "2310000", monthlySearchVolumes: [{ month: "NOVEMBER", year: "2025", monthlySearches: "880" }, { month: "DECEMBER", year: "2025", monthlySearches: "720" }] } }] }),
  { volume: 1000, bid_low: 0.52, bid_high: 2.31, competition: "HIGH", months: 2, month1: "2025-11" },
);
importCase("Microsoft Advertising Keyword Planner", "msads.csv", "Keyword,Avg. monthly searches,Competition,Suggested bid\nsolar panels,1000,Medium,1.20\n", { volume: 1000, cpc: 1.2, competition: "MEDIUM" });

// --- SEO ---
importCase("Semrush (Keyword Magic Tool export)", "semrush.csv", 'Keyword;Intent;Volume;Trend;Keyword Difficulty;CPC (USD);Competitive Density;SERP Features;Number of Results\nsolar panels;Commercial;1000;"0.5,0.6,1.0";45;1.49;0.92;"AI Overview, People also ask";1200000\n', { volume: 1000, cpc: 1.49, difficulty: 45, competition: "HIGH", intent: "Commercial" });
importCase("Semrush (API column codes)", "semrush-api.json", JSON.stringify({ data: [{ Ph: "solar panels", Nq: "1000", Cp: "1.49", Co: "0.92", Kd: "45" }] }), { volume: 1000, cpc: 1.49, competition: "HIGH", difficulty: 45 });
importCase("Ahrefs (Keywords Explorer export)", "ahrefs.csv", "#,Keyword,Country,Difficulty,Volume,CPC,CPS,Parent Keyword,Last Update,SERP Features,Global volume,Traffic potential\n1,solar panels,fi,45,1000,1.49,0.8,solar panels,2026-11-20,AI Overview,90000,2500\n", { volume: 1000, cpc: 1.49, difficulty: 45 });
importCase("Ahrefs (API, price in cents)", "ahrefs-api.json", JSON.stringify({ keywords: [{ keyword: "solar panels", volume: 1000, cpc: 149, difficulty: 45, global_volume: 90000 }] }), { volume: 1000, cpc: 1.49, difficulty: 45 }, ["--cpc-scale", "0.01"]);
importCase("SE Ranking (export)", "seranking.csv", "Keyword,Search volume,Difficulty,CPC,Competition\nsolar panels,1000,45,1.49,0.92\n", { volume: 1000, cpc: 1.49, difficulty: 45, competition: "HIGH" });
importCase("SE Ranking (MCP or API answer)", "seranking.json", JSON.stringify([{ keyword: "solar panels", volume: 1000, cpc: 1.49, competition: 0.92, difficulty: 45, intents: ["C", "T"], history_trend: { "2025-11": 880, "2025-12": 720 } }]), { volume: 1000, cpc: 1.49, competition: "HIGH", difficulty: 45, intent: "C, T", months: 2 });
importCase("Moz (Keyword Explorer export)", "moz.csv", "Keyword,Monthly Volume,Difficulty,Organic CTR,Priority\nsolar panels,1000,45,60,55\n", { volume: 1000, difficulty: 45 });
importCase("Mangools KWFinder (export)", "mangools.csv", "Keyword,Avg. Search Volume (Last 12 months),CPC,PPC,Keyword Difficulty\nsolar panels,1000,1.49,92,45\n", { volume: 1000, cpc: 1.49, competition: "HIGH", difficulty: 45 });
importCase("Ubersuggest (export)", "ubersuggest.csv", "Keyword,Search Volume,CPC,Paid Difficulty,SEO Difficulty\nsolar panels,1000,1.49,92,45\n", { volume: 1000, cpc: 1.49, competition: "HIGH", difficulty: 45 });
importCase("Serpstat (export)", "serpstat.csv", "Keyword,Volume,CPC,Competition in PPC,Difficulty\nsolar panels,1000,1.49,92,45\n", { volume: 1000, cpc: 1.49, competition: "HIGH", difficulty: 45 });
importCase("Keywords Everywhere (export)", "ke.csv", "Keyword,Volume,CPC,Competition,Trend\nsolar panels,1000,$1.49,0.92,12%\n", { volume: 1000, cpc: 1.49, competition: "HIGH" });
importCase("Finnish headers, semicolons, decimal commas", "fi.csv", "Hakusana;Haut/kk;CPC;Kilpailu\nsolar panels;1 000;1,49;Korkea\n", { volume: 1000, cpc: 1.49, competition: "HIGH" });
importCase(
  "DataForSEO (raw API answer, Google Ads data)",
  "dfs.json",
  JSON.stringify({ tasks: [{ data: { api: "keywords_data" }, result: [{ keyword: "solar panels", search_volume: 1000, cpc: 1.49, competition: "HIGH", competition_index: 88, low_top_of_page_bid: 0.52, high_top_of_page_bid: 2.31, monthly_searches: [{ year: 2025, month: 11, search_volume: 880 }, { year: 2025, month: 12, search_volume: 720 }] }, { keyword: "solar panel price", search_volume: 500 }] }] }),
  { volume: 1000, cpc: 1.49, competition: "HIGH", bid_low: 0.52, months: 2, month1: "2025-11" },
);
importCase(
  "DataForSEO Labs (nested keyword_info)",
  "dfs-labs.json",
  JSON.stringify({ tasks: [{ result: [{ items: [{ keyword: "solar panels", keyword_info: { search_volume: 1000, cpc: 1.49, competition_level: "HIGH", monthly_searches: [{ year: 2025, month: 11, search_volume: 880 }] }, keyword_properties: { keyword_difficulty: 45 } }] }] }] }),
  { volume: 1000, cpc: 1.49, competition: "HIGH", difficulty: 45, months: 1 },
);
importCase("Unknown tool with --map", "other.csv", "Phrase X,Demand,Price\nsolar panels,1000,1.49\n", { volume: 1000, cpc: 1.49 }, ["--map", "keyword=Phrase X,volume=Demand,cpc=Price"]);

// --- AI answers and result pages ---
function answersCase(name, mode, json, extra, check) {
  const dir = path.join(tmp, `case-${++n}`);
  fs.mkdirSync(dir);
  const f = path.join(dir, "in.json");
  fs.writeFileSync(f, JSON.stringify(json));
  let problems = [];
  try {
    execFileSync("node", [path.join(scripts, "answers.mjs"), mode, "--dir", dir, "--file", f, ...extra], { encoding: "utf8" });
    const out = fs.readdirSync(dir).find((x) => x !== "in.json");
    problems = check(JSON.parse(fs.readFileSync(path.join(dir, out), "utf8")));
  } catch (e) {
    problems = [String(e.stderr || e.message).trim()];
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;
}
const want = (cond, msg) => (cond ? [] : [msg]);
const aiCheck = (searches, sources, brands) => (out) => [...want(out[0].searches.length === searches, `searches ${out[0].searches.length}`), ...want(out[0].sources.length === sources, `sources ${out[0].sources.length}`), ...want(out[0].brands.length === brands, `brands ${out[0].brands.length}`), ...want(out[0].answer.length > 10, "answer text missing"), ...want(out[0].sources[0]?.domain === "example.com", `domain ${out[0].sources[0]?.domain}`)];
const ai = ["--prompt", "Which solar panels should I buy?", "--engine", "ChatGPT"];

answersCase("AI answer: DataForSEO LLM scraper layout", "ai", { tasks: [{ result: [{ markdown: "Here are the options to compare.", fan_out_queries: ["best solar panels 2026"], sources: [{ url: "https://www.example.com/a", title: "A", domain: "example.com" }], brand_entities: [{ title: "Example Oy" }], items: [{ type: "chat_gpt_text", text: "Here." }] }] }] }, ai, aiCheck(1, 1, 1));
answersCase("AI answer: text, sources and searchQueries (Cloro-style layout)", "ai", { success: true, result: { text: "Here are the options to compare.", sources: [{ position: 1, url: "https://example.com/a", label: "A" }, { position: 2, url: "https://other.org/b", label: "B" }], searchQueries: ["best solar panels 2026", "solar panel prices"] } }, ai, aiCheck(2, 2, 0));
answersCase("AI answer: Google AI Mode / AI Overview layout (text blocks and references)", "ai", { ai_overview: { text_blocks: [{ type: "paragraph", snippet: "Short." }], markdown: "Here are the options to compare.", references: [{ title: "A", link: "https://example.com/a", source: "Example" }] } }, ai, aiCheck(0, 1, 0));
answersCase("AI answer: AI visibility tool layout (response, citations, mentions)", "ai", { data: { response: "Here are the options to compare.", citations: ["https://example.com/a", "https://other.org/b"], mentions: [{ name: "Example Oy" }, { name: "Other Ltd" }], queries: ["best solar panels"] } }, ai, aiCheck(1, 2, 2));

const serpCheck = (types) => (out) => [...want(out.organic.length === 2, `organic ${out.organic.length}`), ...want(out.organic[0].domain === "example.com", `domain ${out.organic[0].domain}`), ...want(out.people_also_ask.length === 2, `paa ${out.people_also_ask.length}`), ...types.flatMap((t) => want(out.result_types.includes(t), `type ${t} missing`))];
const serp = ["--keyword", "solar panels price"];
answersCase("Result page: SerpApi, SearchApi, HasData layout", "serp", { search_metadata: {}, ai_overview: { text_blocks: [{ snippet: "x" }] }, organic_results: [{ position: 1, title: "A", link: "https://www.example.com/a", source: "Example" }, { position: 2, title: "B", link: "https://other.org/b" }], related_questions: [{ question: "What do solar panels cost?" }, { question: "Are solar panels worth it?" }], local_results: { places: [{ title: "P" }] } }, serp, serpCheck(["ai_overview", "organic", "people_also_ask", "local_pack"]));
answersCase("Result page: Serper layout", "serp", { organic: [{ position: 1, title: "A", link: "https://example.com/a" }, { position: 2, title: "B", link: "https://other.org/b" }], peopleAlsoAsk: [{ question: "What do solar panels cost?" }, { question: "Are solar panels worth it?" }], relatedSearches: [{ query: "x" }] }, serp, serpCheck(["organic", "people_also_ask", "related_searches"]));
answersCase("Result page: DataForSEO layout (typed items, mobile redirect links)", "serp", { tasks: [{ result: [{ item_types: ["ai_overview", "organic", "people_also_ask"], items: [{ type: "organic", rank_group: 1, domain: "www.google.com", url: "https://www.google.com/goto?url=abc", breadcrumb: "https://example.com › prices", title: "A" }, { type: "people_also_ask", items: [{ title: "What do solar panels cost?" }, { title: "Are solar panels worth it?" }] }, { type: "organic", rank_group: 2, domain: "other.org", url: "https://other.org/b", title: "B" }] }] }] }, serp, serpCheck(["ai_overview", "organic", "people_also_ask"]));

// --- The site's own search data: import.mjs --site -> site.json, and the report section ---
function siteCase(name, file, content, expect, extra = []) {
  const dir = path.join(tmp, `case-${++n}`);
  fs.mkdirSync(dir);
  const f = path.join(dir, file);
  fs.writeFileSync(f, content);
  let problems = [];
  try {
    execFileSync("node", [path.join(scripts, "import.mjs"), "--site", "--dir", dir, "--file", f, "--source", "Search Console", ...extra], { encoding: "utf8" });
    if (fs.existsSync(path.join(dir, "keywords.json"))) problems.push("keywords.json was written");
    const rows = JSON.parse(fs.readFileSync(path.join(dir, "site.json"), "utf8"));
    const row = rows.find((r) => r.query === "solar panels");
    if (!row) problems.push("row 'solar panels' missing");
    else for (const [k, v] of Object.entries(expect)) if (row[k] !== v) problems.push(`${k}: expected ${v}, got ${JSON.stringify(row[k])}`);
  } catch (e) {
    problems = [String(e.stderr || e.message).trim()];
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;
  return dir;
}
siteCase("Site data: Search Console export (Queries.csv)", "Queries.csv", "Top queries,Clicks,Impressions,CTR,Position\nsolar panels,12,340,3.53%,8.4\nsolar panels price,3,90,3.33%,12.1\n", { clicks: 12, impressions: 340, position: 8.4, page: null });
siteCase("Site data: Search Console export, Finnish headers", "Kyselyt.csv", "Suosituimmat kyselyt,Klikkaukset,Näyttökerrat,Napsautussuhde,Sijainti\nsolar panels,12,1 340,\"0,9 %\",\"8,4\"\n", { clicks: 12, impressions: 1340, position: 8.4 });
siteCase("Site data: Search Console API (keys = query, page; two pages added together)", "gsc.json", JSON.stringify({ rows: [{ keys: ["solar panels", "https://example.com/a"], clicks: 10, impressions: 300, ctr: 0.033, position: 8 }, { keys: ["solar panels", "https://example.com/b"], clicks: 2, impressions: 100, ctr: 0.02, position: 12 }] }), { clicks: 12, impressions: 400, position: 9, page: "https://example.com/a" });
siteCase("Site data: query and page as fields (MCP layout)", "mcp.json", JSON.stringify([{ query: "Solar Panels", page: "https://example.com/a", clicks: 12, impressions: 340, ctr: 0.035, position: 8.4 }]), { clicks: 12, impressions: 340, position: 8.4, page: "https://example.com/a" });
siteCase("Site data: Bing Webmaster Tools export", "bing.csv", '"Keyword","Impressions","Clicks","CTR","Avg. Position"\n"solar panels","340","12","3.53%","8.4"\n', { clicks: 12, impressions: 340, position: 8.4 });
siteCase("Site data: Bing Webmaster API (GetQueryStats)", "bing.json", JSON.stringify({ d: [{ Query: "solar panels", Impressions: 340, Clicks: 12, AvgImpressionPosition: 8.4, AvgClickPosition: 3.1, Date: "/Date(1763856000000)/" }] }), { clicks: 12, impressions: 340, position: 8.4 });
{
  // Report: the own-site section shows the group with visibility, the group without, and the keyword at 5-15.
  const dir = siteCase("Site data: --match keeps only the topic", "Queries.csv", "Top queries,Clicks,Impressions,CTR,Position\nsolar panels,12,340,3.53%,8.4\nheat pump,50,900,5.5%,2.0\n", { impressions: 340 }, ["--match", "solar"]);
  let problems = [];
  n++;
  try {
    fs.writeFileSync(path.join(dir, "keywords.json"), JSON.stringify([{ keyword: "solar panels", volume: 1000, cpc: 1, source: "test" }, { keyword: "solar panels price", volume: 500, cpc: 2, source: "test" }]));
    fs.writeFileSync(path.join(dir, "groups.json"), JSON.stringify({ topic: "solar panels", lang: "en", groups: [{ name: "General", weight: 0.5, keywords: ["solar panels"] }, { name: "Price", weight: 0.5, keywords: ["solar panels price"] }] }));
    const log = execFileSync("node", [path.join(scripts, "report.mjs"), "--dir", dir], { encoding: "utf8" });
    const md = fs.readFileSync(path.join(dir, "report.md"), "utf8");
    problems = [...want(/## Your site in search results/.test(md), "section missing"), ...want(/\| General \| 1\/1 \| 340 \| 12 \| 8\.4 \|/.test(md), "group row"), ...want(/not visible yet: Price\./.test(md), "group without visibility"), ...want(/\| solar panels \| General \| 1,000 \| 340 \| 8\.4 \|/.test(md), "near-top row"), ...want(!/heat pump/.test(md), "--match did not filter"), ...want(/1 match a grouped keyword, 1 at positions 5-15/.test(log), "log line")];
  } catch (e) {
    problems = [String(e.stderr || e.message).trim()];
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} Report: own-site section${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;

  // Report: budget range in euros, click prices converted with the given rate.
  n++;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "groups.json"), "utf8"));
    fs.writeFileSync(path.join(dir, "groups.json"), JSON.stringify({ ...cfg, currency: "USD", budget: { low: 1000, high: 2000 }, rate: { value: 0.5, date: "2026-01-02", source: "test" } }));
    execFileSync("node", [path.join(scripts, "report.mjs"), "--dir", dir], { encoding: "utf8" });
    const md = fs.readFileSync(path.join(dir, "report.md"), "utf8");
    const csv = fs.readFileSync(path.join(dir, "keywords.csv"), "utf8");
    problems = [...want(/Preliminary budget: 1,000–2,000 €\/mo/.test(md), "range line"), ...want(/\| Price \| – \| 0\.5 \| 50 % \| 500–1,000 \|/.test(md), "group range"), ...want(/\| solar panels price \| 500 \| 1\.00 € \|/.test(md), "converted price"), ...want(/converted from USD to EUR at 0\.5 \(test, 2026-01-02\)/.test(md), "rate note"), ...want(/solar panels price,Price,,500,1,,,EUR/.test(csv), "csv currency")];
    fs.writeFileSync(path.join(dir, "groups.json"), JSON.stringify({ ...cfg, currency: "USD" }));
    execFileSync("node", [path.join(scripts, "report.mjs"), "--dir", dir, "--budget", "1500"], { encoding: "utf8" });
    const md2 = fs.readFileSync(path.join(dir, "report.md"), "utf8");
    problems.push(...want(/\*\*1,500\*\* \|/.test(md2), "single budget"), ...want(/2\.00 \$/.test(md2) && /no exchange rate to EUR/.test(md2), "no rate keeps source currency"));
  } catch (e) {
    problems = [String(e.stderr || e.message).trim()];
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} Report: budget range and currency${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;

  // Slide report: same data as report.md, in both languages.
  n++;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "groups.json"), "utf8"));
    fs.writeFileSync(path.join(dir, "groups.json"), JSON.stringify({ ...cfg, currency: "USD", budget: { low: 1000, high: 2000 }, rate: { value: 0.5, date: "2026-01-02", source: "test" } }));
    const out = execFileSync("node", [path.join(scripts, "report-html.mjs"), "--dir", dir, "--note", "Test <note>", "--brand", "ACME"], { encoding: "utf8" });
    const en = fs.readFileSync(path.join(dir, "report.html"), "utf8");
    problems = [...want(/report\.html: \d+ slides/.test(out), "prints the slide count"), ...want(/<html lang="en">/.test(en), "lang en"), ...want(/How 1,000–2,000 € a month splits/.test(en), "budget title"), ...want(/converted from USD to EUR at 0\.5 \(test, 2026-01-02\)/.test(en), "rate note"), ...want(/Test &lt;note&gt;/.test(en), "escaped note"), ...want(/class="brand">ACME</.test(en), "brand"), ...want(!/<script/i.test(en), "no scripts"), ...want(/solar panels price/.test(en), "keyword row")];
    execFileSync("node", [path.join(scripts, "report-html.mjs"), "--dir", dir, "--lang", "fi", "--out", path.join(dir, "fi.html")], { encoding: "utf8" });
    const fi = fs.readFileSync(path.join(dir, "fi.html"), "utf8");
    problems.push(...want(/<html lang="fi">/.test(fi), "lang fi"), ...want(/Näin 1.000–2.000 € kuukaudessa jakautuu ryhmille/.test(fi), "fi budget title"), ...want(!/class="brand"/.test(fi), "no brand by default"));
    fs.writeFileSync(path.join(dir, "brand.json"), JSON.stringify({ name: "OMA", font: "Inter", fontUrl: "https://fonts.googleapis.com/css2?family=Inter", colors: { accent: "#0055ff" } }));
    execFileSync("node", [path.join(scripts, "report-html.mjs"), "--dir", dir, "--out", path.join(dir, "own.html")], { encoding: "utf8" });
    const ownLook = fs.readFileSync(path.join(dir, "own.html"), "utf8");
    problems.push(...want(/--accent:#0055ff/.test(ownLook), "brand.json accent"), ...want(/--font:"Inter"/.test(ownLook) && /family=Inter/.test(ownLook), "brand.json font"), ...want(/class="brand">OMA</.test(ownLook), "brand.json name"), ...want(/--paper:#ffffff/.test(ownLook), "other colours keep their defaults"));
    fs.rmSync(path.join(dir, "brand.json"));
    fs.writeFileSync(path.join(dir, "groups.json"), JSON.stringify(cfg));
  } catch (e) {
    problems = [String(e.stderr || e.message).trim()];
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} Slide report: both languages, budget range and currency${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;
}

// --- AI visibility skill (tekoalynakyvyys): import, analysis and report on made-up answers ---
{
  const ai = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "tekoalynakyvyys", "scripts");
  const dir = path.join(tmp, "ai");
  fs.mkdirSync(dir);
  const run = (script, ...a) => execFileSync("node", [path.join(ai, script), ...a], { encoding: "utf8" });
  const check = async (name, fn) => {
    n++;
    let problems = [];
    try {
      problems = await fn();
    } catch (e) {
      problems = [String(e.stderr || e.message).trim()];
    }
    console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${problems.length ? `: ${problems.join("; ")}` : ""}`);
    if (problems.length) failed++;
  };
  const q1 = "Which company installs heat pumps in Tampere?";
  const q2 = "Compare heat pump installers in Tampere.";
  fs.writeFileSync(path.join(dir, "brief.json"), JSON.stringify({ company: "Acme Lämpö Oy", domain: "acmelampo.fi", aliases: ["Acme Lämpö"], questions: [q1, q2], competitors: ["Beta Pumput"], notCompanies: ["Ilmalämpöpumppu"] }));
  const put = (file, content, q, engine, runNo = "1") => {
    fs.writeFileSync(path.join(dir, file), content);
    return run("answers.mjs", "--file", path.join(dir, file), "--question", q, "--engine", engine, "--run", runNo, "--dir", dir);
  };

  await check("AI answers: DataForSEO-style JSON, tool JSON with citations, plain text", () => {
    const a = put("a.json", JSON.stringify({ tasks: [{ result: [{ markdown: "**Acme Lämpö** and **Beta Pumput** install them. **Ilmalämpöpumppu** saves energy.", sources: [{ url: "https://www.acmelampo.fi/asennus", title: "Acme" }, { url: "https://vertailu.example/pumput", title: "Vertailu" }] }] }] }), q1, "chatgpt");
    const b = put("b.json", JSON.stringify({ result: { text: "Try **Beta Pumput** or **Gamma Kylmä**, **Delta Asennus**.", citations: [{ url: "https://betapumput.fi/", title: "Beta" }] } }), q1, "gemini");
    const c = put("c.txt", "Beta Pumput is the usual choice in Tampere.", q2, "chatgpt");
    put("d.md", "Acme Lämpö Oy and Beta Pumput both get good reviews.", q2, "gemini");
    const rows = JSON.parse(fs.readFileSync(path.join(dir, "answers.json"), "utf8"));
    return [...want(/sources: 2/.test(a), "two sources in the first answer"), ...want(/sources: 1 \(betapumput\.fi\)/.test(b), "citations read as sources"), ...want(/sources: 0/.test(c), "plain text has no sources"), ...want(rows.length === 4, `four answers saved, got ${rows.length}`), ...want(rows[0].sources[0].domain === "acmelampo.fi", "www stripped from the domain")];
  });

  await check("AI analysis: named, cited, competitors, dropped names", () => {
    const out = run("analyze.mjs", "--dir", dir);
    const r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
    const names = r.competitors.map((c) => c.name);
    const beta = r.competitors.find((c) => c.name === "Beta Pumput");
    const all = [...names, ...r.unconfirmed.map((c) => c.name)];
    return [...want(/named in 2 of 4 answers \(50 %\)/.test(out), "summary line"), ...want(r.total.mentioned === 2 && r.total.cited === 1, `named 2 and cited 1, got ${r.total.mentioned} and ${r.total.cited}`), ...want(beta?.answers === 4 && beta.evidence === "brief", "Beta Pumput in all four answers, from the brief"), ...want(!all.includes("Ilmalämpöpumppu"), "notCompanies dropped"), ...want(!all.some((x) => /Acme/.test(x)), "own company is not a competitor"), ...want(!names.includes("Gamma Kylmä, Delta Asennus"), "a bold run with two names is split"), ...want(r.questions[0].cells.chatgpt.verdict === "yes" && r.questions[0].cells.gemini.verdict === "no", "matrix verdicts"), ...want(r.sources.find((s) => s.domain === "acmelampo.fi")?.own === true, "own site marked in sources")];
  });

  await check("AI report: both languages, note, brand", () => {
    const out = run("report.mjs", "--dir", dir, "--lang", "en", "--note", "Test <note>", "--brand", "ACME");
    const en = fs.readFileSync(path.join(dir, "report.html"), "utf8");
    run("report.mjs", "--dir", dir, "--lang", "fi", "--out", path.join(dir, "fi.html"));
    const fi = fs.readFileSync(path.join(dir, "fi.html"), "utf8");
    return [...want(/report\.html: \d+ slides/.test(out), "prints the slide count"), ...want(/<html lang="en">/.test(en), "lang en"), ...want(/Test &lt;note&gt;/.test(en), "escaped note"), ...want(/ACME/.test(en), "brand name"), ...want(!/<script/i.test(en), "no scripts"), ...want(/Beta Pumput/.test(en), "competitor row"), ...want(/<html lang="fi">/.test(fi), "lang fi"), ...want(fs.existsSync(path.join(dir, "report.md")), "report.md written"), ...want(/s2\/favicons\?domain=chatgpt\.com/.test(en), "AI icons"), ...want(!/s2\/favicons/.test(fs.readFileSync(path.join(run("report.mjs", "--dir", dir, "--icons", "off", "--out", path.join(dir, "plain.html")) && dir, "plain.html"), "utf8")), "--icons off leaves icons out")];
  });

  await check("AI site checks: robots rules, homepage facts, source pages", async () => {
    const { workChecks, topSourcePages, robotsAllows } = await import(path.join(ai, "checks.mjs"));
    const robots = "User-agent: *\nDisallow: /admin\n\nUser-agent: PerplexityBot\nDisallow: /\n";
    const home = `<html><head><title>Ilmalämpöpumppujen asennus | Acme Lämpö</title><script type="application/ld+json">{"@type":"LocalBusiness"}</script></head><body><h1>Asennamme ilmalämpöpumput</h1><p>${"Teksti jatkuu tässä. ".repeat(60)}</p><a href="/hinnasto">Hinnasto</a></body></html>`;
    const w = workChecks({ company: "Acme Lämpö Oy", domain: "acmelampo.fi", sells: "ilmalämpöpumppujen asennus", area: "Tampere", competitors: ["Beta Pumput"] }, { robots, home, sitemap: null }, [
      { domain: "vertailu.example", html: "<p>Beta Pumput ja Acme Lämpö vertailussa</p>" },
      { domain: "lista.example", html: "<p>Beta Pumput on listan kärjessä</p>" },
      { domain: "uutiset.example", html: "<p>Sää on tänään pilvinen</p>" },
      { domain: "kiinni.example", html: null },
    ]);
    const by = (list, id) => list.find((c) => c.id === id)?.ok;
    const rows = JSON.parse(fs.readFileSync(path.join(dir, "answers.json"), "utf8"));
    const top = topSourcePages(rows, "acmelampo.fi", [], 10, ["Beta Pumput"]);
    return [
      ...want(robotsAllows(robots, "OAI-SearchBot") && !robotsAllows(robots, "PerplexityBot") && !robotsAllows(robots, "Googlebot", "/admin/x"), "robots rules per bot and path"),
      ...want(by(w.tech, "bots-chatgpt") === true && by(w.tech, "bots-others") === false && by(w.tech, "text") === true && by(w.tech, "sitemap") === null, "technical checks"),
      ...want(by(w.content, "service") === true && by(w.content, "area") === false && by(w.content, "prices") === true && by(w.content, "faq") === false && by(w.content, "schema") === true, "content checks"),
      ...want(w.mentions.length === 2 && w.mentions[0].ok === true && w.mentions[1].ok === false && w.mentions[1].detail === "lista.example", "only source pages that name companies of the trade count"),
      ...want(top.length === 1 && top[0].domain === "vertailu.example", `own and competitor sites are not source pages, got ${top.map((x) => x.domain).join(", ")}`),
    ];
  });

  await check("AI report: the work section appears only with checks.json", () => {
    const before = fs.readFileSync(path.join(dir, "fi.html"), "utf8");
    fs.writeFileSync(path.join(dir, "checks.json"), JSON.stringify({ tech: [{ id: "bots-chatgpt", ok: true }, { id: "sitemap", ok: null }], content: [{ id: "area", ok: false, detail: "Tampere <b>" }, { id: "unknown-id", ok: false }], mentions: [] }));
    run("report.mjs", "--dir", dir, "--lang", "fi", "--out", path.join(dir, "work-fi.html"));
    const fi = fs.readFileSync(path.join(dir, "work-fi.html"), "utf8");
    const md = fs.readFileSync(path.join(dir, "report.md"), "utf8");
    run("report.mjs", "--dir", dir, "--lang", "en", "--out", path.join(dir, "work-en.html"));
    const en = fs.readFileSync(path.join(dir, "work-en.html"), "utf8");
    fs.rmSync(path.join(dir, "checks.json"));
    return [...want(!/Mistä tulos syntyy/.test(before), "no work slide without checks.json"), ...want(/Mistä tulos syntyy/.test(fi) && /Tekninen pohja/.test(fi) && /Selvä puute/.test(fi), "fi slide with areas and levels"), ...want(/Toiminta-aluetta \(Tampere &lt;b&gt;\) ei mainita/.test(fi), "detail filled in and escaped"), ...want(!/unknown-id/.test(fi), "unknown check ids are skipped"), ...want(/## Mistä tulos syntyy/.test(md) && /\*\*1 \/ 1\*\* kunnossa/.test(md), "report.md section"), ...want(/Where the result comes from/.test(en) && /Clear gap/.test(en) && /Could not be checked/.test(en), "en slide"), ...want(!/<script/i.test(en), "no scripts")];
  });

  await check("AI cost estimate makes no calls and needs no credentials", () => {
    fs.writeFileSync(path.join(dir, "brief.json"), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(dir, "brief.json"), "utf8")), engines: ["chatgpt", "gemini", "aimode"], runs: 2 }));
    const out = run("dataforseo.mjs", "estimate", "--dir", dir);
    return want(/12/.test(out) && /\$/.test(out), `12 answers and a dollar sum, got: ${out.trim().slice(0, 120)}`);
  });
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} of ${n} failed` : `\nall ${n} passed`);
process.exit(failed ? 1 : 0);
