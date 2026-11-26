// Shared logic of the yrityskonteksti skill: reading the context files and their markers, reading a
// website's text, colours and fonts, and counting how a set of own texts is written. No dependencies.

// ---------- context files ----------
// Three files. The Finnish name is the default; the English one is read the same way.
// `need` lists the sections a file must have: [pattern for the "## " heading, what it is called in the report].
export const SLOTS = [
  { key: "company", names: ["yritys.md", "company.md"], need: [[/lyhyesti|in short|overview/i, "Yritys lyhyesti / In short"], [/tarjooma|hinna|offer|pricing/i, "Tarjooma ja hinnat / Offer and pricing"], [/miksi|why/i, "Miksi meiltä ostetaan / Why customers buy"], [/ei luvata|ei tehdä|not promise|do not|don['’]t/i, "Mitä ei luvata eikä tehdä / What we do not promise or do"]] },
  { key: "audience", names: ["kohderyhma.md", "audience.md"], need: [[/ei myydä|not sell|not for/i, "Kenelle ei myydä / Who we do not sell to"], [/ryhmä|segment|group/i, "Ryhmä / Segment"], [/omat sanat|own words/i, "Asiakkaan omat sanat / In the customer's own words"]] },
  { key: "brand", names: ["brandi.md", "brand.md"], need: [[/ääni|voice/i, "Ääni / Voice"], [/sanasto|vocabulary|words/i, "Sanasto / Vocabulary"], [/ulkoasu|look|visual/i, "Ulkoasu / Look"]] },
];
// A file counts as reviewed for this many days. After that the check asks the owner to read it again.
export const REVIEW_DAYS = 180;

// Every fact carries one marker. Finnish and English forms are read the same way.
//   [vahvistettu: lähde]  [päätelty: lähde]  [auki]   |   [confirmed: source]  [derived: source]  [open]
const MARKER = /\[(vahvistettu|päätelty|paatelty|auki|confirmed|derived|open)(?:\s*:\s*([^\]]*))?\]/gi;
const KIND = { vahvistettu: "confirmed", confirmed: "confirmed", päätelty: "derived", paatelty: "derived", derived: "derived", auki: "open", open: "open" };

export function markers(line) {
  return [...line.matchAll(MARKER)].map((m) => ({ kind: KIND[m[1].toLowerCase()], source: (m[2] ?? "").trim() }));
}
export const stripMarkers = (line) => line.replace(MARKER, "").replace(/\s{2,}/g, " ").trim();

export function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  if (m) for (const row of m[1].split(/\r?\n/)) {
    const i = row.indexOf(":");
    if (i > 0) meta[row.slice(0, i).trim().toLowerCase()] = row.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: m ? text.slice(m[0].length) : text };
}

// Splits a file into its "## " sections. Each section keeps its lines and its "### " blocks.
export function sections(body) {
  const out = [];
  let cur = null;
  let title = "";
  for (const line of body.split(/\r?\n/)) {
    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    if (h1 && !title) title = h1[1].trim();
    else if (h2) out.push((cur = { heading: h2[1].trim(), lines: [] }));
    else if (cur) cur.lines.push(line);
  }
  return { title, sections: out };
}

const isTableRule = (l) => /^\s*\|?\s*:?-{2,}/.test(l);
const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isItem = (l) => /^\s*(?:[-*]|\d+\.)\s+\S/.test(l);
// Sections that hold notes and not facts about the business: no marker needed there.
export const FREE = /muuto|changelog|opit|learnings|kysymyks|questions|lähteet|lahteet|sources/i;
// Lines of a voice rule that explain it. The example line carries the marker.
const VOICE_EXPLAIN = /^\s*[-*]\s+\**(tarkoittaa|ei tarkoita|means|doesn['’]t mean|does not mean)\b/i;
const VOICE_EXAMPLE = /^\s*[-*]\s+\**(esimerkki|example)\b/i;

// Reads one context file and reports what is confirmed, derived, open, and what is missing.
export function readContextFile(name, text, today = new Date()) {
  const { meta, body } = frontmatter(text);
  const { title, sections: secs } = sections(body);
  const res = { file: name, title, owner: meta.owner || meta.omistaja || "", reviewed: meta.reviewed || meta.tarkistettu || "", company: meta.company || meta.yritys || "", confirmed: 0, derived: 0, open: 0, openItems: [], noSource: [], unmarked: [], voiceProblems: [], sections: secs.map((s) => s.heading) };
  for (const s of secs) {
    const free = FREE.test(s.heading);
    let header = true;
    let block = null;
    const blocks = [];
    for (const line of s.lines) {
      const h3 = line.match(/^###\s+(.*)/);
      if (h3) { blocks.push((block = { name: h3[1].trim(), means: false, not: false, example: false })); continue; }
      if (!line.trim()) { header = true; continue; }
      if (block) {
        if (/^\s*[-*]\s+\**(tarkoittaa|means)\b/i.test(line)) block.means = true;
        if (/^\s*[-*]\s+\**(ei tarkoita|doesn['’]t mean|does not mean)\b/i.test(line)) block.not = true;
        if (VOICE_EXAMPLE.test(line)) block.example = true;
      }
      const row = isRow(line);
      if (row && isTableRule(line)) { header = false; continue; }
      if (row && header) continue; // table header row
      const fact = (row || isItem(line)) && !free;
      const found = markers(line);
      for (const m of found) {
        res[m.kind]++;
        const clean = stripMarkers(line).replace(/^\s*(?:[-*]|\d+\.)(?:\s+|$)/, "").replace(/^\|\s*|\s*\|$/g, "").replace(/\s*\|\s*/g, " · ").replace(/[\s·]+$/, "");
        if (m.kind === "open") res.openItems.push({ section: s.heading, text: clean });
        else if (!m.source) res.noSource.push({ section: s.heading, text: clean });
      }
      if (fact && !found.length && !VOICE_EXPLAIN.test(line)) res.unmarked.push({ section: s.heading, text: line.trim().slice(0, 140) });
    }
    for (const b of blocks)
      if (b.means || b.not || b.example) {
        const miss = [!b.means && "means", !b.not && "not", !b.example && "example"].filter(Boolean);
        if (miss.length) res.voiceProblems.push({ rule: b.name, missing: miss });
      }
  }
  const d = res.reviewed && !Number.isNaN(Date.parse(res.reviewed)) ? Math.floor((today - new Date(res.reviewed)) / 86400000) : null;
  res.ageDays = d;
  return res;
}

// ---------- brand.json ----------
export const COLOR_KEYS = ["paper", "soft", "ink", "muted", "line", "accent", "night"];
export function checkBrand(brand) {
  const problems = [];
  if (!brand || typeof brand !== "object") return ["brand.json is not an object"];
  if (!brand.name) problems.push("name missing");
  if (!brand.font) problems.push("font missing");
  for (const k of COLOR_KEYS) {
    const v = brand.colors?.[k];
    if (!v) problems.push(`colors.${k} missing`);
    else if (!/^#[0-9a-f]{6}$/i.test(v)) problems.push(`colors.${k} is not a six-digit hex colour: ${v}`);
  }
  return problems;
}

// ---------- website ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", auml: "ä", ouml: "ö", aring: "å", Auml: "Ä", Ouml: "Ö", Aring: "Å", euro: "€", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", copy: "©", shy: "" };
export const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m);
const strip = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function htmlText(html) {
  const body = html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const main = body.replace(/<(nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ");
  const blocks = main.replace(/<\/(p|div|li|h[1-6]|section|article|tr|br|td|th)>|<br\s*\/?>/gi, "\n").split("\n").map(strip).filter(Boolean);
  return blocks.join("\n");
}
export function htmlMeta(html) {
  const pick = (re) => { const m = html.match(re); return m ? strip(m[1]) : ""; };
  const heads = (tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => strip(m[1])).filter(Boolean);
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i),
    lang: pick(/<html[^>]+lang=["']([^"']+)["']/i),
    h1: heads("h1").slice(0, 3),
    h2: heads("h2").slice(0, 20),
  };
}
export function htmlLinks(html, base) {
  const host = new URL(base).host.replace(/^www\./, "");
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try { u = new URL(decode(m[1]), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.host.replace(/^www\./, "") !== host) continue;
    if (/\.(pdf|jpe?g|png|webp|svg|zip|xml|ics)$/i.test(u.pathname)) continue;
    u.hash = ""; u.search = "";
    const key = u.href.replace(/\/$/, "");
    if (!out.has(key)) out.set(key, strip(m[2]).slice(0, 80));
  }
  return [...out].map(([url, text]) => ({ url, text }));
}
// Pages that say the most about the business come first: prices, services, about, references, questions, contact.
const PAGE_HINTS = [/hinn|hinta|pric/i, /palvel|service|tuott|product|ratkaisu|solution/i, /meist|yrity|about|tarina|story|tiimi|team/i, /referenss|asiakk|case|customer|työmme|work/i, /ukk|faq|kysy/i, /yhtey|contact/i];
const PAGE_SKIP = /tietosuoj|privacy|rekisteriselos|ev[aä]ste|cookie|ehdot|terms|kirjaudu|login|ostoskori|cart|checkout|\/(en|sv|fi|de)$/i;
export function pickPages(links, max = 7) {
  const score = (l) => { const s = `${l.url} ${l.text}`; const i = PAGE_HINTS.findIndex((re) => re.test(s)); return i < 0 ? 99 : i; };
  const depth = (l) => new URL(l.url).pathname.split("/").filter(Boolean).length;
  const pages = links.filter((l) => new URL(l.url).pathname !== "/" && !PAGE_SKIP.test(new URL(l.url).pathname));
  const hinted = pages.filter((l) => score(l) < 99).sort((a, b) => depth(a) - depth(b) || score(a) - score(b));
  // Many sites name a service page after the service, with no hint word. Free places go to the other pages,
  // the shallowest first and otherwise in the order the site links to them (the menu comes first).
  const rest = pages.filter((l) => score(l) === 99).sort((a, b) => depth(a) - depth(b));
  return [...hinted, ...rest].slice(0, max).map((l) => l.url);
}
export function stylesheetUrls(html, base) {
  const out = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=["']?[^"'>]*stylesheet/i.test(m[0])) continue;
    const h = m[0].match(/href=["']([^"']+)["']/i);
    if (h) try { out.push(new URL(decode(h[1]), base).href); } catch {}
  }
  return [...new Set(out)];
}
export const inlineCss = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
export function normColor(c) {
  c = c.trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`;
  }
  return null;
}
export function colorInfo(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  return { light, sat };
}
// Colours of a stylesheet with how often each is used, and the custom properties that hold a colour.
export function cssColors(css) {
  const count = new Map();
  const names = new Map();
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)) {
    const c = normColor(m[0]);
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi)) {
    const c = normColor(m[2]);
    if (c) names.set(c, [...new Set([...(names.get(c) ?? []), m[1]])]);
  }
  return [...count].map(([hex, n]) => ({ hex, count: n, vars: names.get(hex) ?? [] })).sort((a, b) => b.count - a.count);
}
const GENERIC = /^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|noto sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|var\(.*|menlo|monaco|consolas|courier new|liberation mono|sfmono-regular|georgia|times new roman|times|cambria)$/i;
export function cssFonts(css) {
  const count = new Map();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi))
    for (const raw of m[1].split(",")) {
      const f = raw.replace(/!important/i, "").trim().replace(/^["']|["']$/g, "");
      if (f && !GENERIC.test(f) && !/^__|fallback/i.test(f)) count.set(f, (count.get(f) ?? 0) + 1);
    }
  return [...count].map(([family, n]) => ({ family, count: n })).sort((a, b) => b.count - a.count);
}
// A first guess of the look for brand.json. It is a guess: the user confirms every value.
const VAR_ROLES = {
  paper: /^--(paper|background|bg|color-background|color-bg)$/i,
  soft: /^--(soft|surface|bg-soft|background-soft|color-surface)$/i,
  ink: /^--(ink|foreground|text|fg|color-text|color-foreground)$/i,
  muted: /^--(muted|text-muted|muted-foreground|color-muted)$/i,
  line: /^--(line|border|color-border)$/i,
  accent: /^--(accent|color-accent)$/i,
  night: /^--(night|dark|color-dark)$/i,
};
export function suggestBrand(colors, fonts, name = "") {
  const info = colors.map((c) => ({ ...c, ...colorInfo(c.hex) }));
  // Tinted greys count as neutral: a warm off-white or a blue-black is still a background or a text colour.
  const neutral = info.filter((c) => c.sat < 0.15 || (c.light > 0.8 && c.sat < 0.4) || (c.light < 0.16 && c.sat < 0.5));
  const pick = (list, fallback) => list[0]?.hex ?? fallback;
  const lightN = neutral.filter((c) => c.light > 0.9);
  const paper = pick(lightN, "#ffffff");
  const ink = pick(neutral.filter((c) => c.light < 0.25), "#141414");
  const strong = info.filter((c) => c.sat >= 0.45 && !neutral.includes(c));
  const deep = pick(strong.filter((c) => c.light < 0.3), "");
  const accent = pick(strong.filter((c) => c.light >= 0.3 && c.light < 0.8), deep);
  const soft = pick(lightN.filter((c) => c.hex !== paper), "#f3f3f3");
  const muted = pick(neutral.filter((c) => c.light >= 0.3 && c.light <= 0.6), "#6b6b6b");
  const line = pick(neutral.filter((c) => c.light > 0.75 && c.light <= 0.9), "#e2e2e2");
  const night = deep && deep !== accent ? deep : pick(neutral.filter((c) => c.light < 0.12), ink);
  const guess = { paper, soft, ink, muted, line, accent: accent || ink, night };
  // A site that names its colours in custom properties has already said which colour does what: that beats counting.
  for (const [role, re] of Object.entries(VAR_ROLES)) {
    const named = colors.find((c) => (c.vars ?? []).some((v) => re.test(v)));
    if (named) guess[role] = named.hex;
  }
  return { name, logo: "", font: fonts[0]?.family ?? "", fontUrl: "", colors: guess };
}

// ---------- own texts ----------
// Reads a CSV with quoted fields that may hold line breaks and doubled quotes (the layout of LinkedIn's export).
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}
// Texts from a CSV: the column with the writing is found by its name, else the one with the longest cells.
export function textsFromCsv(text, source = "csv") {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  let col = head.findIndex((h) => /commentary|^text$|content|message|^post$|body|teksti|sisältö/.test(h));
  if (col < 0) {
    const len = head.map((_, i) => rows.slice(1).reduce((a, r) => a + (r[i]?.length ?? 0), 0));
    col = len.indexOf(Math.max(...len));
  }
  const dateCol = head.findIndex((h) => /date|päivä|created|time/.test(h));
  const linkCol = head.findIndex((h) => /sharelink|permalink|^url$|^link$/.test(h));
  return rows.slice(1).map((r) => ({ source, date: dateCol >= 0 ? (r[dateCol] ?? "").slice(0, 10) : "", url: linkCol >= 0 ? r[linkCol] ?? "" : "", text: (r[col] ?? "").replace(/\r/g, "").trim() })).filter((t) => t.text.length > 0);
}
// Texts from a plain file: one text per block, blocks separated by a line of three or more dashes.
export const textsFromPlain = (text, source = "text") => text.replace(/^﻿/, "").split(/\r?\n\s*-{3,}\s*\r?\n/).map((t) => ({ source, date: "", url: "", text: t.trim() })).filter((t) => t.text);

const STOP = new Set("ja on ei se että kun niin mutta tai jos myös vain kuin oli ole ovat olla en et emme ette eivät sen sitä siitä siihen sillä tämä tämän tätä nämä ne niitä niiden joka jotka jota jonka mikä mitä miten missä miksi koska kanssa vielä jo nyt sitten sekä eli kuten hyvin enemmän paljon voi voit voin saa pitää olen olet olemme the a an and or but if of to in on for with is are was were be been it this that these those as at by from not no so we you i our your my they them their he she his her its can will just do does did have has had than then there here what which who how why when more very".split(" "));
const words = (t) => (t.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? []);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10; };
const sentencesOf = (t) => t.replace(/https?:\/\/\S+/g, " ").split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => words(s).length > 0);
const top = (map, n, min = 2) => [...map].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => ({ text: k, count: c }));

// Counts how a set of texts is written. The numbers describe; the rules are written by reading the texts.
export function voiceStats(texts) {
  const sentLens = [], textLens = [], openings = [], endings = [];
  const wc = new Map(), pc = new Map();
  let questions = 0, exclam = 0, sentences = 0, emoji = 0, hashtags = 0, withList = 0;
  // Pronouns only. Finnish often shows the person in the verb ending alone, so these undercount: read them as a hint.
  const forms = { i: 0, we: 0, youOne: 0, youFormal: 0 };
  const FORM_FI = [[/^(minä|mä|mun|minun|minulla|minulle|mulla|mulle|minua|mua)$/, "i"], [/^(me|meidän|meillä|meille|meitä|meiltä)$/, "we"], [/^(sinä|sä|sinun|sun|sinulla|sulla|sinulle|sulle|sinua|sua)$/, "youOne"], [/^(te|teidän|teillä|teille|teitä|teiltä)$/, "youFormal"]];
  const FORM_EN = [[/^(i|my|me|mine)$/, "i"], [/^(we|our|us|ours)$/, "we"], [/^(you|your|yours)$/, "youOne"]];
  const fi = (t) => /[äö]/i.test(t);
  for (const { text } of texts) {
    const w = words(text);
    textLens.push(w.length);
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines[0]) openings.push(lines[0].slice(0, 200));
    if (lines.length > 1) endings.push(lines.at(-1).slice(0, 200));
    if (lines.filter((l) => /^([-•*–→✅▪]|\d+[.)])\s/.test(l)).length >= 2) withList++;
    emoji += (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    hashtags += (text.match(/(^|\s)#[\p{L}\d_]+/gu) ?? []).length;
    for (const s of sentencesOf(text)) {
      sentences++;
      sentLens.push(words(s).length);
      if (/\?\s*$/.test(s)) questions++;
      if (/!\s*$/.test(s)) exclam++;
    }
    const FORM = fi(text) ? FORM_FI : FORM_EN;
    for (let i = 0; i < w.length; i++) {
      for (const [re, key] of FORM) if (re.test(w[i])) { forms[key]++; break; }
      if (w[i].length > 2 && !STOP.has(w[i])) wc.set(w[i], (wc.get(w[i]) ?? 0) + 1);
      if (i && !STOP.has(w[i]) && !STOP.has(w[i - 1]) && w[i].length > 2 && w[i - 1].length > 2) { const p = `${w[i - 1]} ${w[i]}`; pc.set(p, (pc.get(p) ?? 0) + 1); }
    }
  }
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const sorted = [...sentLens].sort((a, b) => a - b);
  return {
    texts: texts.length,
    wordsPerText: { median: median(textLens), shortest: Math.min(...textLens, Infinity) === Infinity ? 0 : Math.min(...textLens), longest: Math.max(0, ...textLens) },
    sentences,
    wordsPerSentence: { median: median(sentLens), short: sorted[Math.floor(sorted.length * 0.25)] ?? 0, long: sorted[Math.floor(sorted.length * 0.75)] ?? 0 },
    questionShare: pct(questions, sentences),
    exclamationShare: pct(exclam, sentences),
    emojiPerText: texts.length ? Math.round((10 * emoji) / texts.length) / 10 : 0,
    hashtagsPerText: texts.length ? Math.round((10 * hashtags) / texts.length) / 10 : 0,
    textsWithList: pct(withList, texts.length),
    address: forms,
    openings: openings.slice(0, 40),
    endings: endings.slice(0, 40),
    words: top(wc, 40, 3),
    phrases: top(pc, 25, 2),
  };
}

// ---------- images ----------
// Width and height straight from the file header: PNG, JPEG, GIF, WebP and AVIF. SVG is named but not measured.
export function imageSize(buf) {
  if (!buf || buf.length < 24) return null;
  const tag = (i, n) => buf.toString("latin1", i, i + n);
  if (buf.readUInt32BE(0) === 0x89504e47) return { type: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (tag(0, 4) === "GIF8") return { type: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (tag(0, 4) === "RIFF" && tag(8, 4) === "WEBP" && buf.length >= 30) {
    const kind = tag(12, 4);
    if (kind === "VP8 ") return { type: "webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") { const b = buf.readUInt32LE(21); return { type: "webp", width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1 }; }
    if (kind === "VP8X") return { type: "webp", width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: "jpeg", width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (tag(4, 4) === "ftyp") {
    const i = buf.indexOf("ispe", 0, "latin1");
    return i > 0 && i + 16 <= buf.length ? { type: "avif", width: buf.readUInt32BE(i + 8), height: buf.readUInt32BE(i + 12) } : null;
  }
  if (/<svg[\s>]/i.test(tag(0, Math.min(buf.length, 600)))) return { type: "svg", width: 0, height: 0 };
  return null;
}
// The address of the picture itself. Image optimisers (/_next/image?url=…) are unwrapped to the original file.
export function imageUrl(raw, base) {
  let u;
  try { u = new URL(decode(String(raw).trim()), base); } catch { return ""; }
  if (!/^https?:$/.test(u.protocol)) return "";
  const inner = u.searchParams.get("url");
  if (inner && /\/(_next\/image|_vercel\/image|_ipx)\b/.test(u.pathname)) { try { u = new URL(inner, base); } catch {} }
  u.hash = "";
  return u.href;
}
const attrOf = (tagText, name) => { const m = tagText.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")); return m ? (m[1] ?? m[2]) : ""; };
// The largest candidate of a srcset.
const largest = (srcset) => srcset.split(/,\s+|,(?=\S+\s+\d)/).map((c) => { const [url, d = "1x"] = c.trim().split(/\s+/); return { url, d: parseFloat(d) || 1 }; }).filter((c) => c.url).sort((a, b) => b.d - a.d)[0]?.url ?? "";
// Every picture a page shows: <img>, <source>, lazy-loading attributes, background images written on elements and the share image.
// zone is "chrome" for pictures inside the navigation or the footer: those are logos and badges far more often than brand photos.
// zone is "share" for a picture that is only the page's share image (og:image).
export function htmlImages(html, base) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, " ");
  const out = new Map();
  const add = (raw, alt, zone) => {
    if (!raw || /^data:/i.test(raw.trim())) return;
    const src = imageUrl(raw, base);
    if (!src) return;
    const old = out.get(src);
    if (!old) out.set(src, { src, alt: strip(alt ?? ""), zone });
    else { if (zone === "content" || old.zone === "share") old.zone = zone; if (!old.alt && alt) old.alt = strip(alt); }
  };
  const scan = (part, zone) => {
    for (const m of part.matchAll(/<(img|source)\b[^>]*>/gi)) {
      const t = m[0];
      const set = attrOf(t, "srcset") || attrOf(t, "data-srcset");
      add((set && largest(set)) || attrOf(t, "data-src") || attrOf(t, "data-lazy-src") || attrOf(t, "src"), attrOf(t, "alt"), zone);
    }
    for (const m of part.matchAll(/background(?:-image)?\s*:[^;"']*url\(\s*(?:&quot;|["'])?([^"')&]+)/gi)) add(m[1], "", zone);
  };
  const chrome = [];
  const content = clean.replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, (m) => { chrome.push(m); return " "; });
  scan(content, "content");
  scan(chrome.join(" "), "chrome");
  const og = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og) add(og[1], "", "share");
  return [...out.values()];
}
// The file name without the parts that only tell a size or a build: -1024x768, @2x, -scaled, .d2095dcd.
export function imageStem(url) {
  let name = String(url);
  try { name = decodeURIComponent(new URL(url, "file:///").pathname.split("/").pop()); } catch {}
  let s = name.toLowerCase().replace(/\.(jpe?g|png|webp|avif|gif|svg)$/, "");
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/[-_.]\d{2,4}x\d{2,4}$/, "").replace(/@\dx$/, "").replace(/[-_.](scaled|small|medium|large|thumb|thumbnail|mobile|desktop|\d{3,4}w)$/, "").replace(/[-_.](?=[0-9a-f]*\d)[0-9a-f]{8,}$/, "");
    if (next === s || !next) break;
    s = next;
  }
  return s;
}
// Why a picture is left off the board, or "" when it stays. The board is for the company's own photos and illustrations:
// icons, logos, badges, payment marks and thin strips say nothing about how the brand's pictures should look.
const NOT_BRAND = /logo|badge|sertifi|certif|award|palkin|partner|kumppan|sponsor|trustpilot|maksutav|payment|klarna|visa|mastercard|paytrail|mobilepay|app-?store|google-?play|favicon|(?:^|[-_/ ])ico(?:n|ni)?s?(?:[-_/. ]|$)|sprite|avatar|gravatar|placeholder|spacer|pixel|(?:^|[-_/ ])(?:flag|lippu)/i;
export function skipReason(img) {
  if (img.type === "svg") return "vector graphic: an icon or a logo";
  if (!img.width || !img.height) return "not a picture this script can read";
  if (Math.min(img.width, img.height) < 200) return "small: an icon or a thumbnail";
  const ratio = img.width / img.height;
  if (ratio > 4 || ratio < 0.25) return "a thin strip or banner";
  let pathText = img.src ?? "";
  try { pathText = decodeURIComponent(new URL(img.src, "file:///").pathname); } catch {}
  if (NOT_BRAND.test(`${img.alt ?? ""} ${pathText}`)) return "a logo, badge or icon by its name";
  if (img.zone === "chrome") return "in the navigation or the footer";
  return "";
}
// Near-identical pictures become one group: the same bytes, the same name apart from size and build suffixes,
// or a name that continues another one (hero-desk, hero-desk-mix) with the same shape. The largest version represents the group.
export function groupImages(items) {
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a, b) => { const [x, y] = [find(a), find(b)].sort((p, q) => p - q); parent[y] = x; };
  const shape = (x) => (x.width && x.height ? x.width / x.height : 0);
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [items[i], items[j]];
      if (a.hash && a.hash === b.hash) { join(i, j); continue; }
      const [s, l] = a.stem.length <= b.stem.length ? [a.stem, b.stem] : [b.stem, a.stem];
      const sameShape = shape(a) && shape(b) && Math.abs(shape(a) - shape(b)) / shape(a) < 0.03;
      if (s && s === l && (sameShape || !shape(a) || !shape(b))) join(i, j);
      else if (s.length >= 4 && l.startsWith(s) && /^[-_.]/.test(l.slice(s.length)) && !/^[-_.]\d+$/.test(l.slice(s.length)) && sameShape) join(i, j);
    }
  const groups = new Map();
  items.forEach((it, i) => { const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
  return [...groups.values()].map((list) => ({ rep: [...list].sort((a, b) => b.width * b.height - a.width * a.height || a.src.length - b.src.length)[0], items: list }));
}
// When there are more groups than fit on one board, take them in turns from each source (each page, the folder),
// so that the board shows every kind of picture and not twenty from one gallery.
export function sampleGroups(groups, max) {
  if (groups.length <= max) return { shown: groups, left: [] };
  const buckets = new Map();
  for (const g of groups) { const k = g.rep.from ?? ""; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(g); }
  const picked = new Set();
  for (let round = 0; picked.size < max; round++) {
    let any = false;
    for (const list of buckets.values()) if (list[round] && picked.size < max) { picked.add(list[round]); any = true; }
    if (!any) break;
  }
  return { shown: groups.filter((g) => picked.has(g)), left: groups.filter((g) => !picked.has(g)) };
}
// "3,5, 7-9" as numbers.
export const parseNumbers = (s) => [...new Set(String(s ?? "").split(/[,;\s]+/).flatMap((p) => { const m = p.match(/^(\d+)(?:-(\d+))?$/); if (!m) return []; const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])]; return Array.from({ length: Math.max(0, Math.min(b - a, 200)) + 1 }, (_, i) => a + i); }))];
