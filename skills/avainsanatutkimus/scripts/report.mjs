#!/usr/bin/env node
// Builds the report from keywords.json + groups.json (+ chatgpt.json, serp-*.json and site.json when they exist).
// Writes report.md and keywords.csv into the work folder. Node 18+, no dependencies. Makes no network calls.
//
//   node report.mjs [--dir .] [--budget 1000-2000] [--lang fi|en]
//
// groups.json:
// { "topic": "ilmalämpöpumppu", "market": "Suomi, suomi", "currency": "USD", "main": "ilmalämpöpumppu",
//   "report_currency": "EUR", "budget": { "low": 1000, "high": 2000 },
//   "rate": { "value": 0.91, "date": "2026-11-20", "source": "Euroopan keskuspankki" },
//   "groups": [{ "name": "Hinta", "intent": "Osto", "weight": 0.5, "business": 1, "page": "Hintasivu",
//                "channel": "Google Ads + SEO", "keywords": ["ilmalämpöpumppu hinta|ilmalämpöpumpun hinta", "..."] }] }
// "a|b" = main form | close variant. Google usually reports the same volume for both, so only the main form's
// volume is counted; the variant is shown in the table and its AI volume is used when it is larger.
// A keyword without a CPC (Keyword Planner exports have only bids) uses the midpoint of its low and high bid.
// Budget share of a group = sum(volume x cpc) x weight x business, as a share of all groups.
// Money is shown in report_currency (EUR by default). The budget is a monthly range in that currency, from
// groups.json or --budget "low-high" (one number is fine too). When the source's prices are in another currency,
// "rate" (one unit of the source currency in report_currency, written by rate.mjs) converts them. Without a
// rate the prices stay in the source currency and the report says so.
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
  fi: { site: "Oma sivusto hakutuloksissa", siteNote: "Luvut kertovat sivuston omasta näkyvyydestä. Markkinan hakumäärät ovat yllä olevissa taulukoissa.", siteKw: "Hakusanoja näkyvissä", imp: "Näyttökerrat", clicks: "Klikkaukset", pos: "Keskisijainti", near: "Lähellä kärkeä: sijat 5–15", nearNone: "Ryhmien hakusanoista yksikään ei ole sijoilla 5–15.", siteNone: "Ryhmät, joissa sivusto ei vielä näy", siteOther: "Muut haut, joilla sivusto näkyy", title: "Avainsanatutkimus", data: "Data", market: "Markkina", fetched: "Raportti tehty", found: "hakusanaa löytyi", grouped: "valittu ryhmiin", map: "Aihekartta", perMonth: "hakua/kk", table: "Hakusanat ryhmittäin", kw: "Hakusana", vol: "Haut/kk", cpc: "Klikkaushinta", bid: "Sivun yläosan hinta", comp: "Kilpailu", ai: "Tekoälyhaut/kk", intent: "Hakuaikomus", page: "Sivu", channel: "Kanava", season: "Kausivaihtelu", month: "Kuukausi", peak: "huippu", budget: "Budjetin jako", group: "Ryhmä", weight: "Paino", share: "Osuus", perMonthMoney: "kk", budgetRange: "Alustava budjetti", rateNote: (from, to, r) => `Klikkaushinnat on muunnettu valuutasta ${from} valuuttaan ${to} kurssilla ${r.value.toLocaleString("fi-FI", { maximumFractionDigits: 4 })}${r.source || r.date ? ` (${[r.source, r.date].filter(Boolean).join(", ")})` : ""}.`, noRate: (from, to) => `Klikkaushinnat ovat lähteen valuutassa ${from}, koska vaihtokurssia valuuttaan ${to} ei ole annettu. Budjetin osuudet eivät riipu valuutasta.`, budgetNote: "Osuus = ryhmän (haut × klikkaushinta) × hakuaikomuksen paino × liiketoiminnan paino. Jako on lähtökohta, jota oikea mainosdata tarkentaa.", noCpc: "Hakusanat ilman klikkaushintaa eivät vaikuta jakoon", aiq: "Tekoälyn vastaukset", searches: "Tekoälyn tekemät haut", sources: "Lähteet", brands: "Mainitut yritykset ja merkit", serp: "Googlen tulossivu", types: "Tulostyypit", paa: "Muut kysyvät myös", top: "Kärkitulokset", rest: "Suurimmat ryhmittelemättömät hakusanat", missing: "Ryhmissä on hakusanoja, joita datassa ei ole", total: "Yhteensä", variant: "myös", noData: "ei dataa" },
  en: { site: "Your site in search results", siteNote: "These numbers show the site's own visibility. Market search volumes are in the tables above.", siteKw: "Keywords visible", imp: "Impressions", clicks: "Clicks", pos: "Avg. position", near: "Close to the top: positions 5–15", nearNone: "None of the grouped keywords is at positions 5–15.", siteNone: "Groups where the site is not visible yet", siteOther: "Other searches the site is visible for", title: "Keyword research", data: "Data", market: "Market", fetched: "Report built", found: "keywords found", grouped: "picked into groups", map: "Topic map", perMonth: "searches/mo", table: "Keywords by group", kw: "Keyword", vol: "Searches/mo", cpc: "CPC", bid: "Top of page bid", comp: "Competition", ai: "AI searches/mo", intent: "Intent", page: "Page", channel: "Channel", season: "Seasonality", month: "Month", peak: "peak", budget: "Budget split", group: "Group", weight: "Weight", share: "Share", perMonthMoney: "mo", budgetRange: "Preliminary budget", rateNote: (from, to, r) => `Click prices are converted from ${from} to ${to} at ${r.value.toLocaleString("en-US", { maximumFractionDigits: 4 })}${r.source || r.date ? ` (${[r.source, r.date].filter(Boolean).join(", ")})` : ""}.`, noRate: (from, to) => `Click prices are in the source currency ${from}, because no exchange rate to ${to} was given. The budget shares do not depend on the currency.`, budgetNote: "Share = the group's (searches × CPC) × intent weight × business weight. The split is a starting point that real ad data refines.", noCpc: "Keywords without a CPC do not affect the split", aiq: "AI answers", searches: "Searches the AI ran", sources: "Sources", brands: "Companies and brands named", serp: "Google result page", types: "Result types", paa: "People also ask", top: "Top results", rest: "Largest ungrouped keywords", missing: "Groups name keywords that are not in the data", total: "Total", variant: "also", noData: "no data" },
}[lang === "en" ? "en" : "fi"];
const loc = lang === "en" ? "en-US" : "fi-FI";
const srcCur = String(cfg.currency ?? keywords.find((k) => k.currency)?.currency ?? "USD").toUpperCase();
const outCur = String(cfg.report_currency ?? "EUR").toUpperCase();
const rate = srcCur !== outCur && Number(cfg.rate?.value) > 0 ? { ...cfg.rate, value: Number(cfg.rate.value) } : null;
const fx = rate ? rate.value : 1;
const priceCur = srcCur === outCur || rate ? outCur : srcCur; // the currency the click prices are shown in
const sym = (c) => ({ EUR: "€", USD: "$", GBP: "£" })[c] ?? c;
const cur = sym(priceCur);
const conv = (v) => (v == null ? null : v * fx);
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
    return { keyword: forms[0], variants: forms.slice(1), volume: k.volume ?? null, cpc: conv(k.cpc ?? (k.bid_low != null && k.bid_high != null ? (k.bid_low + k.bid_high) / 2 : null)), bid_low: conv(k.bid_low ?? null), bid_high: conv(k.bid_high ?? null), competition: k.competition ?? null, ai_volume: ai.length ? Math.max(...ai) : null };
  });
  rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  const volume = rows.reduce((s, r) => s + (r.volume ?? 0), 0);
  const spend = rows.reduce((s, r) => s + (r.volume ?? 0) * (r.cpc ?? 0), 0);
  const weight = g.weight ?? 0;
  const business = g.business ?? 1;
  return { ...g, rows, volume, spend, weight, business, score: spend * weight * business };
});
const totalScore = groups.reduce((s, g) => s + g.score, 0);
// Budget: a monthly range in the report currency. "1000-2000", "1000" or { low, high } in groups.json.
const num = (v) => Number(String(v).replace(/[\s\u00a0]/g, "").replace(",", "."));
const parseBudget = (b) => {
  if (b == null || b === "" || b === "true") return null;
  const parts = typeof b === "object" ? [b.low ?? b.min ?? b.high, b.high ?? b.max ?? b.low] : String(b).split(/\s*[-–]\s*/).slice(0, 2);
  const v = parts.map(num).filter((x) => x > 0).sort((a, b) => a - b);
  return v.length ? { low: v[0], high: v[v.length - 1] } : null;
};
const budget = parseBudget(args.budget) ?? parseBudget(cfg.budget);
const range = (lo, hi) => (Math.round(lo) === Math.round(hi) ? n(lo) : `${n(lo)}–${n(hi)}`);
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
if (budget) out.push(`${T.budgetRange}: ${range(budget.low, budget.high)} ${sym(outCur)}/${T.perMonthMoney}`, "");
const bHead = [T.group, T.intent, T.weight, T.share, ...(budget ? [`${sym(outCur)}/${T.perMonthMoney}`] : [])];
out.push(`| ${bHead.join(" | ")} |`, `| --- | --- |${bHead.slice(2).map(() => " ---: ").join("|")}|`);
for (const g of [...groups].sort((a, b) => b.score - a.score)) {
  const share = totalScore ? g.score / totalScore : 0;
  const w = (g.weight * g.business).toLocaleString(loc, { maximumFractionDigits: 2 });
  out.push(`| ${[cell(g.name), cell(g.intent ?? "–"), w, (share * 100).toLocaleString(loc, { maximumFractionDigits: 1 }) + " %", ...(budget ? [range(share * budget.low, share * budget.high)] : [])].join(" | ")} |`);
}
if (budget) out.push(`| **${T.total}** | | | 100 % | **${range(budget.low, budget.high)}** |`);
out.push("", T.budgetNote);
if (rate) out.push("", T.rateNote(srcCur, outCur, rate));
else if (srcCur !== outCur) out.push("", T.noRate(srcCur, outCur));
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

// The site's own visibility (Search Console, Bing Webmaster Tools), matched to the groups by exact keyword.
let siteLog = "";
if (has("site.json")) {
  const site = read("site.json");
  const pos = (v) => (v == null ? "–" : v.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const pagePath = (p) => {
    if (!p) return "–";
    try {
      const u = new URL(p);
      return u.pathname + u.search;
    } catch {
      return p;
    }
  };
  const grouped = new Set(groups.flatMap((g) => g.rows.flatMap((r) => [r.keyword, ...r.variants])));
  out.push(`## ${T.site}`, "", T.siteNote, "");
  for (const source of [...new Set(site.map((s) => s.source ?? ""))]) {
    const rows = site.filter((s) => (s.source ?? "") === source);
    const byQ = new Map(rows.map((s) => [String(s.query).toLowerCase(), s]));
    // One hit per keyword row: the form (main or variant) with the most impressions.
    const hitOf = (r) => [r.keyword, ...r.variants].map((f) => byQ.get(f)).filter(Boolean).sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0];
    out.push(`### ${[source, rows.find((s) => s.period)?.period].filter(Boolean).join(" · ") || T.site}`, "");
    out.push(`| ${[T.group, T.siteKw, T.imp, T.clicks, T.pos, T.page].join(" | ")} |`, "| --- | ---: | ---: | ---: | ---: | --- |");
    const none = [];
    const near = [];
    let matched = 0;
    for (const g of groups) {
      const hits = g.rows.map((r) => [r, hitOf(r)]).filter(([, h]) => h);
      matched += hits.length;
      if (!hits.length) none.push(g.name);
      const imp = hits.reduce((s, [, h]) => s + (h.impressions ?? 0), 0);
      const withPos = hits.filter(([, h]) => h.position != null);
      const weight = withPos.reduce((s, [, h]) => s + (h.impressions || 1), 0);
      const avg = withPos.length ? withPos.reduce((s, [, h]) => s + h.position * (h.impressions || 1), 0) / weight : null;
      const top = [...hits].sort((a, b) => (b[1].impressions ?? 0) - (a[1].impressions ?? 0)).find(([, h]) => h.page)?.[1].page;
      out.push(`| ${[cell(g.name), `${hits.length}/${g.rows.length}`, hits.length ? n(imp) : "–", hits.length ? n(hits.reduce((s, [, h]) => s + (h.clicks ?? 0), 0)) : "–", pos(avg), cell(pagePath(top))].join(" | ")} |`);
      for (const [r, h] of hits) if (h.position >= 5 && h.position <= 15) near.push({ r, h, g });
    }
    out.push("");
    if (none.length) out.push(`${T.siteNone}: ${none.join(", ")}.`, "");
    out.push(`#### ${T.near}`, "");
    if (near.length) {
      out.push(`| ${[T.kw, T.group, T.vol, T.imp, T.pos, T.page].join(" | ")} |`, "| --- | --- | ---: | ---: | ---: | --- |");
      for (const { r, h, g } of near.sort((a, b) => (b.r.volume ?? 0) - (a.r.volume ?? 0))) out.push(`| ${[cell(r.keyword), cell(g.name), n(r.volume), n(h.impressions), pos(h.position), cell(pagePath(h.page))].join(" | ")} |`);
    } else out.push(T.nearNone);
    out.push("");
    const other = rows.filter((s) => !grouped.has(String(s.query).toLowerCase())).sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)).slice(0, 15);
    if (other.length) {
      out.push(`#### ${T.siteOther}`, "", `| ${[T.kw, T.imp, T.clicks, T.pos, T.page].join(" | ")} |`, "| --- | ---: | ---: | ---: | --- |");
      for (const s of other) out.push(`| ${[cell(s.query), n(s.impressions), n(s.clicks), pos(s.position), cell(pagePath(s.page))].join(" | ")} |`);
      out.push("");
    }
    siteLog += `site.json (${source}): ${rows.length} queries, ${matched} match a grouped keyword, ${near.length} at positions 5-15\n`;
  }
}

const used = new Set(groups.flatMap((g) => (g.keywords ?? []).flatMap((e) => e.split("|").map((f) => f.trim().toLowerCase()))));
const restRows = keywords.filter((k) => !used.has(k.keyword.toLowerCase())).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 25);
if (restRows.length) {
  out.push(`## ${T.rest}`, "", `| ${T.kw} | ${T.vol} | ${T.cpc} |`, "| --- | ---: | ---: |");
  for (const r of restRows) out.push(`| ${cell(r.keyword)} | ${n(r.volume)} | ${money(conv(r.cpc))} |`);
  out.push("");
}
if (missing.length) out.push(`> ${T.missing}: ${[...new Set(missing)].join(", ")}`, "");

fs.writeFileSync(path.join(dir, "report.md"), out.join("\n"));

const groupOf = new Map(groups.flatMap((g) => g.rows.flatMap((r) => [r.keyword, ...r.variants].map((f) => [f, g]))));
const q = (v) => (v == null ? "" : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [["keyword", "group", "intent", "volume", "cpc", "bid_low", "bid_high", "currency", "competition", "ai_volume", "source"].join(",")];
const c2 = (v) => (v == null ? v : Math.round(v * fx * 100) / 100);
for (const k of keywords) {
  const g = groupOf.get(k.keyword.toLowerCase());
  csv.push([k.keyword, g?.name, g?.intent, k.volume, c2(k.cpc), c2(k.bid_low), c2(k.bid_high), priceCur, k.competition, k.ai_volume, k.source].map(q).join(","));
}
fs.writeFileSync(path.join(dir, "keywords.csv"), "﻿" + csv.join("\n") + "\n");

console.log(`report.md and keywords.csv written to ${dir}`);
console.log(groups.map((g) => `${g.name}: ${g.rows.length} keywords, ${n(g.volume)} ${T.perMonth}, ${totalScore ? ((g.score / totalScore) * 100).toFixed(1) : 0} %`).join("\n"));
if (siteLog) console.log(siteLog.trim());
if (missing.length) console.log(`MISSING from data: ${[...new Set(missing)].join(", ")}`);
