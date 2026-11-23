#!/usr/bin/env node
// Builds the report from keywords.json + groups.json (+ chatgpt.json and serp-*.json when they exist).
// Writes report.md and keywords.csv into the work folder. Node 18+, no dependencies. Makes no network calls.
//
//   node report.mjs [--dir .] [--budget 1000] [--lang fi|en]
//
// groups.json:
// { "topic": "ilmalämpöpumppu", "market": "Suomi, suomi", "currency": "USD", "main": "ilmalämpöpumppu",
//   "groups": [{ "name": "Hinta", "intent": "Osto", "weight": 0.5, "business": 1, "page": "Hintasivu",
//                "channel": "Google Ads + SEO", "keywords": ["ilmalämpöpumppu hinta|ilmalämpöpumpun hinta", "..."] }] }
// "a|b" = main form | close variant. Google usually reports the same volume for both, so only the main form's
// volume is counted; the variant is shown in the table and its AI volume is used when it is larger.
// A keyword without a CPC (Keyword Planner exports have only bids) uses the midpoint of its low and high bid.
// Budget share of a group = sum(volume x cpc) x weight x business, as a share of all groups.
import fs from "node:fs";
import path from "node:path";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? ".");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const has = (f) => fs.existsSync(path.join(dir, f));

if (!has("keywords.json") || !has("groups.json")) {
  console.error("report.mjs needs keywords.json and groups.json in " + dir);
  process.exit(1);
}
const keywords = read("keywords.json");
const cfg = read("groups.json");
const lang = args.lang ?? cfg.lang ?? "fi";
const T = {
  fi: { title: "Avainsanatutkimus", data: "Data", market: "Markkina", fetched: "Raportti tehty", found: "hakusanaa löytyi", grouped: "valittu ryhmiin", map: "Aihekartta", perMonth: "hakua/kk", table: "Hakusanat ryhmittäin", kw: "Hakusana", vol: "Haut/kk", cpc: "Klikkaushinta", bid: "Sivun yläosan hinta", comp: "Kilpailu", ai: "Tekoälyhaut/kk", intent: "Hakuaikomus", page: "Sivu", channel: "Kanava", season: "Kausivaihtelu", month: "Kuukausi", peak: "huippu", budget: "Budjetin jako", group: "Ryhmä", weight: "Paino", share: "Osuus", perMonthMoney: "kk", budgetNote: "Osuus = ryhmän (haut × klikkaushinta) × hakuaikomuksen paino × liiketoiminnan paino. Jako on lähtökohta, jota oikea mainosdata tarkentaa.", noCpc: "Hakusanat ilman klikkaushintaa eivät vaikuta jakoon", aiq: "Tekoälyn vastaukset", searches: "Tekoälyn tekemät haut", sources: "Lähteet", brands: "Mainitut yritykset ja merkit", serp: "Googlen tulossivu", types: "Tulostyypit", paa: "Muut kysyvät myös", top: "Kärkitulokset", rest: "Suurimmat ryhmittelemättömät hakusanat", missing: "Ryhmissä on hakusanoja, joita datassa ei ole", total: "Yhteensä", variant: "myös", noData: "ei dataa" },
  en: { title: "Keyword research", data: "Data", market: "Market", fetched: "Report built", found: "keywords found", grouped: "picked into groups", map: "Topic map", perMonth: "searches/mo", table: "Keywords by group", kw: "Keyword", vol: "Searches/mo", cpc: "CPC", bid: "Top of page bid", comp: "Competition", ai: "AI searches/mo", intent: "Intent", page: "Page", channel: "Channel", season: "Seasonality", month: "Month", peak: "peak", budget: "Budget split", group: "Group", weight: "Weight", share: "Share", perMonthMoney: "mo", budgetNote: "Share = the group's (searches × CPC) × intent weight × business weight. The split is a starting point that real ad data refines.", noCpc: "Keywords without a CPC do not affect the split", aiq: "AI answers", searches: "Searches the AI ran", sources: "Sources", brands: "Companies and brands named", serp: "Google result page", types: "Result types", paa: "People also ask", top: "Top results", rest: "Largest ungrouped keywords", missing: "Groups name keywords that are not in the data", total: "Total", variant: "also", noData: "no data" },
}[lang === "en" ? "en" : "fi"];
const loc = lang === "en" ? "en-US" : "fi-FI";
const cur = cfg.currency ?? keywords.find((k) => k.currency)?.currency ?? "USD";
const n = (v) => (v == null ? "–" : Math.round(v).toLocaleString(loc));
const money = (v) => (v == null ? "–" : v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + cur);
const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
const byKw = new Map(keywords.map((k) => [k.keyword.toLowerCase(), k]));

const missing = [];
const groups = (cfg.groups ?? []).map((g) => {
  const rows = (g.keywords ?? []).map((entry) => {
    const forms = entry.split("|").map((f) => f.trim().toLowerCase());
    const found = forms.map((f) => byKw.get(f)).filter(Boolean);
    forms.filter((f) => !byKw.has(f)).forEach((f) => missing.push(f));
    const k = found[0] ?? {};
    const ai = found.map((f) => f.ai_volume).filter((v) => v != null);
    return { keyword: forms[0], variants: forms.slice(1), volume: k.volume ?? null, cpc: k.cpc ?? (k.bid_low != null && k.bid_high != null ? (k.bid_low + k.bid_high) / 2 : null), bid_low: k.bid_low ?? null, bid_high: k.bid_high ?? null, competition: k.competition ?? null, ai_volume: ai.length ? Math.max(...ai) : null };
  });
  rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  const volume = rows.reduce((s, r) => s + (r.volume ?? 0), 0);
  const spend = rows.reduce((s, r) => s + (r.volume ?? 0) * (r.cpc ?? 0), 0);
  const weight = g.weight ?? 0;
  const business = g.business ?? 1;
  return { ...g, rows, volume, spend, weight, business, score: spend * weight * business };
});
const totalScore = groups.reduce((s, g) => s + g.score, 0);
const budget = args.budget ? Number(args.budget) : null;
const anyAi = groups.some((g) => g.rows.some((r) => r.ai_volume != null));
const anyBid = groups.some((g) => g.rows.some((r) => r.bid_low != null || r.bid_high != null));
const sources = [...new Set(keywords.map((k) => k.source).filter(Boolean))];

const out = [];
out.push(`# ${T.title}: ${cfg.topic ?? ""}`, "");
out.push(`- ${T.data}: ${sources.join(", ") || T.noData}`);
if (cfg.market) out.push(`- ${T.market}: ${cfg.market}`);
out.push(`- ${T.fetched}: ${new Date().toISOString().slice(0, 10)}`);
out.push(`- ${n(keywords.length)} ${T.found}, ${n(groups.reduce((s, g) => s + g.rows.length, 0))} ${T.grouped}`, "");

// Mermaid mind map: the topic in the middle, groups around it, the biggest keywords under each group.
const safe = (s) => String(s).replace(/[()[\]{}"`]/g, "").trim();
out.push(`## ${T.map}`, "", "```mermaid", "mindmap", `  root((${safe(cfg.topic ?? T.title)}))`);
for (const g of groups) {
  out.push(`    ${safe(g.name)} · ${n(g.volume)} ${T.perMonth}`);
  for (const r of g.rows.slice(0, 4)) out.push(`      ${safe(r.keyword)} · ${n(r.volume)}`);
}
out.push("```", "");

out.push(`## ${T.table}`, "");
for (const g of groups) {
  out.push(`### ${g.name} · ${n(g.volume)} ${T.perMonth}`, "");
  const meta = [g.intent && `${T.intent}: ${g.intent}`, g.page && `${T.page}: ${g.page}`, g.channel && `${T.channel}: ${g.channel}`].filter(Boolean);
  if (meta.length) out.push(meta.join(" · "), "");
  const head = [T.kw, T.vol, T.cpc, ...(anyBid ? [T.bid] : []), T.comp, ...(anyAi ? [T.ai] : [])];
  out.push(`| ${head.join(" | ")} |`, `|${head.map((_, i) => (i === 0 ? " --- " : " ---: ")).join("|")}|`);
  for (const r of g.rows) {
    const name = r.variants.length ? `${r.keyword} (${T.variant}: ${r.variants.join(", ")})` : r.keyword;
    const bid = r.bid_low != null || r.bid_high != null ? `${money(r.bid_low)} – ${money(r.bid_high)}` : "–";
    out.push(`| ${[cell(name), n(r.volume), money(r.cpc), ...(anyBid ? [bid] : []), r.competition ?? "–", ...(anyAi ? [n(r.ai_volume)] : [])].join(" | ")} |`);
  }
  out.push("");
}

// Seasonality of the main keyword: twelve latest months as text bars.
const main = byKw.get(String(cfg.main ?? cfg.topic ?? "").toLowerCase()) ?? keywords.find((k) => k.months?.length);
if (main?.months?.length) {
  const months = main.months.slice(-12);
  const max = Math.max(...months.map((m) => m.volume ?? 0)) || 1;
  out.push(`## ${T.season}: ${main.keyword}`, "", `| ${T.month} | ${T.vol} | |`, "| --- | ---: | --- |");
  for (const m of months) out.push(`| ${m.month} | ${n(m.volume)} | ${"█".repeat(Math.max(1, Math.round(((m.volume ?? 0) / max) * 20)))}${m.volume === max ? ` ${T.peak}` : ""} |`);
  out.push("");
}

out.push(`## ${T.budget}`, "");
const bHead = [T.group, T.intent, T.weight, T.share, ...(budget ? [`${cur}/${T.perMonthMoney}`] : [])];
out.push(`| ${bHead.join(" | ")} |`, `| --- | --- |${bHead.slice(2).map(() => " ---: ").join("|")}|`);
for (const g of [...groups].sort((a, b) => b.score - a.score)) {
  const share = totalScore ? g.score / totalScore : 0;
  const w = (g.weight * g.business).toLocaleString(loc, { maximumFractionDigits: 2 });
  out.push(`| ${[cell(g.name), cell(g.intent ?? "–"), w, (share * 100).toLocaleString(loc, { maximumFractionDigits: 1 }) + " %", ...(budget ? [n(share * budget)] : [])].join(" | ")} |`);
}
if (budget) out.push(`| **${T.total}** | | | 100 % | **${n(budget)}** |`);
out.push("", T.budgetNote);
const noCpc = groups.flatMap((g) => g.rows).filter((r) => r.cpc == null).length;
if (noCpc) out.push("", `${T.noCpc}: ${noCpc}.`);
out.push("");

if (has("chatgpt.json")) {
  out.push(`## ${T.aiq}`, "");
  for (const a of read("chatgpt.json")) {
    out.push(`### ${a.prompt}${a.engine ? ` (${a.engine})` : ""}`, "");
    if (a.searches?.length) out.push(`- ${T.searches}: ${a.searches.join(" · ")}`);
    const domains = [...new Set((a.sources ?? []).map((s) => s.domain ?? s))].filter(Boolean);
    if (domains.length) out.push(`- ${T.sources}: ${domains.join(", ")}`);
    if (a.brands?.length) out.push(`- ${T.brands}: ${a.brands.join(", ")}`);
    out.push("");
  }
}
const serps = fs.readdirSync(dir).filter((f) => /^serp-.*\.json$/.test(f));
if (serps.length) {
  out.push(`## ${T.serp}`, "");
  for (const f of serps) {
    const s = read(f);
    out.push(`### ${s.keyword}`, "");
    if (s.result_types?.length) out.push(`- ${T.types}: ${s.result_types.join(", ")}`);
    if (s.people_also_ask?.length) out.push(`- ${T.paa}:`, ...s.people_also_ask.map((q) => `  - ${q}`));
    if (s.organic?.length) out.push(`- ${T.top}:`, ...s.organic.slice(0, 10).map((o) => `  - ${o.rank}. ${o.domain}: ${o.title}`));
    out.push("");
  }
}

const used = new Set(groups.flatMap((g) => (g.keywords ?? []).flatMap((e) => e.split("|").map((f) => f.trim().toLowerCase()))));
const restRows = keywords.filter((k) => !used.has(k.keyword.toLowerCase())).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 25);
if (restRows.length) {
  out.push(`## ${T.rest}`, "", `| ${T.kw} | ${T.vol} | ${T.cpc} |`, "| --- | ---: | ---: |");
  for (const r of restRows) out.push(`| ${cell(r.keyword)} | ${n(r.volume)} | ${money(r.cpc)} |`);
  out.push("");
}
if (missing.length) out.push(`> ${T.missing}: ${[...new Set(missing)].join(", ")}`, "");

fs.writeFileSync(path.join(dir, "report.md"), out.join("\n"));

const groupOf = new Map(groups.flatMap((g) => g.rows.flatMap((r) => [r.keyword, ...r.variants].map((f) => [f, g]))));
const q = (v) => (v == null ? "" : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [["keyword", "group", "intent", "volume", "cpc", "bid_low", "bid_high", "competition", "ai_volume", "source"].join(",")];
for (const k of keywords) {
  const g = groupOf.get(k.keyword.toLowerCase());
  csv.push([k.keyword, g?.name, g?.intent, k.volume, k.cpc, k.bid_low, k.bid_high, k.competition, k.ai_volume, k.source].map(q).join(","));
}
fs.writeFileSync(path.join(dir, "keywords.csv"), "﻿" + csv.join("\n") + "\n");

console.log(`report.md and keywords.csv written to ${dir}`);
console.log(groups.map((g) => `${g.name}: ${g.rows.length} keywords, ${n(g.volume)} ${T.perMonth}, ${totalScore ? ((g.score / totalScore) * 100).toFixed(1) : 0} %`).join("\n"));
if (missing.length) console.log(`MISSING from data: ${[...new Set(missing)].join(", ")}`);
