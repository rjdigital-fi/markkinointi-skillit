#!/usr/bin/env node
// Brings an AI answer or a Google result page from ANY tool into the shared files. Node 18+, no dependencies.
// Save the tool's answer (MCP or API) as a JSON file, as it came, and run:
//
//   node answers.mjs ai   --file answer.json --prompt "the question" --engine "ChatGPT" [--dir .]
//   node answers.mjs serp --file serp.json   --keyword "main keyword"                 [--dir .]
//
// ai   -> adds one entry to chatgpt.json: prompt, engine, searches, sources, brands, answer
// serp -> writes serp-<keyword>.json: result_types, people_also_ask, organic
//
// The fields are found by name wherever they sit in the JSON, so the answer shapes of DataForSEO, SerpApi,
// SearchApi, HasData, Serper, Cloro and AI visibility tools all work. Always read the printed summary: it shows
// what was found, and a 0 means the tool names that part differently (write that part by hand then).
import fs from "node:fs";
import path from "node:path";

const [mode, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
if (!["ai", "serp"].includes(mode) || !args.file) {
  console.error('Usage: node answers.mjs ai --file answer.json --prompt "..." --engine "ChatGPT" [--dir .]\n       node answers.mjs serp --file serp.json --keyword "..." [--dir .]');
  process.exit(1);
}
const dir = path.resolve(args.dir ?? ".");
const norm = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").trim().toLowerCase();
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const domainOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};
const urlOf = (o) => [o.url, o.link, o.href, o.source_url, o.sourceUrl, o.uri].find((u) => typeof u === "string" && /^https?:\/\//.test(u));
const titleOf = (o) => [o.title, o.name, o.source_title, o.label].find((t) => typeof t === "string" && t.trim()) ?? "";
const textOf = (v) => (typeof v === "string" ? v : isObj(v) ? [v.question, v.query, v.keyword, v.text, v.title, v.name].find((t) => typeof t === "string" && t.trim()) : null);

/** Every value in the JSON whose key matches, with the key path. */
function collect(j, test, out = [], keyPath = "", depth = 0) {
  if (depth > 12 || !j || typeof j !== "object") return out;
  if (Array.isArray(j)) for (const x of j) collect(x, test, out, keyPath, depth + 1);
  else
    for (const [k, v] of Object.entries(j)) {
      if (test(norm(k), v)) out.push({ key: k, value: v, path: `${keyPath}/${k}` });
      collect(v, test, out, `${keyPath}/${k}`, depth + 1);
    }
  return out;
}
const uniq = (list) => [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
const strings = (v) => (Array.isArray(v) ? v.map(textOf).filter(Boolean) : typeof v === "string" ? [v] : []);

const json = JSON.parse(fs.readFileSync(args.file, "utf8").replace(/^﻿/, ""));
fs.mkdirSync(dir, { recursive: true });

if (mode === "ai") {
  if (!args.prompt) throw new Error("--prompt is required: the question that was asked");
  // The searches the assistant ran: fan_out_queries, search_queries, searchQueries, queries, web_searches ...
  const searches = uniq(collect(json, (k, v) => /fan ?out|search quer|^queries$|web search(es)?$|^searches$|search terms/.test(k) && (Array.isArray(v) || typeof v === "string")).flatMap((h) => strings(h.value)));
  // Sources: arrays named sources, citations, references, annotations ... whose items carry a URL.
  // Pages the assistant only read (search results, links) are used when the answer names no cited sources.
  const urlsUnder = (pattern) => {
    const found = [];
    for (const h of collect(json, (k, v) => pattern.test(k) && Array.isArray(v)))
      for (const item of h.value) {
        const u = typeof item === "string" ? (/^https?:\/\//.test(item) ? item : null) : isObj(item) ? urlOf(item) : null;
        if (u && !found.some((s) => s.url === u)) found.push({ domain: domainOf(u), url: u, title: isObj(item) ? titleOf(item) : "" });
      }
    return found;
  };
  let sources = urlsUnder(/source|citation|reference|annotation/);
  if (!sources.length) sources = urlsUnder(/^links?$|search results?$|^results$|organic/);
  // Brands: brand_entities, brands, mentions, entities, companies.
  const brands = uniq(collect(json, (k, v) => /brand|mention|^entities$|compan/.test(k) && Array.isArray(v)).flatMap((h) => strings(h.value)));
  // The answer text: the longest string under a key like text, answer, markdown, response, content, output.
  const texts = collect(json, (k, v) => /^(text|answer|markdown|response|content|output|message|result)$/.test(k) && typeof v === "string").map((h) => h.value);
  const answer = texts.sort((a, b) => b.length - a.length)[0] ?? "";
  const file = path.join(dir, "chatgpt.json");
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const entry = { prompt: args.prompt, engine: args.engine ?? "", searches, sources, brands, answer };
  const i = all.findIndex((a) => a.prompt === entry.prompt && (a.engine ?? "") === entry.engine);
  if (i > -1) all[i] = entry;
  else all.push(entry);
  fs.writeFileSync(file, JSON.stringify(all, null, 1));
  console.log(`searches: ${searches.length}\nsources: ${sources.length}${sources.length ? ` (${uniq(sources.map((s) => s.domain)).slice(0, 6).join(", ")})` : ""}\nbrands: ${brands.length}\nanswer: ${answer.length} characters\nchatgpt.json now has ${all.length} answers`);
} else {
  if (!args.keyword) throw new Error("--keyword is required");
  // Organic results: the array named organic / organic_results / organicResults, or items with type "organic".
  let organic = [];
  const named = collect(json, (k, v) => /^organic( results?)?$/.test(k) && Array.isArray(v)).sort((a, b) => b.value.length - a.value.length)[0];
  if (named) organic = named.value;
  else {
    const typed = collect(json, (k, v) => Array.isArray(v) && v.some((x) => isObj(x) && x.type === "organic")).sort((a, b) => b.value.length - a.value.length)[0];
    if (typed) organic = typed.value.filter((x) => isObj(x) && x.type === "organic");
  }
  const rows = organic
    .filter(isObj)
    .map((o, i) => {
      // Mobile results can link through a google.* redirect: the breadcrumb then names the real site.
      let url = urlOf(o) ?? "";
      let domain = (typeof o.domain === "string" && o.domain) || domainOf(url) || "";
      const crumb = typeof o.breadcrumb === "string" ? o.breadcrumb.match(/([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0] : null;
      if (/(^|\.)google\./.test(domain) && crumb) domain = crumb;
      return { rank: o.rank_group ?? o.position ?? o.rank ?? o.rank_absolute ?? i + 1, domain: String(domain).replace(/^www\./, ""), site_name: o.website_name ?? o.source ?? o.site_name ?? o.displayed_link ?? "", title: titleOf(o), url };
    })
    .filter((r) => r.domain || r.title);
  // People also ask: people_also_ask, peopleAlsoAsk, related_questions, inline_people_also_ask ...
  const paa = uniq(
    collect(json, (k, v) => /people also ask|related questions?|^questions$/.test(k) && Array.isArray(v)).flatMap((h) => h.value.flatMap((q) => (isObj(q) && Array.isArray(q.items) ? [textOf(q), ...q.items.map(textOf)] : [textOf(q)])).filter(Boolean)),
  ).concat(uniq(collect(json, (k, v) => Array.isArray(v) && v.some((x) => isObj(x) && x.type === "people_also_ask")).flatMap((h) => h.value.filter((x) => isObj(x) && x.type === "people_also_ask").flatMap((x) => (x.items ?? []).map(textOf).filter(Boolean)))));
  // Result types: DataForSEO lists them in item_types; other tools show them as top-level sections.
  const listed = collect(json, (k, v) => /^item types$/.test(k) && Array.isArray(v))[0]?.value;
  const KNOWN = { ai_overview: /^ai overview/, ai_mode: /^ai mode/, organic: /^organic/, people_also_ask: /people also ask|related questions/, local_pack: /^local (pack|results|map)|^places$/, shopping: /shopping|^products?$|product results/, knowledge_graph: /knowledge (graph|panel)/, featured_snippet: /featured snippet|answer box/, paid: /^ads?$|^paid|sponsored/, images: /^images?( results| pack)?$|inline images/, video: /^(inline )?videos?( results)?$/, top_stories: /top stories|^news( results)?$/, related_searches: /related searches|people also search/, discussions: /discussions|forums/ };
  const present = (v) => (Array.isArray(v) ? v.length > 0 : isObj(v) ? Object.keys(v).length > 0 : Boolean(v));
  const result_types = listed ? uniq(listed) : Object.entries(KNOWN).filter(([, p]) => collect(json, (k, v) => p.test(k) && present(v)).length).map(([name]) => name);
  const slug = args.keyword.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const out = { keyword: args.keyword, result_types, people_also_ask: uniq(paa), organic: rows.slice(0, 20) };
  fs.writeFileSync(path.join(dir, `serp-${slug}.json`), JSON.stringify(out, null, 1));
  console.log(`result types: ${result_types.join(", ") || 0}\npeople also ask: ${out.people_also_ask.length}\norganic: ${out.organic.length}${out.organic.length ? ` (1. ${out.organic[0].domain})` : ""}\nwrote serp-${slug}.json`);
}
