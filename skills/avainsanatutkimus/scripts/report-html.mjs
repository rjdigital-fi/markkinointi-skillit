#!/usr/bin/env node
// Builds report.html, the report as slides, from the same files report.mjs reads. Node 18+, no dependencies.
//   node report-html.mjs --dir <work folder> [--lang fi|en] [--budget 1000-2000] [--note "..."] [--brand "NAME"] [--out report.html]
// One self-contained HTML file with no scripts. The script makes no network calls; the page itself loads one web
// font when opened and falls back to system fonts without it. Opens in any browser, prints to PDF one slide per page.
// The look (name, logo, colours, font) comes from brand.json: the one in the work folder, else the one in the skill folder.
// --note adds a line to the cover, --brand a name to the top of the cover for one run. Budget, currency and rate work as in report.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const here = path.dirname(fileURLToPath(import.meta.url));
const brandFile = [path.join(dir, "brand.json"), path.join(here, "..", "brand.json")].find((f) => fs.existsSync(f));
const brand = brandFile ? JSON.parse(fs.readFileSync(brandFile, "utf8")) : {};
const theme = { paper: "#ffffff", soft: "#f3f3f3", soft2: "#e8e8e8", ink: "#141414", muted: "#6b6b6b", line: "#e2e2e2", accent: "#ff5a1f", night: "#000000", ...(brand.colors ?? {}) };
const font = String(brand.font || "Hanken Grotesk").replace(/["<>;{}]/g, "");
const fontUrl = brand.fontUrl === undefined ? "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&display=swap" : brand.fontUrl;
const brandName = args.brand && args.brand !== "true" ? args.brand : brand.name ?? "";
const keywords = read("keywords.json");
const cfg = read("groups.json");
const lang = (args.lang ?? cfg.lang ?? "fi") === "en" ? "en" : "fi";
const loc = lang === "en" ? "en-US" : "fi-FI";
const L = {
  fi: {
    research: "Avainsanatutkimus", credit: "Tehty RJ Digitalin avainsanatutkimus-skillillä · rjdigital.fi", perMonth: "hakua/kk", total: "yhteensä", more: (k) => `+ ${k} muuta · `, and: " ja ",
    curWord: (c) => ({ EUR: "euroina", USD: "dollareina" })[c] ?? `valuutassa ${c}`,
    comp: { HIGH: "Korkea", MEDIUM: "Keski", LOW: "Matala" },
    map: "Aihekartta", mapTitle: "Aihe keskellä, hakusanaryhmät ympärillä", mapSub: "Jokaisessa ryhmässä näkyvät sen kolme haetuinta hakusanaa. Luvut ovat hakuja kuukaudessa.",
    kw: "Hakusana", vol: "Haut/kk", cpc: "Klikkaushinta", competition: "Kilpailu", ai: "Tekoälyhaut/kk", also: "myös",
    table: "Hakusanat ryhmittäin", tableTitle: "Hakusanat ryhmiteltyinä hakuaikomuksen mukaan", tableCont: "Hakusanat ryhmittäin, jatkuu", tableSub: (w) => `Jokaisella ryhmällä on hakuaikomus, sivu ja kanava. Klikkaushinnat ovat ${w}. Koko lista on tiedostossa keywords.csv.`,
    season: "Kausivaihtelu", seasonTitle: (k) => `Milloin hakua ”${k}” haetaan`, seasonSub: "Haut kuukausittain viimeisen 12 kuukauden ajalta. Huippukuukausi on korostettu.", peak: "Huippu", low: "Hiljaisin", avg: "Keskiarvo, 12 kk", avgUnit: "hakua kuukaudessa",
    budget: "Budjetin jako", budgetTitle: (b) => `Näin ${b} kuukaudessa jakautuu ryhmille`, budgetTitleNo: "Näin mainosbudjetti jakautuu ryhmille", budgetSub: "Osuus = ryhmän (haut × klikkaushinta) × hakuaikomuksen paino × liiketoiminnan paino. Jako on lähtökohta, jota oikea mainosdata tarkentaa.", ringAria: "Budjetin jako ryhmittäin", aMonth: "kuukaudessa", ofBudget: "budjetista", group: "Ryhmä", intent: "Hakuaikomus", weight: "Paino", share: "Osuus", mo: "kk", sum: "Yhteensä", others: "Muut ryhmät", noCpc: "Hakusanat ilman klikkaushintaa eivät vaikuta jakoon",
    rateNote: (from, to, v, src) => `Klikkaushinnat on muunnettu valuutasta ${from} valuuttaan ${to} kurssilla ${v}${src ? ` (${src})` : ""}.`, noRate: (from, to) => `Klikkaushinnat ovat lähteen valuutassa ${from}, koska vaihtokurssia valuuttaan ${to} ei ole annettu. Budjetin osuudet eivät riipu valuutasta.`,
    aiq: "Tekoälyn vastaukset", aiTitle: "Mitä tekoäly vastaa ostajan kysymyksiin", aiSub: "Jokaisesta kysymyksestä näkyvät haut, jotka tekoäly teki, sivustot, joihin se nojasi, ja yritykset, jotka se mainitsi.", searches: "Tekoälyn tekemät haut", sources: "Lähteet", brands: "Mainitut yritykset ja merkit",
    serp: "Googlen tulossivu", serpTitle: (k) => `Mitä Google näyttää haulla ”${k}”`, types: "Tulostyypit", paa: "Muut kysyvät myös", top: "Kärkitulokset",
    typeNames: { ai_overview: "Tekoälykatsaus", ai_mode: "AI Mode", organic: "Orgaaniset tulokset", people_also_ask: "Muut kysyvät myös", people_also_search: "Muut hakivat myös", local_pack: "Karttatulokset", shopping: "Shopping", knowledge_graph: "Tietopaneeli", featured_snippet: "Kärkivastaus", paid: "Mainokset", images: "Kuvat", video: "Videot", top_stories: "Uutiset", related_searches: "Aiheeseen liittyvät haut", discussions: "Keskustelut" },
    site: "Oma sivusto hakutuloksissa", siteTitle: "Missä ryhmissä sivusto jo näkyy ja missä ei vielä", siteSub: "Luvut kertovat sivuston omasta näkyvyydestä, markkinan hakumäärät ovat aiemmissa taulukoissa.", siteKw: "Hakusanoja näkyvissä", imp: "Näyttökerrat", clicks: "Klikkaukset", pos: "Keskisijainti", page: "Sivu", siteNone: "Ryhmät, joissa sivusto ei vielä näy:", near: "Lähellä kärkeä: sijat 5–15", position: "Sijainti", nearNone: "Ryhmien hakusanoista yksikään ei ole sijoilla 5–15.", otherTitle: "Muut haut, joilla sivusto näkyy", otherSub: "Nämä haut eivät ole vielä missään ryhmässä.",
    rest: "Ryhmittelemättömät hakusanat", restTitle: "Suurimmat hakusanat, jotka jäivät ryhmien ulkopuolelle", restSub: "Käykää lista läpi: osa kuuluu johonkin ryhmään, osa ei liity siihen, mitä myytte.",
    found: "hakusanaa löytyi", grouped: "valittu ryhmiin", groupsN: "ryhmää", totalVol: "hakua/kk ryhmissä yhteensä", data: "Data", market: "Markkina", built: "Raportti tehty", noData: "ei dataa",
  },
  en: {
    research: "Keyword research", credit: "Built with RJ Digital's keyword research skill · rjdigital.fi", perMonth: "searches/mo", total: "total", more: (k) => `+ ${k} more · `, and: " and ",
    curWord: (c) => ({ EUR: "in euros", USD: "in US dollars" })[c] ?? `in ${c}`,
    comp: { HIGH: "High", MEDIUM: "Medium", LOW: "Low" },
    map: "Topic map", mapTitle: "The topic in the middle, keyword groups around it", mapSub: "Each group shows its three most searched keywords. The numbers are searches a month.",
    kw: "Keyword", vol: "Searches/mo", cpc: "CPC", competition: "Competition", ai: "AI searches/mo", also: "also",
    table: "Keywords by group", tableTitle: "Keywords grouped by search intent", tableCont: "Keywords by group, continued", tableSub: (w) => `Each group has an intent, a page and a channel. Click prices are ${w}. The full list is in keywords.csv.`,
    season: "Seasonality", seasonTitle: (k) => `When people search for “${k}”`, seasonSub: "Searches by month over the last 12 months. The peak month is highlighted.", peak: "Peak", low: "Quietest", avg: "Average, 12 months", avgUnit: "searches a month",
    budget: "Budget split", budgetTitle: (b) => `How ${b} a month splits across the groups`, budgetTitleNo: "How the ad budget splits across the groups", budgetSub: "Share = the group's (searches × CPC) × intent weight × business weight. The split is a starting point that real ad data refines.", ringAria: "Budget split by group", aMonth: "a month", ofBudget: "of the budget", group: "Group", intent: "Intent", weight: "Weight", share: "Share", mo: "mo", sum: "Total", others: "Other groups", noCpc: "Keywords without a CPC do not affect the split",
    rateNote: (from, to, v, src) => `Click prices are converted from ${from} to ${to} at ${v}${src ? ` (${src})` : ""}.`, noRate: (from, to) => `Click prices are in the source currency ${from}, because no exchange rate to ${to} was given. The budget shares do not depend on the currency.`,
    aiq: "AI answers", aiTitle: "What AI answers to a buyer's questions", aiSub: "For each question: the searches the AI ran, the sites it relied on and the companies it named.", searches: "Searches the AI ran", sources: "Sources", brands: "Companies and brands named",
    serp: "Google result page", serpTitle: (k) => `What Google shows for “${k}”`, types: "Result types", paa: "People also ask", top: "Top results",
    typeNames: { ai_overview: "AI Overview", ai_mode: "AI Mode", organic: "Organic results", people_also_ask: "People also ask", people_also_search: "People also search for", local_pack: "Map results", shopping: "Shopping", knowledge_graph: "Knowledge panel", featured_snippet: "Featured snippet", paid: "Ads", images: "Images", video: "Videos", top_stories: "Top stories", related_searches: "Related searches", discussions: "Discussions" },
    site: "Your site in search results", siteTitle: "Where the site is already visible and where it is not yet", siteSub: "These numbers show the site's own visibility; market search volumes are in the earlier tables.", siteKw: "Keywords visible", imp: "Impressions", clicks: "Clicks", pos: "Avg. position", page: "Page", siteNone: "Groups where the site is not visible yet:", near: "Close to the top: positions 5–15", position: "Position", nearNone: "None of the grouped keywords is at positions 5–15.", otherTitle: "Other searches the site is visible for", otherSub: "These searches are not in any group yet.",
    rest: "Ungrouped keywords", restTitle: "The largest keywords left outside the groups", restSub: "Go through the list: some belong to a group, some have nothing to do with what you sell.",
    found: "keywords found", grouped: "picked into groups", groupsN: "groups", totalVol: "searches/mo in the groups", data: "Data", market: "Market", built: "Report built", noData: "no data",
  },
}[lang];
const srcCur = String(cfg.currency ?? keywords.find((k) => k.currency)?.currency ?? "USD").toUpperCase();
const outCur = String(cfg.report_currency ?? "EUR").toUpperCase();
const rate = srcCur !== outCur && Number(cfg.rate?.value) > 0 ? { ...cfg.rate, value: Number(cfg.rate.value) } : null;
const fx = rate ? rate.value : 1;
const priceCur = srcCur === outCur || rate ? outCur : srcCur;
const sym = (c) => ({ EUR: "€", USD: "$", GBP: "£" })[c] ?? c;
const n = (v) => (v == null ? "–" : Math.round(v).toLocaleString(loc));
const money = (v) => (v == null ? "–" : (v * fx).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cap = (s) => String(s ?? "").replace(/^./, (c) => c.toUpperCase());
const byKw = new Map(keywords.map((k) => [k.keyword.toLowerCase(), k]));

const groups = (cfg.groups ?? []).map((g) => {
  const rows = (g.keywords ?? []).map((entry) => {
    const forms = entry.split("|").map((f) => f.trim().toLowerCase());
    const found = forms.map((f) => byKw.get(f)).filter(Boolean);
    const k = found[0] ?? {};
    const ai = found.map((f) => f.ai_volume).filter((v) => v != null);
    return { keyword: forms[0], variants: forms.slice(1), volume: k.volume ?? null, cpc: k.cpc ?? (k.bid_low != null && k.bid_high != null ? (k.bid_low + k.bid_high) / 2 : null), competition: k.competition ?? null, ai_volume: ai.length ? Math.max(...ai) : null };
  });
  rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  const volume = rows.reduce((s, r) => s + (r.volume ?? 0), 0);
  const spend = rows.reduce((s, r) => s + (r.volume ?? 0) * (r.cpc ?? 0), 0);
  const weight = g.weight ?? 0;
  const business = g.business ?? 1;
  return { ...g, rows, volume, spend, weight, business, score: spend * weight * business };
});
const totalScore = groups.reduce((s, g) => s + g.score, 0);
const num = (v) => Number(String(v).replace(/[\s\u00a0]/g, "").replace(",", "."));
const parseBudget = (b) => {
  if (b == null || b === "" || b === "true") return null;
  let lo, hi;
  if (typeof b === "object") [lo, hi] = [num(b.low ?? b.high), num(b.high ?? b.low)];
  else [lo, hi] = String(b).split(/\s*[-–]\s*/).map(num);
  if (!(lo > 0)) return null;
  if (!(hi > 0)) hi = lo;
  return { low: Math.min(lo, hi), high: Math.max(lo, hi) };
};
const budget = parseBudget(args.budget) ?? parseBudget(cfg.budget);
const range = (lo, hi) => (Math.round(lo) === Math.round(hi) ? n(lo) : `${n(lo)}–${n(hi)}`);
const budgetText = budget ? `${range(budget.low, budget.high)} ${sym(outCur)}` : null;
const anyAi = groups.some((g) => g.rows.some((r) => r.ai_volume != null));
const sources = [...new Set(keywords.map((k) => k.source).filter(Boolean))];
const topic = cfg.topic ?? "";
const main = byKw.get(String(cfg.main ?? topic).toLowerCase()) ?? keywords.find((k) => k.months?.length);
const today = new Date().toLocaleDateString(loc);
const COMP = L.comp;
const pills = (list, cls = "") => `<ul class="pills ${cls}">${list.map((x) => `<li>${e(x)}</li>`).join("")}</ul>`;

const slides = [];
const slide = (kicker, title, sub, body, cls = "") => slides.push({ kicker, title, sub, body, cls });

// ---------- 1. Topic map ----------
{
  const W = 1168, H = 600, CW = 270, C = { w: 260, h: 110 };
  C.x = (W - C.w) / 2;
  C.y = (H - C.h) / 2;
  const ROWS = 3;
  const order = ["left", "right", "left", "right", "left", "right", "top", "bottom", "top", "bottom"];
  const placed = groups.slice(0, order.length).map((g, i) => ({ g, side: order[i], shown: g.rows.slice(0, ROWS), more: Math.max(g.rows.length - ROWS, 0) }));
  for (const p of placed) p.h = 52 + 28 * p.shown.length + 26;
  for (const side of ["left", "right"]) {
    const col = placed.filter((p) => p.side === side);
    const sum = col.reduce((s, p) => s + p.h, 0);
    const gap = col.length > 1 ? (H - sum) / (col.length - 1) : 0;
    let y = col.length > 1 ? 0 : (H - sum) / 2;
    for (const p of col) {
      p.x = side === "left" ? 0 : W - CW;
      p.y = y;
      y += p.h + gap;
    }
  }
  for (const side of ["top", "bottom"]) {
    const row = placed.filter((p) => p.side === side);
    row.forEach((p, i) => {
      p.x = row.length === 1 ? (W - CW) / 2 : (W - 2 * CW - 16) / 2 + i * (CW + 16);
      p.y = side === "top" ? 0 : H - p.h;
    });
  }
  const cx = C.x + C.w / 2, cy = C.y + C.h / 2;
  const paths = placed.map((p) => {
    if (p.side === "left" || p.side === "right") {
      const fromX = p.side === "left" ? C.x : C.x + C.w;
      const toX = p.side === "left" ? CW : W - CW;
      const midX = (fromX + toX) / 2;
      const toY = p.y + p.h / 2;
      return `M ${fromX} ${cy} C ${midX} ${cy}, ${midX} ${toY}, ${toX} ${toY}`;
    }
    const fromY = p.side === "top" ? C.y : C.y + C.h;
    const toY = p.side === "top" ? p.h : p.y;
    const midY = (fromY + toY) / 2;
    const toX = p.x + CW / 2;
    return `M ${cx} ${fromY} C ${cx} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  });
  const card = (p, pos = true) => `<section class="map-card"${pos ? ` style="--x:${p.x}px;--y:${p.y}px;--h:${p.h}px"` : ""}>
<h3>${e(p.g.name)}${p.g.intent ? ` <span>${e(p.g.intent)}</span>` : ""}</h3>
<ul>${p.shown.map((r) => `<li><span>${e(r.keyword)}</span><span class="n">${n(r.volume)}</span></li>`).join("")}</ul>
<p>${p.more ? L.more(p.more) : ""}${L.total} ${n(p.g.volume)} ${L.perMonth}</p></section>`;
  const extra = groups.slice(order.length).map((g) => ({ g, shown: g.rows.slice(0, ROWS), more: Math.max(g.rows.length - ROWS, 0) }));
  slide(
    L.map,
    L.mapTitle,
    L.mapSub,
    `<div class="map" style="--mh:${H}px"><svg class="map-lines" viewBox="0 0 ${W} ${H}" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>
<div class="map-center" style="--x:${C.x}px;--y:${C.y}px"><b>${e(topic)}</b>${main?.volume != null ? `<span>${e(main.keyword)}: ${n(main.volume)} ${L.perMonth}</span>` : ""}</div>
${placed.map((p) => card(p)).join("\n")}</div>${extra.length ? `<div class="map-extra">${extra.map((p) => card(p, false)).join("")}</div>` : ""}`,
  );
}

// ---------- 2. Keyword tables, two columns per slide ----------
{
  const CAPACITY = 17;
  const pages = [[[]]];
  let used = 0;
  for (const g of groups) {
    const cost = g.rows.length + 3;
    const page = pages[pages.length - 1];
    if (used && used + cost > CAPACITY) {
      if (page.length < 2) page.push([]);
      else pages.push([[]]);
      used = 0;
    }
    const p = pages[pages.length - 1];
    p[p.length - 1].push(g);
    used += cost;
  }
  const block = (g) => `<section class="kw-group"><h3>${e(g.name)} <span>${n(g.volume)} ${L.perMonth}</span></h3>
${pills([g.intent, g.page, g.channel].filter(Boolean), "pills-s")}
<table><thead><tr><th>${L.kw}</th><th class="num">${L.vol}</th><th class="num">${L.cpc}</th><th class="num">${L.competition}</th>${anyAi ? `<th class="num">${L.ai}</th>` : ""}</tr></thead><tbody>
${g.rows.map((r) => `<tr><td>${e(r.keyword)}${r.variants.length ? ` <small>${L.also}: ${e(r.variants.join(", "))}</small>` : ""}</td><td class="num">${n(r.volume)}</td><td class="num">${money(r.cpc)}</td><td class="num">${e(COMP[r.competition] ?? r.competition ?? "–")}</td>${anyAi ? `<td class="num">${n(r.ai_volume)}</td>` : ""}</tr>`).join("\n")}
</tbody></table></section>`;
  pages.forEach((cols, i) =>
    slide(
      L.table + (pages.length > 1 ? ` · ${i + 1}/${pages.length}` : ""),
      i === 0 ? L.tableTitle : L.tableCont,
      i === 0 ? L.tableSub(L.curWord(priceCur)) : "",
      `<div class="cols">${cols.map((c) => `<div>${c.map(block).join("")}</div>`).join("")}</div>`,
    ),
  );
}

// ---------- 3. Seasonality ----------
if (main?.months?.length) {
  const months = main.months.slice(-12);
  const vols = months.map((m) => m.volume ?? 0);
  const max = Math.max(...vols) || 1;
  const min = Math.min(...vols);
  const label = (m, long) => {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 1, 1);
    return long ? d.toLocaleDateString(loc, { month: "long", year: "numeric" }) : d.toLocaleDateString(loc, { month: "short" }).replace(".", "") + (mo === 1 || m === months[0].month ? `<small>${y}</small>` : "<small>&nbsp;</small>");
  };
  const named = (v) => months.filter((m) => (m.volume ?? 0) === v).map((m) => label(m.month, true)).join(L.and);
  slide(
    L.season,
    L.seasonTitle(e(main.keyword)),
    L.seasonSub,
    `<div class="season"><ol class="months">${months.map((m) => `<li class="${(m.volume ?? 0) === max ? "peak" : ""}" title="${e(label(m.month, true))}: ${n(m.volume)}"><b>${n(m.volume)}</b><i style="height:${Math.max(((m.volume ?? 0) / max) * 100, 1).toFixed(1)}%"></i><span>${label(m.month)}</span></li>`).join("")}</ol>
<div class="tiles"><div class="tile"><span>${L.peak}</span><b>${n(max)}</b><em>${e(named(max))}</em></div><div class="tile"><span>${L.low}</span><b>${n(min)}</b><em>${e(named(min))}</em></div><div class="tile"><span>${L.avg}</span><b>${n(vols.reduce((a, b) => a + b, 0) / vols.length)}</b><em>${L.avgUnit}</em></div></div></div>`,
  );
}

// ---------- 4. Budget ----------
{
  const COLORS = Array.isArray(brand.chart) && brand.chart.length ? brand.chart : ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
  const GREY = "#b9b9b9";
  const sorted = [...groups].sort((a, b) => b.score - a.score).map((g) => ({ g, share: totalScore ? (g.score / totalScore) * 100 : 0 }));
  const nonZero = sorted.filter((s) => s.share > 0);
  const keep = nonZero.length <= COLORS.length ? nonZero.length : COLORS.length - 1;
  sorted.forEach((s, i) => (s.color = s.share > 0 && i < keep ? COLORS[i] : GREY));
  const segs = nonZero.slice(0, keep).map((s) => ({ name: s.g.name, share: s.share, color: s.color }));
  const restShare = nonZero.slice(keep).reduce((a, s) => a + s.share, 0);
  if (restShare > 0) segs.push({ name: L.others, share: restShare, color: GREY });
  let start = 0;
  const ring = segs.map((s) => {
    const len = Math.max(s.share - 0.6, 0.1);
    const c = `<circle cx="100" cy="100" r="80" fill="none" stroke="${s.color}" stroke-width="26" pathLength="100" stroke-dasharray="${len.toFixed(2)} ${(100 - len).toFixed(2)}" stroke-dashoffset="${(-start).toFixed(2)}"><title>${e(s.name)}: ${s.share.toLocaleString(loc, { maximumFractionDigits: 1 })} %</title></circle>`;
    start += s.share;
    return c;
  });
  const noCpc = groups.flatMap((g) => g.rows).filter((r) => r.cpc == null).length;
  slide(
    L.budget,
    budget ? L.budgetTitle(budgetText) : L.budgetTitleNo,
    L.budgetSub,
    `<div class="budget"><svg class="ring" viewBox="0 0 200 200" role="img" aria-label="${L.ringAria}"><g transform="rotate(-90 100 100)">${ring.join("")}</g>
<text x="100" y="97" text-anchor="middle" class="ring-total"${budget && budgetText.length > 9 ? ' style="font-size:17px"' : ""}>${budget ? budgetText : "100 %"}</text><text x="100" y="116" text-anchor="middle" class="ring-unit">${budget ? L.aMonth : L.ofBudget}</text></svg>
<table><thead><tr><th>${L.group}</th><th>${L.intent}</th><th class="num">${L.weight}</th><th class="num">${L.share}</th>${budget ? `<th class="num">${sym(outCur)}/${L.mo}</th>` : ""}</tr></thead><tbody>
${sorted.map((s) => `<tr${s.share ? "" : ' class="zero"'}><td><i style="background:${s.color}"></i>${e(s.g.name)}</td><td>${e(s.g.intent ?? "–")}</td><td class="num">${(s.g.weight * s.g.business).toLocaleString(loc, { maximumFractionDigits: 2 })}</td><td class="num">${s.share.toLocaleString(loc, { maximumFractionDigits: 1 })} %</td>${budget ? `<td class="num">${range((s.share / 100) * budget.low, (s.share / 100) * budget.high)}</td>` : ""}</tr>`).join("\n")}
${budget ? `<tr class="sum"><td>${L.sum}</td><td></td><td></td><td class="num">100 %</td><td class="num">${range(budget.low, budget.high)}</td></tr>` : ""}</tbody></table></div>
${noCpc ? `<p class="note">${L.noCpc}: ${noCpc}.</p>` : ""}
${rate ? `<p class="note">${e(L.rateNote(srcCur, outCur, rate.value.toLocaleString(loc, { maximumFractionDigits: 4 }), [rate.source, rate.date].filter(Boolean).join(", ")))}</p>` : srcCur !== outCur ? `<p class="note">${e(L.noRate(srcCur, outCur))}</p>` : ""}`,
  );
}

// ---------- 5. AI answers, two per slide ----------
if (has("chatgpt.json")) {
  const answers = read("chatgpt.json");
  for (let i = 0; i < answers.length; i += 2) {
    slide(
      L.aiq + (answers.length > 2 ? ` · ${i / 2 + 1}/${Math.ceil(answers.length / 2)}` : ""),
      L.aiTitle,
      L.aiSub,
      `<div class="cols">${answers.slice(i, i + 2).map((a) => {
        const domains = [...new Set((a.sources ?? []).map((s) => s.domain ?? s))].filter(Boolean);
        return `<section class="ai"><p class="ai-q">${a.engine ? `<span>${e(a.engine)}</span>` : ""}${e(a.prompt)}</p>
${a.searches?.length ? `<h3>${L.searches}</h3>${pills(a.searches)}` : ""}
${domains.length ? `<h3>${L.sources}</h3>${pills(domains)}` : ""}
${a.brands?.length ? `<h3>${L.brands}</h3>${pills(a.brands)}` : ""}</section>`;
      }).join("")}</div>`,
    );
  }
}

// ---------- 6. Google result pages ----------
const TYPES = L.typeNames;
for (const f of fs.readdirSync(dir).filter((x) => /^serp-.*\.json$/.test(x))) {
  const s = read(f);
  slide(
    L.serp,
    L.serpTitle(e(s.keyword)),
    "",
    `<div class="cols"><div>${s.result_types?.length ? `<h3 class="h">${L.types}</h3>${pills(s.result_types.map((t) => TYPES[t] ?? t))}` : ""}
${s.people_also_ask?.length ? `<h3 class="h">${L.paa}</h3><ul class="lines">${s.people_also_ask.map((q) => `<li>${e(q)}</li>`).join("")}</ul>` : ""}</div>
<div>${s.organic?.length ? `<h3 class="h">${L.top}</h3><ol class="serp">${s.organic.slice(0, 10).map((o) => `<li><span class="n">${e(o.rank)}</span><b>${e(o.domain)}</b><span class="t">${e(o.title)}</span></li>`).join("")}</ol>` : ""}</div></div>`,
  );
}

// ---------- 7. The site's own visibility ----------
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
  for (const source of [...new Set(site.map((s) => s.source ?? ""))]) {
    const rows = site.filter((s) => (s.source ?? "") === source);
    const byQ = new Map(rows.map((s) => [String(s.query).toLowerCase(), s]));
    const hitOf = (r) => [r.keyword, ...r.variants].map((f) => byQ.get(f)).filter(Boolean).sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0];
    const none = [];
    const near = [];
    const trs = groups.map((g) => {
      const hits = g.rows.map((r) => [r, hitOf(r)]).filter(([, h]) => h);
      if (!hits.length) none.push(g.name);
      const withPos = hits.filter(([, h]) => h.position != null);
      const w = withPos.reduce((s, [, h]) => s + (h.impressions || 1), 0);
      const avg = withPos.length ? withPos.reduce((s, [, h]) => s + h.position * (h.impressions || 1), 0) / w : null;
      const top = [...hits].sort((a, b) => (b[1].impressions ?? 0) - (a[1].impressions ?? 0)).find(([, h]) => h.page)?.[1].page;
      for (const [r, h] of hits) if (h.position >= 5 && h.position <= 15) near.push({ r, h, g });
      return `<tr${hits.length ? "" : ' class="zero"'}><td>${e(g.name)}</td><td class="num">${hits.length}/${g.rows.length}</td><td class="num">${hits.length ? n(hits.reduce((s, [, h]) => s + (h.impressions ?? 0), 0)) : "–"}</td><td class="num">${hits.length ? n(hits.reduce((s, [, h]) => s + (h.clicks ?? 0), 0)) : "–"}</td><td class="num">${pos(avg)}</td><td class="path">${e(pagePath(top))}</td></tr>`;
    });
    const period = rows.find((s) => s.period)?.period;
    slide(
      L.site,
      L.siteTitle,
      `${[source, period].filter(Boolean).map(e).join(" · ")}. ${L.siteSub}`,
      `<div class="cols cols-wide"><div><table><thead><tr><th>${L.group}</th><th class="num">${L.siteKw}</th><th class="num">${L.imp}</th><th class="num">${L.clicks}</th><th class="num">${L.pos}</th><th>${L.page}</th></tr></thead><tbody>${trs.join("")}</tbody></table>
${none.length ? `<p class="note"><b>${L.siteNone}</b> ${e(none.join(", "))}.</p>` : ""}</div>
<div><h3 class="h">${L.near}</h3>${near.length ? `<table><thead><tr><th>${L.kw}</th><th class="num">${L.vol}</th><th class="num">${L.position}</th></tr></thead><tbody>${near.sort((a, b) => (b.r.volume ?? 0) - (a.r.volume ?? 0)).map(({ r, h }) => `<tr><td>${e(r.keyword)}</td><td class="num">${n(r.volume)}</td><td class="num">${pos(h.position)}</td></tr>`).join("")}</tbody></table>` : `<p class="note">${L.nearNone}</p>`}</div></div>`,
    );
    const other = rows.filter((s) => !grouped.has(String(s.query).toLowerCase())).sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)).slice(0, 12);
    if (other.length)
      slide(
        L.site,
        L.otherTitle,
        `${[source, period].filter(Boolean).map(e).join(" · ")}. ${L.otherSub}`,
        `<table><thead><tr><th>${L.kw}</th><th class="num">${L.imp}</th><th class="num">${L.clicks}</th><th class="num">${L.pos}</th><th>${L.page}</th></tr></thead><tbody>${other.map((s) => `<tr><td>${e(s.query)}</td><td class="num">${n(s.impressions)}</td><td class="num">${n(s.clicks)}</td><td class="num">${pos(s.position)}</td><td class="path">${e(pagePath(s.page))}</td></tr>`).join("")}</tbody></table>`,
      );
  }
}

// ---------- 8. Largest ungrouped keywords ----------
{
  const used = new Set(groups.flatMap((g) => (g.keywords ?? []).flatMap((x) => x.split("|").map((f) => f.trim().toLowerCase()))));
  const restRows = keywords.filter((k) => !used.has(k.keyword.toLowerCase())).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 24);
  if (restRows.length) {
    const half = Math.ceil(restRows.length / 2);
    const tbl = (list) => `<table><thead><tr><th>${L.kw}</th><th class="num">${L.vol}</th><th class="num">${L.cpc}</th></tr></thead><tbody>${list.map((r) => `<tr><td>${e(r.keyword)}</td><td class="num">${n(r.volume)}</td><td class="num">${money(r.cpc)}</td></tr>`).join("")}</tbody></table>`;
    slide(L.rest, L.restTitle, L.restSub, `<div class="cols"><div>${tbl(restRows.slice(0, half))}</div><div>${tbl(restRows.slice(half))}</div></div>`);
  }
}

// ---------- Page ----------
const total = slides.length + 1;
const foot = (i) => `<footer class="foot"><span>${L.research}: ${e(topic)}</span><span>${L.credit}</span><span>${i} / ${total}</span></footer>`;
const cover = `<section class="slide cover">${brand.logo ? `<img class="logo" src="${e(brand.logo)}" alt="${e(brandName)}">` : brandName ? `<p class="brand">${e(brandName)}</p>` : ""}<div class="cover-main"><p class="kicker">${L.research}</p><h1>${e(cap(topic))}</h1>
<dl class="stats"><div><dt>${L.found}</dt><dd>${n(keywords.length)}</dd></div><div><dt>${L.grouped}</dt><dd>${n(groups.reduce((s, g) => s + g.rows.length, 0))}</dd></div><div><dt>${L.groupsN}</dt><dd>${groups.length}</dd></div><div><dt>${L.totalVol}</dt><dd>${n(groups.reduce((s, g) => s + g.volume, 0))}</dd></div></dl></div>
<div class="cover-meta"><p><b>${L.data}</b> ${e(sources.join(", ") || L.noData)}</p>${cfg.market ? `<p><b>${L.market}</b> ${e(cfg.market)}</p>` : ""}<p><b>${L.built}</b> ${today}</p>${args.note ? `<p class="cover-note">${e(args.note)}</p>` : ""}</div></section>`;
const body = slides.map((s, i) => `<section class="slide ${s.cls}"><header><p class="kicker">${String(i + 2).padStart(2, "0")} · ${e(s.kicker)}</p><h2>${s.title}</h2>${s.sub ? `<p class="sub">${s.sub}</p>` : ""}</header><div class="body">${s.body}</div>${foot(i + 2)}</section>`).join("\n");

const css = `
:root{--paper:${theme.paper};--soft:${theme.soft};--soft-2:${theme.soft2};--ink:${theme.ink};--muted:${theme.muted};--line:${theme.line};--accent:${theme.accent};--night:${theme.night};--font:"${font}","Helvetica Neue",Arial,system-ui,sans-serif;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--soft);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
.deck{width:min(1280px,100% - 32px);margin:32px auto;display:grid;gap:28px}
.slide{background:var(--paper);border-radius:20px;padding:48px 56px 28px;min-height:720px;display:flex;flex-direction:column;min-width:0}
.kicker{margin:0 0 14px;font-size:14px;font-weight:500;color:var(--muted)}
h1,h2,h3,p{margin:0}
h2{font-size:38px;font-weight:500;line-height:1.15;letter-spacing:-0.02em;max-width:22em}
.sub{margin-top:12px;color:var(--muted);max-width:52em}
.body{margin-top:32px;flex:1;min-width:0}
.foot{margin-top:28px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;font-size:12px;color:var(--muted)}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.note{margin-top:16px;font-size:14px;color:var(--muted)}
.note b{color:var(--ink);font-weight:500}
/* cover */
.cover{background:var(--night) radial-gradient(900px circle at 100% 0%,rgba(255,255,255,.13),transparent 60%);color:#fff;padding-bottom:48px}
.brand{font-size:14px;font-weight:600;letter-spacing:.32em}
.logo{height:36px;width:auto;align-self:flex-start}
.cover-main{margin-top:auto}
.cover .kicker{color:rgba(255,255,255,.64);font-size:16px}
h1{font-size:104px;font-weight:500;line-height:1;letter-spacing:-0.035em;overflow-wrap:anywhere}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:48px 0 0}
.stats div{border-top:1px solid rgba(255,255,255,.28);padding-top:14px;display:flex;flex-direction:column-reverse;gap:2px}
.stats dd{margin:0;font-size:40px;font-weight:500;letter-spacing:-0.02em;line-height:1.1}
.stats dt{font-size:14px;color:rgba(255,255,255,.64)}
.cover-meta{margin-top:40px;display:flex;flex-wrap:wrap;gap:6px 32px;font-size:14px;color:rgba(255,255,255,.64)}
.cover-meta b{color:#fff;font-weight:500;margin-right:6px}
.cover-note{flex-basis:100%;margin-top:10px;max-width:70em}
/* pills */
.pills{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pills li{background:var(--soft);border-radius:999px;padding:4px 12px;font-size:14px;font-weight:500}
.pills-s li{font-size:12px;padding:2px 10px;color:var(--muted)}
/* tables */
table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.35}
th{text-align:left;font-size:12px;font-weight:500;color:var(--muted);padding:0 0 8px;border-bottom:1px solid var(--ink)}
th.num{padding-left:14px}
td{padding:7px 0;border-bottom:1px solid var(--line);vertical-align:top}
td.num{padding-left:14px}
td small{display:block;font-size:12px;color:var(--muted)}
tr.zero td{color:var(--muted)}
tr.sum td{font-weight:600;border-bottom:0;border-top:1px solid var(--ink)}
td.path{padding-left:18px;color:var(--muted);font-size:13px;overflow-wrap:anywhere}
th:last-child:not(.num){padding-left:18px}
.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 56px;align-items:start}
.cols-wide{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
.h{font-size:15px;font-weight:600;margin:0 0 12px}
.cols div>.h:not(:first-child){margin-top:28px}
/* keyword groups */
.kw-group+.kw-group{margin-top:30px}
.kw-group h3{font-size:20px;font-weight:500;display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.kw-group h3 span{font-size:14px;color:var(--muted);font-weight:400;white-space:nowrap}
.kw-group .pills{margin:8px 0 14px}
/* topic map */
.map{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.map-lines{display:none}
.map-center{grid-column:1/-1;background:var(--night);color:#fff;border-radius:14px;padding:22px 20px;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:4px;line-height:1.3}
.map-center b{font-size:24px;font-weight:600;letter-spacing:-0.01em}
.map-center span{font-size:14px;color:rgba(255,255,255,.72)}
.map-card{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px 16px 0;font-size:14px;line-height:1.4}
.map-card h3{margin:0 0 8px;font-size:15px;font-weight:600;line-height:20px;display:flex;justify-content:space-between;align-items:center;gap:8px;white-space:nowrap}
.map-card h3 span{font-size:11px;font-weight:500;color:var(--muted);background:var(--soft);border-radius:999px;padding:1px 8px}
.map-card ul{list-style:none;margin:0;padding:0}
.map-card li{display:flex;justify-content:space-between;gap:10px;height:28px;align-items:center;border-top:1px solid var(--line)}
.map-card li span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.map-card .n{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--muted)}
.map-card p{height:26px;display:flex;align-items:center;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.map-extra{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:16px}
@media (min-width:1312px){
.map{display:block;position:relative;height:var(--mh)}
.map-lines{display:block;position:absolute;inset:0;width:100%;height:100%}
.map-lines path{fill:none;stroke:var(--accent);stroke-width:1.5;opacity:.55}
.map-center{position:absolute;left:var(--x);top:var(--y);width:260px;height:110px;padding:0 16px}
.map .map-card{position:absolute;left:var(--x);top:var(--y);width:270px;height:var(--h)}
}
/* months */
.season{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:56px;align-items:end}
.months{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(12,1fr);gap:10px;height:400px}
.months li{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px;font-size:13px;line-height:1.15;color:var(--muted);font-variant-numeric:tabular-nums;text-align:center}
.months b{font-weight:500;color:var(--ink)}
.months i{display:block;width:100%;background:var(--soft-2);border-radius:4px 4px 0 0}
.months .peak i{background:var(--accent)}
.months small{display:block;font-size:11px}
.tiles{display:grid;gap:12px}
.tile{background:var(--soft);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column}
.tile span,.tile em{font-size:13px;color:var(--muted);font-style:normal}
.tile b{font-size:34px;font-weight:500;letter-spacing:-0.02em;line-height:1.2}
/* budget */
.budget{display:grid;grid-template-columns:320px minmax(0,1fr);gap:64px;align-items:center}
.ring{width:100%;height:auto}
.ring-total{font-size:22px;font-weight:600;fill:var(--ink)}
.ring-unit{font-size:11px;fill:var(--muted)}
.budget td{padding:10px 0}
.budget td.num{padding-left:14px}
.budget i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:10px}
/* AI answers */
.ai{background:var(--soft);border-radius:14px;padding:24px}
.ai-q{font-size:22px;font-weight:500;line-height:1.3;letter-spacing:-0.01em}
.ai-q span{display:block;font-size:13px;font-weight:500;color:var(--muted);letter-spacing:0;margin-bottom:8px}
.ai h3{font-size:13px;font-weight:500;color:var(--muted);margin:22px 0 8px}
.ai .pills li{background:var(--paper)}
/* SERP */
.lines{list-style:none;margin:0;padding:0;border-top:1px solid var(--line);font-size:14px}
.lines li{padding:7px 0;border-bottom:1px solid var(--line)}
.serp{list-style:none;margin:0;padding:0;border-top:1px solid var(--ink);font-size:14px}
.serp li{display:grid;grid-template-columns:24px minmax(0,auto) minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid var(--line);align-items:baseline}
.serp .n{color:var(--muted);font-variant-numeric:tabular-nums}
.serp b{font-weight:600}
.serp .t{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:1311px){
.slide{padding:32px 24px 20px;min-height:0}
h1{font-size:clamp(44px,11vw,104px)}
h2{font-size:clamp(26px,5vw,38px)}
.cover{min-height:560px}
.stats{grid-template-columns:repeat(2,1fr)}
.stats dd{font-size:30px}
}
@media (max-width:860px){
.cols,.cols-wide,.season,.budget{grid-template-columns:1fr;gap:28px}
.ring{max-width:260px;margin-inline:auto}
.months{gap:4px;height:240px}
.months li{font-size:10px}
.months b{font-size:9px}
.body{overflow-x:auto}
.foot span:nth-child(2){display:none}
}
@media print{
@page{size:1280px 800px;margin:0}
body{background:#fff}
.deck{width:1280px;margin:0;gap:0}
.slide{border-radius:0;break-after:page;break-inside:avoid;min-height:800px}
.cover,.months i,.pills li,.tile,.ai,.map-center,.budget i{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L.research}: ${e(topic)}</title>
${fontUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${e(fontUrl)}" rel="stylesheet">` : ""}
<style>${css}</style></head>
<body><main class="deck">
${cover}
${body}
</main></body></html>
`;
const outFile = path.resolve(args.out ?? path.join(dir, "report.html"));
fs.writeFileSync(outFile, html);
console.log(`${outFile}: ${total} slides, ${(html.length / 1024).toFixed(0)} kB`);
