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

// --- yrityskonteksti: markers, the check, own texts, the website reader and the report ---
{
  const yk = path.join(scripts, "..", "..", "yrityskonteksti", "scripts");
  const core = await import(path.join(yk, "core.mjs"));
  const node = (script, ...a) => execFileSync("node", [path.join(yk, script), ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const ctx = async (name, fn) => {
    n++;
    let problems = [];
    try { problems = await fn(); } catch (e) { problems = [String(e.stderr || e.message).trim().slice(0, 300)]; }
    console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${problems.length ? `: ${problems.join("; ")}` : ""}`);
    if (problems.length) failed++;
  };
  const example = path.join(scripts, "..", "..", "..", "examples", "yrityskonteksti");
  const copyExample = () => {
    const dir = path.join(tmp, `yk-${n}-${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(dir);
    for (const f of ["yritys.md", "kohderyhma.md", "brandi.md", "brand.json"]) fs.copyFileSync(path.join(example, f), path.join(dir, f));
    return dir;
  };

  await ctx("Context: page picker takes hinted pages first, then service pages named after the service, never privacy pages", () => {
    const L = (p, text = "") => ({ url: `https://x.fi${p}`, text });
    const got = core.pickPages([L("/"), L("/hakukoneoptimointi", "SEO"), L("/tietosuoja"), L("/en"), L("/oppaat/pitka-opas"), L("/google-ads-mainonta"), L("/hinnat")], 3).map((u) => new URL(u).pathname);
    return want(got.join() === "/hinnat,/hakukoneoptimointi,/google-ads-mainonta", `picked ${got.join()}`);
  });

  await ctx("Context: colours named in custom properties win over the most used colour", () => {
    const b = core.suggestBrand([{ hex: "#ffffff", count: 30, vars: [] }, { hex: "#000000", count: 20, vars: ["--night"] }, { hex: "#141414", count: 9, vars: ["--ink"] }, { hex: "#f5f5f5", count: 9, vars: [] }, { hex: "#f3f3f3", count: 1, vars: ["--soft"] }, { hex: "#ff5a1f", count: 1, vars: ["--accent"] }], [{ family: "Hanken Grotesk" }], "X");
    return want(b.colors.ink === "#141414" && b.colors.soft === "#f3f3f3" && b.colors.night === "#000000" && b.colors.accent === "#ff5a1f" && b.colors.paper === "#ffffff", JSON.stringify(b.colors));
  });

  await ctx("Context: markers in Finnish and English, with and without a source", () => {
    const m = core.markers("| Hinta | 149 € | [vahvistettu: verkkosivu /hinnasto] | x [derived: site] y [auki] [OPEN]");
    return [...want(m.map((x) => x.kind).join() === "confirmed,derived,open,open", `kinds ${m.map((x) => x.kind).join()}`), ...want(m[0].source === "verkkosivu /hinnasto" && m[2].source === "", "sources"), ...want(core.stripMarkers("Maalämpöä ei asenneta. [vahvistettu: ukk]") === "Maalämpöä ei asenneta.", "marker stripped")];
  });

  await ctx("Context: a file is read into confirmed, derived and open, and format problems are found", () => {
    const text = "---\ncompany: Testi Oy\nowner: Maija\nreviewed: 2026-01-10\n---\n# Brändi\n\n## Ääni\n\n### Suora\n\n- Tarkoittaa: asia ensin.\n- Ei tarkoita: tylyä.\n- Esimerkki: \"Hinta on 100 €.\" [vahvistettu: verkkosivu]\n\n### Lämmin\n\n- Tarkoittaa: ystävällinen.\n\n## Sanasto\n\n| Käytetään | Ei käytetä | Merkintä |\n|---|---|---|\n| huolto | service | [päätelty] |\n| asennus | | [auki] |\n\n## Ulkoasu\n\n- Pääväri on sininen.\n\n## Muutokset\n\n- 2026-01-10: ensimmäinen versio.\n";
    const r = core.readContextFile("brandi.md", text, new Date("2026-08-01"));
    return [...want(r.confirmed === 1 && r.derived === 1 && r.open === 1, `counts ${r.confirmed}/${r.derived}/${r.open}`), ...want(r.noSource.length === 1, "a derived fact without a source is reported"), ...want(r.unmarked.length === 1 && /Pääväri/.test(r.unmarked[0].text), `one fact without a marker, got ${r.unmarked.length}`), ...want(r.voiceProblems.length === 1 && r.voiceProblems[0].rule === "Lämmin", "a voice rule without an example is reported"), ...want(r.owner === "Maija" && r.ageDays > 180, `owner and age ${r.ageDays}`), ...want(r.openItems[0].text === "asennus", `open item text ${r.openItems[0].text}`)];
  });

  await ctx("Context check: the example folder is a draft with open questions and no format problems", () => {
    const dir = copyExample();
    const out = node("check.mjs", "--dir", dir, "--today", "2026-11-26", "--strict");
    const st = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
    return [...want(st.totals.confirmed === 58 && st.totals.derived === 12 && st.totals.open === 10, `totals ${JSON.stringify(st.totals)}`), ...want(st.files.every((f) => f.state === "draft"), `states ${st.files.map((f) => f.state).join()}`), ...want(st.brand.state === "ready", `brand ${st.brand.state}`), ...want(/open 10/.test(out), "summary line")];
  });

  await ctx("Context check: --strict fails on a missing file, a missing section and an old review", () => {
    const dir = copyExample();
    fs.rmSync(path.join(dir, "kohderyhma.md"));
    fs.writeFileSync(path.join(dir, "yritys.md"), fs.readFileSync(path.join(dir, "yritys.md"), "utf8").replace("## Mitä ei luvata eikä tehdä", "## Rajat"));
    let code = 0;
    try { node("check.mjs", "--dir", dir, "--today", "2027-09-01", "--strict"); } catch (e) { code = e.status; }
    const st = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
    const by = (k) => st.files.find((f) => f.key === k);
    return [...want(code === 1, `exit code ${code}`), ...want(by("audience").state === "missing", "missing file"), ...want(by("company").state === "fix" && by("company").problems.some((p) => /section/i.test(p)), `missing section: ${by("company").problems.join(" / ")}`), ...want(by("brand").problems.concat(by("brand").notes ?? []).some((p) => /review|read/i.test(p)), "old review is flagged")];
  });

  await ctx("Context check: the templates are valid drafts once an owner is set", () => {
    const dir = path.join(tmp, "yk-templates");
    fs.mkdirSync(dir);
    for (const f of ["yritys.md", "kohderyhma.md", "brandi.md"]) fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(yk, "..", "templates", f), "utf8").replace("owner:", "owner: Maija"));
    fs.copyFileSync(path.join(example, "brand.json"), path.join(dir, "brand.json"));
    node("check.mjs", "--dir", dir, "--strict");
    const st = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
    return [...want(st.files.every((f) => f.state === "draft"), `states ${st.files.map((f) => `${f.state}: ${f.problems.join(",")}`).join(" | ")}`), ...want(st.totals.confirmed === 0 && st.totals.open > 30, `totals ${JSON.stringify(st.totals)}`)];
  });

  await ctx("Own texts: LinkedIn export (Shares.csv) and plain text are read and counted", () => {
    const dir = path.join(tmp, "yk-texts");
    fs.mkdirSync(dir);
    const long = "Teimme viime viikolla kolme asennusta Tampereella. Jokainen kesti alle päivän!\n\nMitä opimme? Kartoitus kannattaa tehdä paikan päällä.";
    fs.writeFileSync(path.join(dir, "Shares.csv"), `Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility\n2026-10-02 08:00:00,https://example.com/1,"${long}",,,MEMBER_NETWORK\n2026-10-01 08:00:00,https://example.com/2,"Lyhyt ""lainaus"".",,,MEMBER_NETWORK\n`);
    fs.writeFileSync(path.join(dir, "kirjeet.md"), "Me autamme teitä valitsemaan oikean pumpun. Hinta kerrotaan aina etukäteen, ja se pitää.\n---\nKysyttekö usein, toimiiko pumppu pakkasella? Vastaus on kyllä, kun mitoitus tehdään oikein.\n");
    const out = node("texts.mjs", "--dir", dir, path.join(dir, "Shares.csv"), path.join(dir, "kirjeet.md"));
    const t = JSON.parse(fs.readFileSync(path.join(dir, "raw", "texts.json"), "utf8"));
    const v = JSON.parse(fs.readFileSync(path.join(dir, "raw", "voice-stats.json"), "utf8"));
    return [...want(t.found === 4 && t.used === 3, `found ${t.found}, used ${t.used}`), ...want(t.texts[0].source === "Shares.csv" && /Tampereella/.test(t.texts[0].text), "the dated export text comes first"), ...want(v.sentences >= 7 && v.questionShare > 0 && v.exclamationShare > 0, `sentences ${v.sentences}, questions ${v.questionShare}, exclamations ${v.exclamationShare}`), ...want(v.address.we >= 1 && v.address.youFormal >= 1, `address ${JSON.stringify(v.address)}`), ...want(/3 used of 4/.test(out), "summary line")];
  });

  await ctx("Website: text, key pages, colours and fonts are read into raw/site.json", async () => {
    const http = await import("node:http");
    const { spawn } = await import("node:child_process");
    const css = ":root{--brand:#0F4C5C;--paper:#fff}body{font-family:'Inter',Arial,sans-serif;color:#14262b;background:#ffffff}a{color:#0f4c5c}.btn{background:#e36414;color:#fff}.btn:hover{background:#e36414}.card{background:#f4f1ea;border:1px solid #dfdbd1}";
    const page = (title, body) => `<!doctype html><html lang="fi"><head><title>${title}</title><meta name="description" content="Kuvaus: ${title}"><link rel="stylesheet" href="/site.css"><script>var hidden = "ei tekstiä";</script></head><body><nav><a href="/hinnasto">Hinnasto</a><a href="/yritys">Yritys</a><a href="/blogi/juttu">Blogi</a><a href="https://other.example/x">Muu</a></nav><h1>${title}</h1>${body}</body></html>`;
    const server = http.createServer((req, res) => {
      if (req.url === "/site.css") { res.writeHead(200, { "content-type": "text/css" }); return res.end(css); }
      if (req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(page("Testi L&auml;mp&ouml; Oy", "<h2>Asennus ja huolto</h2><p>Asennamme ilmalämpöpumput omakotitaloihin.</p>")); }
      if (req.url === "/hinnasto") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(page("Hinnasto", "<p>Huolto 149 € sis. alv.</p>")); }
      res.writeHead(404); res.end("no");
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const dir = path.join(tmp, "yk-site");
    const out = await new Promise((resolve) => {
      const p = spawn("node", [path.join(yk, "site.mjs"), "--url", `http://127.0.0.1:${server.address().port}/`, "--dir", dir]);
      let buf = "";
      p.stdout.on("data", (d) => (buf += d));
      p.stderr.on("data", (d) => (buf += d));
      p.on("close", () => resolve(buf));
    });
    server.close();
    if (!fs.existsSync(path.join(dir, "raw", "site.json"))) return [`no site.json: ${out.trim().slice(0, 200)}`];
    const s = JSON.parse(fs.readFileSync(path.join(dir, "raw", "site.json"), "utf8"));
    const urls = s.pages.map((p) => new URL(p.url).pathname);
    const hex = s.colors.map((c) => c.hex);
    return [...want(s.pages[0].title === "Testi Lämpö Oy" && s.pages[0].h1.includes("Testi Lämpö Oy"), `title ${s.pages[0].title}`), ...want(/Asennamme ilmalämpöpumput/.test(s.pages[0].text) && !/ei tekstiä/.test(s.pages[0].text), "page text without scripts"), ...want(urls.includes("/hinnasto"), `pricing page read, got ${urls.join()}`), ...want(s.failed.some((f) => /yritys/.test(f.url ?? f)), "a page that fails is listed"), ...want(hex.includes("#0f4c5c") && hex.includes("#e36414") && hex.includes("#ffffff"), `colours ${hex.join()}`), ...want(s.fonts[0]?.family === "Inter", `font ${s.fonts[0]?.family}`), ...want(s.brandSuggestion.colors.accent === "#e36414" && s.brandSuggestion.colors.paper === "#ffffff" && s.brandSuggestion.font === "Inter", `suggestion ${JSON.stringify(s.brandSuggestion.colors)}`)];
  });

  await ctx("Context report: slides in the company's own colours, Finnish and English, no scripts", () => {
    const dir = copyExample();
    node("report.mjs", "--dir", dir, "--today", "2026-11-26", "--note", "Testi <b>");
    const fi = fs.readFileSync(path.join(dir, "report.html"), "utf8");
    const md = fs.readFileSync(path.join(dir, "report.md"), "utf8");
    node("report.mjs", "--dir", dir, "--lang", "en", "--out", path.join(dir, "en.html"));
    const en = fs.readFileSync(path.join(dir, "en.html"), "utf8");
    return [...want(/Kuuranta IT Oy/.test(fi) && /#0b1f3a/i.test(fi) && /Inter/.test(fi), "company name, colour and font"), ...want(/Testi &lt;b&gt;/.test(fi), "note escaped"), ...want(/Nämä kysytään seuraavaksi/.test(fi) && /Kuinka kauan toimittajan vaihto kestää/.test(fi), "open questions slide"), ...want(!/Omistaja luki ja hyväksyi/.test(fi), "changelog is left out"), ...want(/Vahvistettu/.test(fi) && /Päätelty/.test(fi) && /Auki/.test(fi), "three marker labels"), ...want(/Confirmed/.test(en) && /Open/.test(en), "English labels"), ...want(md.length > 500 && /Kuuranta/.test(md), "report.md"), ...want(!/<script/i.test(fi + en), "no scripts")];
  });

  // A PNG that is only its header: enough for the size reader, and every byte after it makes the file unique.
  const png = (w, h, salt = "") => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return Buffer.concat([b, Buffer.from(salt)]); };

  await ctx("Images: size is read from the file header, an unknown file gives nothing", () => {
    const p = core.imageSize(png(900, 600));
    const g = core.imageSize(Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.from([0x40, 0x01, 0xf0, 0x00]), Buffer.alloc(20)]));
    const v = core.imageSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>'));
    return [...want(p?.type === "png" && p.width === 900 && p.height === 600, `png ${JSON.stringify(p)}`), ...want(g?.type === "gif" && g.width === 320 && g.height === 240, `gif ${JSON.stringify(g)}`), ...want(v?.type === "svg", `svg ${JSON.stringify(v)}`), ...want(core.imageSize(Buffer.from("not a picture at all")) === null, "text is not a picture")];
  });

  await ctx("Images: page pictures with the largest srcset size, the optimiser address unwrapped, and the zone of each", () => {
    const html = `<head><meta property="og:image" content="/og.png"></head><body><nav><img src="/logo.png" alt="Logo"></nav>
      <main><img src="/a-small.jpg" srcset="/a-small.jpg 400w, /a-large.jpg 1200w" alt="Tiimi">
      <img src="/_next/image?url=%2Fkuvat%2Ftoimisto.webp&w=640&q=75" alt="Toimisto">
      <div style="background-image:url('/tausta.jpg')"></div></main><footer><img src="/footer.png"></footer></body>`;
    const got = core.htmlImages(html, "https://x.fi/");
    const by = (re) => got.find((i) => re.test(i.src));
    return [...want(by(/a-large\.jpg$/)?.alt === "Tiimi" && !by(/a-small/), `largest srcset: ${got.map((i) => i.src).join()}`), ...want(by(/\/kuvat\/toimisto\.webp$/)?.zone === "content", "optimiser address unwrapped"), ...want(by(/tausta\.jpg$/), "background picture"), ...want(by(/logo\.png$/)?.zone === "chrome" && by(/footer\.png$/)?.zone === "chrome", "navigation and footer marked"), ...want(by(/og\.png$/)?.zone === "share", "share picture marked")];
  });

  await ctx("Images: file names lose sizes, densities and build hashes", () => {
    const got = ["https://x.fi/kuvat/tiimi-1024x768.jpg", "https://x.fi/tiimi@2x.png", "https://x.fi/tiimi-scaled.webp", "https://x.fi/joonas-hero.d2095dcd.png"].map(core.imageStem);
    return want(got.join() === "tiimi,tiimi,tiimi,joonas-hero", got.join());
  });

  await ctx("Images: icons, logos, strips and navigation pictures are left off, a normal photo stays", () => {
    const I = (o) => ({ src: "https://x.fi/kuvat/tiimi.jpg", alt: "", zone: "content", type: "jpeg", width: 1200, height: 800, ...o });
    const r = [I({}), I({ type: "svg" }), I({ width: 64, height: 64 }), I({ width: 1600, height: 200 }), I({ src: "https://x.fi/kuvat/kumppani-logo.png" }), I({ alt: "Visa ja Mastercard" }), I({ zone: "chrome" }), I({ width: 0, height: 0 })].map(core.skipReason);
    return [...want(r[0] === "", `photo kept, got "${r[0]}"`), ...want(r.slice(1).every(Boolean), `every other one has a reason: ${JSON.stringify(r)}`)];
  });

  await ctx("Images: near-identical versions become one group, different pictures stay apart, the board takes from every page in turn", () => {
    const I = (src, hash, from, w = 900, h = 600) => ({ src, hash, from, width: w, height: h, stem: core.imageStem(src) });
    const groups = core.groupImages([I("https://x.fi/tiimi.jpg", "a", "p1"), I("https://x.fi/tiimi-rajattu.jpg", "b", "p1"), I("https://x.fi/kopio.jpg", "a", "p2", 1800, 1200), I("https://x.fi/toimisto.jpg", "c", "p1"), I("https://x.fi/toimisto-2.jpg", "d", "p1"), I("https://x.fi/asentaja.jpg", "e", "p2"), I("https://x.fi/auto.jpg", "f", "p1")]);
    const team = groups.find((g) => g.items.some((i) => /tiimi\.jpg/.test(i.src)));
    const { shown, left } = core.sampleGroups(groups, 3);
    return [...want(groups.length === 5, `5 groups, got ${groups.length}`), ...want(team?.items.length === 3 && /kopio/.test(team.rep.src), `same file and cropped version in one group, largest shown: ${team?.items.length} ${team?.rep.src}`), ...want(shown.length === 3 && left.length === 2 && shown.some((g) => g.rep.from === "p2"), `3 shown from both pages, got ${shown.map((g) => g.rep.src).join()}`)];
  });

  await ctx("Images: number answers read lists and ranges", () => want(core.parseNumbers("3,5 7-9; 5").join() === "3,5,7,8,9", core.parseNumbers("3,5 7-9; 5").join()));

  await ctx("Image board: a folder becomes a numbered board, the answer is saved, a wrong answer saves nothing, the report shows the choices", () => {
    const dir = copyExample();
    const pics = path.join(tmp, `kuvapankki-${n}`);
    fs.mkdirSync(path.join(pics, "vanhat"), { recursive: true });
    fs.writeFileSync(path.join(pics, "tiimi.png"), png(900, 600, "1"));
    fs.writeFileSync(path.join(pics, "tiimi-rajattu.png"), png(900, 600, "2"));
    fs.writeFileSync(path.join(pics, "toimisto.png"), png(1200, 800, "3"));
    fs.writeFileSync(path.join(pics, "vanhat", "hakkeri.png"), png(1000, 700, "4"));
    fs.writeFileSync(path.join(pics, "logo.png"), png(600, 600, "5"));
    fs.writeFileSync(path.join(pics, "ikoni.png"), png(48, 48, "6"));
    fs.writeFileSync(path.join(pics, "muistio.txt"), "ei kuva");
    node("images.mjs", "--dir", dir, "--folder", pics);
    const file = path.join(dir, "raw", "images.json");
    const read = () => JSON.parse(fs.readFileSync(file, "utf8"));
    const d = read();
    const board = fs.readFileSync(path.join(dir, "kuvataulu.html"), "utf8");
    const num = (re) => d.groups.find((g) => re.test(g.file))?.n;
    const p = [...want(d.groups.length === 3 && d.dropped.length === 2, `3 on the board and 2 dropped, got ${d.groups.length} and ${d.dropped.length}`), ...want(d.groups.find((g) => /tiimi/.test(g.file))?.versions.length === 2, "the cropped version is in the same group"), ...want(d.groups.every((g) => fs.existsSync(path.join(dir, g.file))), "picture files copied"), ...want(!fs.readFileSync(file, "utf8").includes(tmp) && !board.includes(tmp), "no full path of this machine in the files"), ...want(/KUURANTA IT/.test(board) && /Inter/.test(board) && /#1f6feb/i.test(board) && !/<script/i.test(board), "board in the company's look, no scripts")];
    let refused = "";
    try { node("images.mjs", "--dir", dir, "--good", "1,9", "--no", "1"); } catch (e) { refused = String(e.stderr || e.stdout || e.message); }
    p.push(...want(refused && read().groups.every((g) => !g.verdict), "an answer with a wrong number or a number in two lists saves nothing"));
    const out = node("images.mjs", "--dir", dir, "--good", String(num(/tiimi/)), "--no", String(num(/hakkeri/)));
    const after = read();
    p.push(...want(after.groups.find((g) => /tiimi/.test(g.file)).verdict === "good" && after.groups.find((g) => /hakkeri/.test(g.file)).verdict === "no" && /^\d{4}-\d\d-\d\d$/.test(after.answered ?? ""), "answer saved with its date"), ...want(new RegExp(`Not in any list: .*${num(/toimisto/)}`).test(out), `the unanswered picture is named: ${out.trim().slice(-120)}`));
    node("report.mjs", "--dir", dir);
    const rep = fs.readFileSync(path.join(dir, "report.html"), "utf8");
    p.push(...want(/Kuvat: omistajan valinnat/.test(rep) && /pic-good/.test(rep) && /pic-no/.test(rep), "report slide with the choices"));
    node("images.mjs", "--dir", dir, "--board", "--lang", "en");
    p.push(...want(fs.existsSync(path.join(dir, "image-board.html")), "English board"));
    return p;
  });

  await ctx("Example: the image board, its pictures and the picture lines in brandi.md belong together", () => {
    const d = JSON.parse(fs.readFileSync(path.join(example, "raw", "images.json"), "utf8"));
    const brand = fs.readFileSync(path.join(example, "brandi.md"), "utf8");
    const all = ["raw/images.json", "kuvataulu.html", "report.html", "README.md"].map((f) => fs.readFileSync(path.join(example, f), "utf8")).join("\n");
    return [...want(d.groups.every((g) => g.verdict && fs.existsSync(path.join(example, g.file))), "every picture has an answer and a file"), ...want(d.groups.filter((g) => g.verdict !== "unsure").every((g) => brand.includes(path.basename(g.file))), "brandi.md names an example file for each choice"), ...want(/\[vahvistettu: kuvataulu /.test(brand) && /\[päätelty: kuvataulun valinnat /.test(brand), "choices confirmed by the board, the rule derived from them"), ...want(!/\/Users\/|\/private\/|\/home\//.test(all), "no local paths in the example")];
  });
}

{
  // The fit step is one text shared by every skill: a skill folder can be copied alone, so each has its own copy.
  const skillsDir = path.join(scripts, "..", "..");
  const names = fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, "SKILL.md")));
  const texts = names.map((d) => (fs.existsSync(path.join(skillsDir, d, "sovitus.md")) ? fs.readFileSync(path.join(skillsDir, d, "sovitus.md"), "utf8") : null));
  const problems = [];
  names.forEach((d, i) => {
    if (texts[i] === null) problems.push(`${d}: sovitus.md missing`);
    else if (texts[i] !== texts[0]) problems.push(`${d}: sovitus.md differs from ${names[0]}`);
    if (!fs.readFileSync(path.join(skillsDir, d, "SKILL.md"), "utf8").includes("sovitus.md")) problems.push(`${d}: SKILL.md does not point to sovitus.md`);
  });
  n++;
  console.log(`${problems.length ? "FAIL" : "ok  "} Fit step: every skill has the same sovitus.md and points to it${problems.length ? `: ${problems.join("; ")}` : ""}`);
  if (problems.length) failed++;
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} of ${n} failed` : `\nall ${n} passed`);
process.exit(failed ? 1 : 0);
