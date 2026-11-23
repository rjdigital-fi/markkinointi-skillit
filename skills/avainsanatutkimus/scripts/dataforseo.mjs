#!/usr/bin/env node
// DataForSEO adapter for the avainsanatutkimus skill. Node 18+, no dependencies.
// Credentials are read from the environment: DATAFORSEO_LOGIN (or DATAFORSEO_USERNAME) and DATAFORSEO_PASSWORD.
// Every answer is cached in <dir>/raw, so a rerun with the same input costs nothing. Use --fresh to fetch again.
//
//   node dataforseo.mjs check                                  (free: are the credentials set and accepted)
//   node dataforseo.mjs ideas     --seeds "a;b;c" [--match "regex"]
//   node dataforseo.mjs volumes   --keywords "a;b;c" | --file keywords.txt
//   node dataforseo.mjs ai-volume [--top 700]
//   node dataforseo.mjs chatgpt   --prompts prompts.json
//   node dataforseo.mjs serp      --keyword "a"
// Shared flags: --dir <work folder, default .>  --location <name or code, default Finland>  --language <code, default fi>
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}

const dir = path.resolve(args.dir ?? ".");
const rawDir = path.join(dir, "raw");
const kwFile = path.join(dir, "keywords.json");
const location = args.location ?? "Finland";
const MARKET = {
  ...(/^\d+$/.test(location) ? { location_code: Number(location) } : { location_name: location }),
  language_code: args.language ?? "fi",
};
const list = (s) => String(s).split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
let spent = 0;

function auth() {
  const login = process.env.DATAFORSEO_LOGIN ?? process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    console.error("Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the environment (API access in the DataForSEO dashboard).");
    process.exit(1);
  }
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

async function api(name, endpoint, body) {
  fs.mkdirSync(rawDir, { recursive: true });
  const hash = crypto.createHash("sha1").update(endpoint + JSON.stringify(body)).digest("hex").slice(0, 8);
  const file = path.join(rawDir, `${name}-${hash}.json`);
  if (fs.existsSync(file) && args.fresh !== "true") return JSON.parse(fs.readFileSync(file, "utf8"));
  const res = await fetch("https://api.dataforseo.com" + endpoint, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const task = json.tasks?.[0];
  if (json.status_code !== 20000 || !task || task.status_code !== 20000) {
    console.error(`DataForSEO error in ${name}: ${task?.status_message ?? json.status_message ?? res.status}`);
    process.exit(1);
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 1));
  spent += json.cost ?? 0;
  console.error(`${name}: fetched, cost ${json.cost ?? 0} USD`);
  return json;
}

const readKeywords = () => new Map((fs.existsSync(kwFile) ? JSON.parse(fs.readFileSync(kwFile, "utf8")) : []).map((r) => [r.keyword, r]));
function saveKeywords(map) {
  const rows = [...map.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(kwFile, JSON.stringify(rows, null, 1));
  return rows;
}
/** New values win, but an empty new value never erases an old one. */
function merge(map, row) {
  const old = map.get(row.keyword) ?? {};
  const out = { ...old };
  for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined) out[k] = v;
  map.set(row.keyword, out);
}
const fromGoogleAds = (k) => ({
  keyword: k.keyword,
  volume: k.search_volume ?? null,
  cpc: k.cpc ?? null,
  bid_low: k.low_top_of_page_bid ?? null,
  bid_high: k.high_top_of_page_bid ?? null,
  competition: k.competition ?? null,
  months: (k.monthly_searches ?? []).map((m) => ({ month: `${m.year}-${String(m.month).padStart(2, "0")}`, volume: m.search_volume })).sort((a, b) => a.month.localeCompare(b.month)),
  source: "DataForSEO (Google Ads)",
});

const commands = {
  /** Free call: confirms that the credentials are set and accepted. Prints no secrets. */
  async check() {
    const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: auth() } });
    const j = await res.json();
    if (j.status_code !== 20000) throw new Error(`DataForSEO did not accept the credentials: ${j.status_message ?? res.status}`);
    console.log(`DataForSEO: credentials accepted, balance ${j.tasks?.[0]?.result?.[0]?.money?.balance ?? "?"} USD`);
  },

  /** Keyword ideas with volumes and bids for up to 20 seeds per call. */
  async ideas() {
    const seeds = list(args.seeds ?? "");
    if (!seeds.length) throw new Error('give --seeds "a;b;c"');
    const match = args.match ? new RegExp(args.match, "i") : null;
    const map = readKeywords();
    let found = 0;
    let kept = 0;
    for (const [i, keywords] of chunk(seeds, 20).entries()) {
      const j = await api(`ideas-${i}`, "/v3/keywords_data/google_ads/keywords_for_keywords/live", [{ keywords, ...MARKET, sort_by: "search_volume" }]);
      for (const k of j.tasks[0].result ?? []) {
        found++;
        if (match && !match.test(k.keyword)) continue;
        kept++;
        merge(map, fromGoogleAds(k));
      }
    }
    const rows = saveKeywords(map);
    console.log(`ideas: ${found} found, ${kept} kept${match ? " after --match" : ""}; keywords.json now has ${rows.length} rows`);
    console.log(rows.slice(0, 15).map((r) => `${r.volume ?? "-"}\t${r.cpc ?? "-"}\t${r.keyword}`).join("\n"));
  },

  /** Exact volumes and bids for a given list, e.g. city variants that the ideas call did not return. */
  async volumes() {
    const keywords = args.file ? list(fs.readFileSync(args.file, "utf8")) : list(args.keywords ?? "");
    if (!keywords.length) throw new Error('give --keywords "a;b" or --file keywords.txt');
    const map = readKeywords();
    for (const [i, part] of chunk(keywords, 1000).entries()) {
      const j = await api(`volumes-${i}`, "/v3/keywords_data/google_ads/search_volume/live", [{ keywords: part, ...MARKET }]);
      for (const k of j.tasks[0].result ?? []) merge(map, fromGoogleAds(k));
    }
    const rows = saveKeywords(map);
    const set = new Set(keywords.map((k) => k.toLowerCase()));
    console.log(rows.filter((r) => set.has(r.keyword.toLowerCase())).map((r) => `${r.volume ?? "-"}\t${r.cpc ?? "-"}\t${r.keyword}`).join("\n"));
  },

  /** AI search volume estimates for the biggest keywords in keywords.json (or for --keywords). */
  async "ai-volume"() {
    const map = readKeywords();
    const wanted = args.keywords
      ? list(args.keywords)
      : [...map.values()].filter((r) => r.ai_volume == null).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, Number(args.top ?? 700)).map((r) => r.keyword);
    if (!wanted.length) throw new Error("no keywords without ai_volume; run ideas first");
    let n = 0;
    for (const [i, part] of chunk(wanted, 1000).entries()) {
      const j = await api(`ai-volume-${i}`, "/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live", [{ keywords: part, ...MARKET }]);
      for (const it of j.tasks[0].result?.[0]?.items ?? []) {
        merge(map, { keyword: it.keyword, ai_volume: it.ai_search_volume ?? 0 });
        n++;
      }
    }
    saveKeywords(map);
    console.log(`ai-volume: ${n} of ${wanted.length} keywords have an estimate`);
  },

  /** Real ChatGPT answers with web search: the searches it ran, its sources and the brands it named. */
  async chatgpt() {
    if (!args.prompts) throw new Error("give --prompts prompts.json (a JSON array or one question per line)");
    const text = fs.readFileSync(args.prompts, "utf8");
    const prompts = text.trim().startsWith("[") ? JSON.parse(text) : list(text);
    const out = [];
    for (const [i, prompt] of prompts.entries()) {
      const j = await api(`chatgpt-${i}`, "/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced", [{ keyword: prompt, ...MARKET }]);
      const r = j.tasks[0].result?.[0] ?? {};
      out.push({
        prompt,
        searches: r.fan_out_queries ?? [],
        sources: (r.sources ?? []).map((s) => ({ domain: s.domain, url: s.url, title: s.title })),
        brands: (r.brand_entities ?? []).map((b) => b.title),
        answer: r.markdown ?? "",
      });
    }
    fs.writeFileSync(path.join(dir, "chatgpt.json"), JSON.stringify(out, null, 1));
    for (const o of out) console.log(`\n${o.prompt}\n  searches: ${o.searches.join(" | ") || "-"}\n  sources: ${[...new Set(o.sources.map((s) => s.domain))].join(", ") || "-"}\n  brands: ${o.brands.join(", ") || "-"}`);
  },

  /** Google result page on mobile: result types, People also ask questions and the top organic results. */
  async serp() {
    if (!args.keyword) throw new Error('give --keyword "a"');
    const j = await api("serp", "/v3/serp/google/organic/live/advanced", [{ keyword: args.keyword, ...MARKET, device: "mobile", people_also_ask_click_depth: 2 }]);
    const r = j.tasks[0].result?.[0] ?? {};
    const items = r.items ?? [];
    const out = {
      keyword: args.keyword,
      result_types: r.item_types ?? [],
      people_also_ask: items.filter((i) => i.type === "people_also_ask").flatMap((i) => (i.items ?? []).map((q) => q.title)),
      // On mobile Google may wrap result links in its own redirect; the real site is then in the breadcrumb.
      organic: items.filter((i) => i.type === "organic").slice(0, 10).map((o) => {
        const wrapped = /(^|\.)google\.[a-z.]+$/.test(o.domain ?? "") && /\/goto\?/.test(o.url ?? "");
        const site = wrapped ? String(o.breadcrumb ?? "").split(/[\s›]/)[0].replace(/^https?:\/\//, "").replace(/^www\./, "") : null;
        return { rank: o.rank_group, domain: site || o.domain, site_name: o.website_name ?? null, title: o.title, url: wrapped ? (site ? `https://${site}` : null) : o.url };
      }),
    };
    const slug = args.keyword.toLowerCase().replace(/[^a-z0-9äöå]+/g, "-").replace(/^-|-$/g, "");
    fs.writeFileSync(path.join(dir, `serp-${slug}.json`), JSON.stringify(out, null, 1));
    console.log(`types: ${out.result_types.join(", ")}\n\nPeople also ask:\n${out.people_also_ask.map((q) => "  " + q).join("\n")}\n\nTop results:\n${out.organic.map((o) => `  ${o.rank}. ${o.domain}: ${o.title}`).join("\n")}`);
  },
};

if (!commands[cmd]) {
  console.error("Commands: check, ideas, volumes, ai-volume, chatgpt, serp. See the comment at the top of this file.");
  process.exit(1);
}
try {
  await commands[cmd]();
  console.error(`total cost of this run: ${spent.toFixed(4)} USD`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
