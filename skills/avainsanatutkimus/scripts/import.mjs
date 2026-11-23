#!/usr/bin/env node
// Brings keyword rows from ANY source into keywords.json: a CSV/TSV export (Google Keyword Planner, Semrush,
// Ahrefs, SE Ranking, ...) or a JSON file that an agent wrote from an MCP or API answer. Node 18+, no dependencies.
//
//   node import.mjs --file export.csv --source "Semrush" [--dir .] [--match "regex"] [--currency EUR]
//   node import.mjs --file rows.json  --source "Ahrefs MCP"
//   node import.mjs --file export.csv --map "keyword=Hakusana,volume=Haut,cpc=Hinta"   (when headers are not recognised)
//   node import.mjs --file rows.json  --cpc-scale 0.01                                 (when the source gives prices in cents)
//
// JSON input: the answer as the tool returned it. The keyword rows are found wherever they sit in the JSON, and
// nested fields ("keyword_info.search_volume") are read too. Field names are matched the same way as CSV headers.
// Rows are merged by keyword: new values win, an empty new value never erases an old one.
import fs from "node:fs";
import path from "node:path";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
if (!args.file) {
  console.error('Usage: node import.mjs --file <export.csv|rows.json> --source "<name>" [--dir .] [--match regex] [--map "field=Header,..."]');
  process.exit(1);
}
if (/\.(xlsx?|numbers|ods)$/i.test(args.file)) {
  console.error("Spreadsheet files are not read. Export or save the file as CSV and run the import again.");
  process.exit(1);
}
const dir = path.resolve(args.dir ?? ".");
const kwFile = path.join(dir, "keywords.json");

// Header patterns per field, first match wins. Checked against the normalised header: lower case,
// "search_volume" and "searchVolume" read as "search volume", "keyword_info.search_volume" as "search volume".
// Covers the export and API field names of Google Keyword Planner, Google Ads API, Microsoft Advertising,
// Semrush (also its API codes Ph, Nq, Cp, Co, Kd), Ahrefs, SE Ranking, Moz, Mangools, Ubersuggest, Serpstat,
// SISTRIX, Keywords Everywhere, DataForSEO and tools that reuse those names.
const PATTERNS = {
  keyword: [/^keyword$/, /^keywords?( phrase| text| name)?$/, /^(search )?query$/, /^search terms?$/, /^phrase$/, /^term$/, /^text$/, /^ph$/, /^hakusana/, /^avainsana/, /^hakutermi/, /^suchbegriff/, /^sökord/, /^nyckelord/, /^mot[- ]cl[eé]/, /^palabra clave/],
  volume: [/^avg\.? monthly searches/, /^average monthly searches/, /^search volume$/, /^volume$/, /^monthly (search )?volume$/, /^avg\.? search volume/, /^local (search )?volume/, /^monthly searches$/, /^searches$/, /^search vol/, /^sv$/, /^nq$/, /^keskim.*kuukausitt/, /^haut/, /^hakumäärä/, /^suchvolumen/, /^sökvolym/, /search volume/, /volume/],
  cpc: [/^cpc$/, /^cpc\b/, /^avg\.? cpc/, /^average cpc/, /^cost per click/, /^suggested bid/, /^cp$/, /^klikkaushinta/, /\bcpc\b/],
  bid_low: [/top of page bid \(low/, /^low top of page bid/, /^bid low$/, /^low bid/, /sivun yläosan hintatarjous \(alhainen/],
  bid_high: [/top of page bid \(high/, /^high top of page bid/, /^bid high$/, /^high bid/, /sivun yläosan hintatarjous \(korkea/],
  competition: [/^competition$/, /^competition \(indexed/, /^competition (index|level)$/, /^competitive density/, /^competition in ppc/, /^ppc( competition)?$/, /^paid (difficulty|competition)/, /^ads? competition/, /^co$/, /^kilpailu$/],
  difficulty: [/^keyword difficulty/, /^kd\b/, /^seo difficulty/, /^difficulty$/, /^organic difficulty/, /^sd$/, /difficulty/],
  ai_volume: [/^ai (search )?volume$/, /^ai search volume/, /^prompt volume/],
  intent: [/^(search )?intents?$/, /^main intent$/, /^hakuaikomus/],
};
// Headers a field must never take, whatever the pattern says.
const NOT = {
  volume: /^(ai|global|clickstream|prompt)\b|trend|history|\bmin\b|\bmax\b|monthly search volumes/,
  difficulty: /paid|ppc/,
  cpc: /trend|history/,
};
const norm = (h) => String(h).split(".").pop().replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, tammi: 1, helmi: 2, maalis: 3, huhti: 4, touko: 5, kesä: 6, heinä: 7, elo: 8, syys: 9, loka: 10, marras: 11, joulu: 12 };

/** "1 000", "1,000", "0,45", "1.234,5", "€0.80" -> number; "-" or "" -> null. */
function num(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  const raw = String(v).trim();
  if (/\d\s*[kKmM]?\s*[–—-]\s*\d/.test(raw)) return null; // a range like "1K – 10K" is not a number
  const km = raw.match(/^[^\d]*([\d.,]+)\s*([kKmM])$/);
  if (km) { const n = num(km[1]); return n == null ? null : Math.round(n * (/k/i.test(km[2]) ? 1e3 : 1e6)); }
  let s = raw.replace(/[\s  ]/g, "").replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return null;
  const c = s.lastIndexOf(",");
  const d = s.lastIndexOf(".");
  if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (c > -1) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Competition as text: Low / Medium / High, or a 0-1 / 0-100 index turned into the same three words. */
function competition(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const t = s.toLowerCase();
  if (/unspecified|unknown/.test(t)) return null;
  if (/^(low|alhainen|matala)/.test(t)) return "LOW";
  if (/^(medium|keski)/.test(t)) return "MEDIUM";
  if (/^(high|korkea|suuri)/.test(t)) return "HIGH";
  const n = num(s);
  if (n == null) return null;
  const x = n > 1 ? n / 100 : n;
  return x < 0.34 ? "LOW" : x < 0.67 ? "MEDIUM" : "HIGH";
}

function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  return new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
}

/** Minimal CSV/TSV parser with quoted fields. */
function parseDelimited(text, sep) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function findField(headers, field, manual) {
  if (manual[field]) {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === manual[field].trim().toLowerCase());
    if (i === -1) throw new Error(`--map: header "${manual[field]}" not found. Headers: ${headers.join(" | ")}`);
    return i;
  }
  for (const p of PATTERNS[field]) {
    const i = headers.findIndex((h) => p.test(norm(h)) && !(NOT[field] && NOT[field].test(norm(h))));
    if (i > -1) return i;
  }
  return -1;
}

/** "Searches: Jan 2026", "Haut: tammi 2026", "2026-01" -> "2026-01". */
function monthKey(h) {
  const iso = h.match(/\b(20\d\d)-(\d\d)\b/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const m = h.toLowerCase().match(/([a-zäö]+)\.?\s+(20\d\d)/);
  if (!m) return null;
  const key = Object.keys(MONTHS).find((k) => m[1].startsWith(k));
  return key ? `${m[2]}-${String(MONTHS[key]).padStart(2, "0")}` : null;
}

const manualMap = () => Object.fromEntries((args.map ?? "").split(",").filter(Boolean).map((p) => p.split("=").map((x) => x.trim())));

/** Nested objects become "parent.child" fields (two levels), so answers can be imported as the tool returned them. */
function flatten(o, prefix = "", depth = 0, out = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && depth < 2 && !/^(months|monthly searches|history trend)$/.test(norm(k))) flatten(v, `${prefix}${k}.`, depth + 1, out);
    else out[`${prefix}${k}`] = v;
  }
  return out;
}
const isKeywordField = (k) => (args.map ? Object.values(manualMap()).some((v) => v.toLowerCase() === String(k).trim().toLowerCase()) : PATTERNS.keyword.some((p) => p.test(norm(k))));
/** The keyword rows inside any JSON answer: the longest array of objects whose items have a keyword field. */
function findRows(j) {
  let best = [];
  const walk = (v, depth) => {
    if (depth > 8 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      const objs = v.filter((x) => x && typeof x === "object" && !Array.isArray(x));
      if (objs.length > best.length && Object.keys(flatten(objs[0])).some(isKeywordField)) best = objs;
      for (const x of v.slice(0, 50)) walk(x, depth + 1);
    } else for (const x of Object.values(v)) walk(x, depth + 1);
  };
  walk(j, 0);
  return best;
}

function tableFromFile(file) {
  const text = decode(fs.readFileSync(file));
  if (/^\s*[[{]/.test(text)) {
    const j = JSON.parse(text);
    const arr = findRows(j).map((o) => flatten(o));
    if (!arr.length) throw new Error("JSON has no keyword rows: no array of objects with a keyword field was found. Save just the array of rows, or use --map.");
    const headers = [...new Set(arr.flatMap((o) => Object.keys(o)))];
    return { headers, rows: arr.map((o) => headers.map((h) => o[h])) };
  }
  // Separator: the one that splits the first lines into the most cells (title rows above the header have none).
  const head = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6);
  const cells = (sep) => Math.max(...head.map((l) => l.split(sep).length));
  const sep = ["\t", ";", ","].reduce((best, c) => (cells(c) > cells(best) ? c : best), "\t");
  const all = parseDelimited(text, sep);
  // Some exports (Keyword Planner) start with a title and a date range: the header is the first row with
  // several cells, one of which names a keyword column.
  const wanted = isKeywordField;
  const h = all.findIndex((r) => r.length > 1 && r.some(wanted));
  if (h === -1) throw new Error(`No header row with a keyword column found. First rows: ${all.slice(0, 3).map((r) => r.join(" | ")).join(" // ")}. Use --map "keyword=<header>".`);
  return { headers: all[Math.max(h, 0)], rows: all.slice(Math.max(h, 0) + 1) };
}

try {
  const manual = manualMap();
  const { headers, rows } = tableFromFile(args.file);
  const col = Object.fromEntries(Object.keys(PATTERNS).map((f) => [f, findField(headers, f, manual)]));
  if (col.keyword === -1) throw new Error(`No keyword column. Headers: ${headers.join(" | ")}`);
  const monthCols = headers.map((h, i) => [monthKey(String(h)), i]).filter(([k]) => k);
  const monthsField = headers.findIndex((h) => /^(months|monthly searches|monthly search volumes|history trend|search volume history|volume history)$/.test(norm(h)));
  const match = args.match ? new RegExp(args.match, "i") : null;
  const map = new Map((fs.existsSync(kwFile) ? JSON.parse(fs.readFileSync(kwFile, "utf8")) : []).map((r) => [r.keyword, r]));
  let kept = 0;
  let ranges = 0;
  const scale = args["cpc-scale"] ? Number(args["cpc-scale"]) : 1;
  for (const r of rows) {
    const keyword = String(r[col.keyword] ?? "").trim().toLowerCase();
    if (!keyword || (match && !match.test(keyword))) continue;
    const get = (f) => (col[f] > -1 ? r[col[f]] : null);
    // Money: Google Ads API gives micros; --cpc-scale 0.01 turns cents into currency units (some Ahrefs API fields).
    const money = (f) => {
      const n = num(get(f));
      if (n == null) return null;
      const x = n * (/micros$/.test(norm(headers[col[f]])) ? 1e-6 : 1) * scale;
      return Math.round(x * 10000) / 10000;
    };
    if (col.volume > -1 && num(get("volume")) == null && /\d/.test(String(get("volume") ?? ""))) ranges++;
    const intent = get("intent");
    let months = monthCols.map(([month, i]) => ({ month, volume: num(r[i]) })).filter((m) => m.volume != null);
    // JSON sources: [{month:"2026-01",volume:10}], [{year:2026,month:1,search_volume:10}] or {"2026-01":10}
    const raw = monthsField > -1 ? r[monthsField] : null;
    if (!months.length && raw && typeof raw === "object") {
      const mm = (m) => (/^\d+$/.test(String(m)) ? Number(m) : MONTHS[Object.keys(MONTHS).find((k) => String(m).toLowerCase().startsWith(k))]);
      const list = Array.isArray(raw) ? raw.map((m) => [m.year ? `${m.year}-${String(mm(m.month)).padStart(2, "0")}` : String(m.month ?? m.date ?? "").slice(0, 7), m.volume ?? m.search_volume ?? m.monthly_searches ?? m.monthlySearches ?? m.searches]) : Object.entries(raw);
      months = list.map(([month, volume]) => ({ month, volume: num(volume) })).filter((m) => /^20\d\d-\d\d$/.test(m.month) && m.volume != null);
    }
    const row = {
      keyword,
      volume: num(get("volume")),
      cpc: money("cpc"),
      bid_low: money("bid_low"),
      bid_high: money("bid_high"),
      competition: competition(get("competition")),
      difficulty: num(get("difficulty")),
      ai_volume: num(get("ai_volume")),
      intent: intent == null || intent === "" ? null : Array.isArray(intent) ? intent.join(", ") : String(intent),
      months: months.length ? months.sort((a, b) => a.month.localeCompare(b.month)) : null,
      source: args.source ?? path.basename(args.file),
      currency: args.currency ?? null,
    };
    const out = { ...(map.get(keyword) ?? {}) };
    for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined) out[k] = v;
    map.set(keyword, out);
    kept++;
  }
  const all = [...map.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(kwFile, JSON.stringify(all, null, 1));
  const found = Object.entries(col).filter(([, i]) => i > -1).map(([f, i]) => `${f}="${headers[i]}"`);
  console.log(`columns: ${found.join(", ")}${monthCols.length ? `, months=${monthCols.length} columns` : ""}`);
  console.log(`not found: ${Object.entries(col).filter(([, i]) => i === -1).map(([f]) => f).join(", ") || "-"}`);
  console.log(`imported ${kept} of ${rows.length} rows; keywords.json now has ${all.length} rows`);
  if (ranges) console.log(`WARNING: ${ranges} rows give the volume as a range (for example "1K – 10K"), not as a number. They were imported without a volume.`);
  if (kept && col.volume === -1) console.log("WARNING: no volume column was recognised. Look at the headers and use --map.");
  console.log(all.slice(0, 10).map((r) => `${r.volume ?? "-"}\t${r.cpc ?? "-"}\t${r.keyword}`).join("\n"));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
