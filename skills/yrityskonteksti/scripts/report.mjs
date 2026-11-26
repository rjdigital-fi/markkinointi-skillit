#!/usr/bin/env node
// Builds report.html (slides) and report.md from the three context files and brand.json. Node 18+, no dependencies.
//   node report.mjs --dir <work folder> [--lang fi|en] [--note "..."] [--brand "NAME"] [--out report.html]
// One self-contained HTML file with no scripts. Opens in any browser and prints to PDF one slide per page.
// The look comes from brand.json in the work folder, so the report is in the company's own colours and font.
// Without one, the brand.json of the skill folder is used.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frontmatter, sections, markers, stripMarkers, COLOR_KEYS, FREE } from "./core.mjs";
import { checkFolder } from "./check.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? "yrityskonteksti");
const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
if (!fs.existsSync(dir)) { console.error(`Folder not found: ${dir}`); process.exit(1); }

const status = checkFolder(dir, args.today && args.today !== "true" ? new Date(args.today) : new Date());
if (status.files.every((f) => f.state === "missing")) { console.error(`No context files in ${dir}. Write yritys.md, kohderyhma.md and brandi.md first.`); process.exit(1); }
fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(status, null, 2) + "\n");

const base = readJson(path.join(here, "..", "brand.json")) ?? {};
const own = readJson(path.join(dir, "brand.json"));
const brand = own ?? base;
const col = { paper: "#ffffff", soft: "#f3f3f3", ink: "#141414", muted: "#6b6b6b", line: "#e2e2e2", accent: "#ff5a1f", night: "#000000", ...(brand.colors ?? {}) };
const font = brand.font || "Hanken Grotesk";
const lang = args.lang === "en" || args.lang === "fi" ? args.lang : status.files.some((f) => /^(company|audience|brand)\.md$/.test(f.file) && f.state !== "missing") ? "en" : "fi";
const credit = (brand.credit ?? base.credit ?? {})[lang] ?? "";
const brandName = args.brand && args.brand !== "true" ? args.brand : brand.name ?? "";
const company = status.company || brand.name || "";

const L = {
  fi: {
    title: "Brändi, kohderyhmä ja yrityskonteksti", date: "Tarkistettu", confirmed: "Vahvistettu", derived: "Päätelty", open: "Auki",
    sConfirmed: "vahvistettua tietoa", sDerived: "pääteltyä, odottaa vahvistusta", sOpen: "avointa kysymystä", sReady: "tiedostoa valmiina",
    files: { company: "Yritys ja tarjooma", audience: "Kohderyhmä", brand: "Brändi ja ääni" },
    state: { ready: "Valmis", draft: "Kesken", fix: "Korjattavaa", missing: "Puuttuu" },
    status: "Tila", statusTitle: "Mitä yrityksestä tiedetään varmasti", statusSub: "Jokaisella tiedolla on merkintä. Vahvistettu on omistajan oma sana tai päätös. Päätelty on luettu verkkosivulta tai muusta aineistosta, eikä kukaan ole vielä vahvistanut sitä. Auki tarkoittaa, että tieto puuttuu ja se kysytään.",
    owner: "Omistaja", reviewed: "Luettu viimeksi", never: "ei vielä", noOwner: "ei nimetty", fixes: (n) => `${n} muotovirhettä: aja check.mjs`,
    look: "Ulkoasu", lookTitle: "Värit ja fontti", lookSub: "Arvot ovat tiedostossa brand.json. Muut skillit lukevat ne samasta paikasta, joten raportit ja työkalut saavat saman ilmeen.",
    roles: { paper: "Tausta", soft: "Pinta", ink: "Teksti", muted: "Himmeä teksti", line: "Viiva", accent: "Korosteväri", night: "Tumma tausta" },
    fontLabel: "Fontti", contrast: "Kontrasti", textOnPaper: "teksti taustalla", accentOnPaper: "korosteväri taustalla", sample: "Selkeä teksti kertoo, mitä myydään, kenelle ja mihin hintaan.",
    picsTitle: "Kuvat: omistajan valinnat", picsSub: (g, n, u, d) => `Omistaja valitsi kuvataululta${d ? ` ${d}` : ""}: ${g} hyvää, ${n} ei käytetä${u ? `, ${u} en osaa sanoa` : ""}. Kuvasääntö on kirjoitettu näistä valinnoista tiedostoon brandi.md.`, pic: { good: "Hyvä", no: "Ei käytetä", unsure: "En osaa sanoa" },
    openK: "Avoimet kysymykset", openTitle: "Nämä kysytään seuraavaksi", openSub: "Avoin kohta jää tyhjäksi, kunnes omistaja vastaa. Mitään ei täytetä arvaamalla.", openNone: "Avoimia kysymyksiä ei ole.", empty: "tieto puuttuu",
    method: "Näin tätä käytetään", methodTitle: "Kolme tiedostoa, yksi paikka", read: "Mistä tiedot on luettu", use: "Näin käytätte tiedostoja",
    useList: ["Tiedostot ovat tavallista tekstiä. Ne voi lukea ja korjata millä tahansa tekstieditorilla.", "Tekoäly lukee ne ennen kuin se kirjoittaa, suunnittelee tai tekee raportin, eikä kysy samoja asioita uudelleen.", "Kun jokin muuttuu, korjataan tiedosto ja kirjataan muutos sen loppuun.", "Omistaja lukee tiedostot uudelleen puolen vuoden välein."],
    pages: (n) => `Verkkosivusto: ${n} sivua`, texts: (n, f) => `Omat tekstit: ${n} tekstiä (${f})`, noRaw: "Verkkosivua tai omia tekstejä ei luettu skripteillä. Tiedot ovat haastattelusta ja annetusta aineistosta.",
    mdStatus: "Tila", mdFile: "Tiedosto", mdOpen: "Avoimet kysymykset", mdFix: "Korjattavaa",
  },
  en: {
    title: "Brand, audience and company context", date: "Checked", confirmed: "Confirmed", derived: "Derived", open: "Open",
    sConfirmed: "confirmed facts", sDerived: "derived, waiting for confirmation", sOpen: "open questions", sReady: "files ready",
    files: { company: "Company and offer", audience: "Audience", brand: "Brand and voice" },
    state: { ready: "Ready", draft: "Draft", fix: "Needs fixing", missing: "Missing" },
    status: "Status", statusTitle: "What is known for certain about the company", statusSub: "Every fact carries a marker. Confirmed is the owner's own word or decision. Derived was read from the website or other material and nobody has confirmed it yet. Open means the fact is missing and will be asked.",
    owner: "Owner", reviewed: "Last read", never: "not yet", noOwner: "not named", fixes: (n) => `${n} format problems: run check.mjs`,
    look: "Look", lookTitle: "Colours and font", lookSub: "The values live in brand.json. The other skills read them from the same place, so reports and tools get the same look.",
    roles: { paper: "Background", soft: "Surface", ink: "Text", muted: "Muted text", line: "Line", accent: "Accent", night: "Dark background" },
    fontLabel: "Font", contrast: "Contrast", textOnPaper: "text on background", accentOnPaper: "accent on background", sample: "Clear text says what is sold, to whom and at what price.",
    picsTitle: "Pictures: the owner's choices", picsSub: (g, n, u, d) => `The owner chose from the image board${d ? ` on ${d}` : ""}: ${g} good, ${n} not used${u ? `, ${u} cannot say` : ""}. The picture rule in brand.md is written from these choices.`, pic: { good: "Good", no: "Not used", unsure: "Cannot say" },
    openK: "Open questions", openTitle: "These are asked next", openSub: "An open item stays empty until the owner answers. Nothing is filled in by guessing.", openNone: "There are no open questions.", empty: "missing",
    method: "How to use this", methodTitle: "Three files, one place", read: "Where the facts were read", use: "How to use the files",
    useList: ["The files are plain text. Any text editor can read and correct them.", "The AI reads them before it writes, plans or builds a report, and does not ask the same things again.", "When something changes, correct the file and note the change at its end.", "The owner reads the files again every six months."],
    pages: (n) => `Website: ${n} pages`, texts: (n, f) => `Own texts: ${n} texts (${f})`, noRaw: "No website or own texts were read with the scripts. The facts come from the interview and the material given.",
    mdStatus: "Status", mdFile: "File", mdOpen: "Open questions", mdFix: "To fix",
  },
}[lang];

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inl = (s) => e(stripMarkers(s)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\((?:https?:|\/)[^)\s]*\)/g, "$1");
const pill = (m, withSource = true) => `<span class="v m-${m.kind}">${L[m.kind]}</span>${withSource && m.source ? `<small class="src">${e(m.source)}</small>` : ""}`;
const pills = (s, withSource = true) => markers(s).map((m) => pill(m, withSource)).join("");
const showDate = (d) => (Number.isNaN(new Date(d).getTime()) ? String(d) : new Date(d).toLocaleDateString(lang === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "numeric", year: "numeric" }));
const dateText = showDate(status.checked);

// ---------- report.md ----------
const md = [`# ${L.title}: ${company}`, "", `${L.date} ${dateText}. ${L.confirmed} ${status.totals.confirmed} · ${L.derived} ${status.totals.derived} · ${L.open} ${status.totals.open}`, "", `## ${L.mdStatus}`, "", `| ${L.mdFile} | ${L.mdStatus} | ${L.confirmed} | ${L.derived} | ${L.open} | ${L.owner} | ${L.reviewed} |`, "|---|---|---|---|---|---|---|"];
for (const f of status.files) md.push(`| ${f.file} | ${L.state[f.state]} | ${f.confirmed} | ${f.derived} | ${f.open} | ${f.owner || L.noOwner} | ${f.reviewed || L.never} |`);
md.push("", `## ${L.mdOpen}`, "");
if (!status.totals.open) md.push(L.openNone);
for (const f of status.files) for (const o of f.openItems) md.push(`- **${L.files[f.key]}**, ${o.section}: ${o.text || L.empty}`);
const fixes = status.files.flatMap((f) => f.problems.map((p) => `- ${f.file}: ${p}`)).concat(status.brand.problems.map((p) => `- brand.json: ${p}`));
if (fixes.length) md.push("", `## ${L.mdFix}`, "", ...fixes);
fs.writeFileSync(path.join(dir, "report.md"), md.join("\n") + "\n");

// ---------- report.html ----------
let page = 1;
const slides = [];
const slide = (kicker, title, sub, body) => {
  page++;
  slides.push(`<section class="slide"><p class="kicker">${e(kicker)}</p><h2>${e(title)}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}<div class="body">${body}</div><footer class="foot"><span>${e(L.title)}: ${e(company)}</span><span>${e(credit)}</span><span>${page}</span></footer></section>`);
};
// Rows are spread evenly over the slides, so the last slide never holds a single leftover row.
const chunk = (list, size) => {
  const n = Math.ceil(list.length / size);
  const per = Math.ceil(list.length / (n || 1));
  return Array.from({ length: n }, (_, i) => list.slice(i * per, (i + 1) * per));
};

// 1. Status
const share = (n, t) => (t ? (100 * n) / t : 0);
slide(
  L.status,
  L.statusTitle,
  e(L.statusSub),
  `<div class="status">${status.files
    .map((f) => {
      const t = f.confirmed + f.derived + f.open;
      const seg = (k) => (f[k] ? `<i class="s-${k}" style="flex:${share(f[k], t)}"></i>` : "");
      return `<section class="tile"><div class="tile-top"><h3>${e(L.files[f.key])}</h3><span class="v st-${f.state}">${L.state[f.state]}</span></div>
<p class="file">${e(f.file)}</p>
<div class="stack">${t ? seg("confirmed") + seg("derived") + seg("open") : ""}</div>
<dl class="counts"><div><dt>${L.confirmed}</dt><dd>${f.confirmed}</dd></div><div><dt>${L.derived}</dt><dd>${f.derived}</dd></div><div><dt>${L.open}</dt><dd>${f.open}</dd></div></dl>
<p class="meta"><b>${L.owner}</b> ${e(f.owner || L.noOwner)}</p><p class="meta"><b>${L.reviewed}</b> ${e(f.reviewed ? showDate(f.reviewed) : L.never)}</p>${f.problems.length ? `<p class="meta warn">${e(L.fixes(f.problems.length))}</p>` : ""}</section>`;
    })
    .join("")}</div>`,
);

// 2. The files: sections in order, as many on a slide as fit
const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isRule = (l) => /^\s*\|?\s*:?-{2,}/.test(l);
const isItem = (l) => /^\s*(?:[-*]|\d+\.)\s+\S/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function blocks(lines) {
  const out = [];
  let cur = null;
  const push = (type, extra = {}) => out.push((cur = { type, lines: [], ...extra }));
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { push("rule", { name: h3[1].trim() }); continue; }
    if (!line.trim()) { if (cur && cur.type !== "rule") cur = null; continue; }
    if (cur?.type === "rule" && isItem(line)) { cur.lines.push(line); continue; }
    const type = isRow(line) ? "table" : isItem(line) ? "list" : "text";
    if (!cur || cur.type !== type) push(type);
    cur.lines.push(line);
  }
  return out;
}
const item = (l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
const gap = `<span class="gap">${L.empty}</span>`;
// Each part is { html, weight }: weight is roughly the number of rows it takes on a slide.
function table(lines) {
  const rows = lines.filter((l) => !isRule(l)).map(cells);
  const [head, ...body] = rows;
  const tr = (r) => `<tr>${r.map((c, i) => { const text = inl(c); const p = pills(c); return `<td class="${i === 0 ? "k" : ""}${p && !text ? " mk" : ""}">${text}${!text && !p && i > 0 && i < r.length - 1 && r.length < 4 ? gap : ""}${p ? `${text ? " " : ""}${p}` : ""}</td>`; }).join("")}</tr>`;
  // A row takes more room when a cell or its source wraps onto a second line.
  const rowWeight = (r) => 0.66 + (r.some((c) => stripMarkers(c).length > 150 / r.length || markers(c).some((m) => (m.source ?? "").length > 24)) ? 0.34 : 0);
  return chunk(body, 8).map((part) => ({ weight: part.reduce((n, r) => n + rowWeight(r), 0) + 0.6, html: `<table class="facts"><thead><tr>${head.map((h) => `<th>${inl(h)}</th>`).join("")}</tr></thead><tbody>${part.map(tr).join("")}</tbody></table>` }));
}
const list = (lines) => chunk(lines, 9).map((part) => ({ weight: part.length * 0.66, html: `<ul class="items">${part.map((l) => `<li><span>${inl(item(l)) || gap}</span><span class="tag">${pills(l)}</span></li>`).join("")}</ul>` }));
const rule = (b) => `<section class="tile rule"><h3>${inl(b.name)}</h3><ul>${b.lines.map((l) => { const m = item(l).match(/^\**([^:*]+)\**\s*:\s*(.*)$/); return m ? `<li><b>${e(m[1])}</b><span>${inl(m[2])}</span>${pills(m[2])}</li>` : `<li><span>${inl(item(l))}</span>${pills(l)}</li>`; }).join("")}</ul></section>`;

const BUDGET = 9;
for (const f of status.files) {
  if (f.state === "missing") continue;
  const { body } = frontmatter(fs.readFileSync(path.join(dir, f.file), "utf8"));
  const parts = [];
  for (const s of sections(body).sections) {
    if (FREE.test(s.heading)) continue;
    const bl = blocks(s.lines);
    const own = [];
    for (const b of bl) {
      if (b.type === "text") own.push({ text: true, weight: 0.8, html: `<p class="para">${b.lines.map((l) => `${inl(l)} ${pills(l)}`).join(" ")}</p>` });
      else if (b.type === "table") own.push(...table(b.lines));
      else if (b.type === "list") own.push(...list(b.lines));
    }
    for (const g of chunk(bl.filter((b) => b.type === "rule"), 3)) own.push({ weight: 4.8, html: `<div class="rules">${g.map(rule).join("")}</div>` });
    // A paragraph stays on the same slide as the block that follows it.
    for (let i = own.length - 2; i >= 0; i--) if (own[i].text) own.splice(i, 2, { weight: own[i].weight + own[i + 1].weight, html: own[i].html + own[i + 1].html });
    own.forEach((p, i) => parts.push({ ...p, weight: p.weight + (i === 0 ? 1.4 : 0), html: (i === 0 ? `<h3 class="sec">${inl(s.heading)}</h3>` : "") + p.html, first: i === 0 }));
  }
  const pagesOf = [];
  let weight = 0;
  for (const p of parts) {
    const extra = p.first ? 0.5 : 0; // a heading in the middle of a slide also takes its top margin
    if (pagesOf.length && weight + p.weight + extra <= BUDGET) { pagesOf[pagesOf.length - 1] += p.html; weight += p.weight + extra; }
    else { pagesOf.push(p.html); weight = p.weight; }
  }
  pagesOf.forEach((p) => slide(f.file, L.files[f.key], null, p));
}

// 3. Pictures: what the owner chose on the image board (raw/images.json, written by images.mjs)
const board = readJson(path.join(dir, "raw", "images.json"));
const chosen = (board?.groups ?? []).filter((g) => g.show !== false && g.verdict);
if (chosen.length) {
  // Small pictures are written into the report itself, so the file can be sent on its own.
  // Large ones are linked from raw/images/ and need that folder next to the report.
  let room = 2_000_000;
  const mime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" };
  const outDir = path.dirname(path.resolve(args.out ?? path.join(dir, "report.html")));
  const src = (g) => {
    const file = path.join(dir, g.file);
    try {
      const size = fs.statSync(file).size;
      const type = mime[path.extname(file).slice(1).toLowerCase()];
      if (type && size <= 400_000 && size <= room) { room -= size; return `data:${type};base64,${fs.readFileSync(file).toString("base64")}`; }
    } catch { return ""; }
    return path.relative(outDir, file).split(path.sep).join("/");
  };
  const order = { good: 0, no: 1, unsure: 2 };
  const sorted = [...chosen].sort((a, b) => order[a.verdict] - order[b.verdict] || a.n - b.n);
  const count = (v) => chosen.filter((g) => g.verdict === v).length;
  for (const part of chunk(sorted, 8))
    slide(
      L.files.brand,
      L.picsTitle,
      e(L.picsSub(count("good"), count("no"), count("unsure"), board.answered ? showDate(board.answered) : "")),
      `<div class="pics">${part.map((g) => { const s = src(g); return `<figure class="pic pic-${g.verdict}"><div class="pic-im">${s ? `<img src="${e(s)}" alt="">` : ""}</div><figcaption><span class="pic-n">${g.n}</span><span class="pic-t">${e(g.label)}</span><span class="v ${{ good: "m-confirmed", no: "st-missing", unsure: "m-derived" }[g.verdict]}">${L.pic[g.verdict]}</span></figcaption></figure>`; }).join("")}</div>`,
    );
}

// 4. Look
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(1).replace(".", lang === "fi" ? "," : "."); };
const okHex = (h) => /^#[0-9a-f]{6}$/i.test(h ?? "");
if (own && COLOR_KEYS.every((k) => okHex(col[k])))
  slide(
    L.look,
    L.lookTitle,
    e(L.lookSub),
    `<div class="sw">${COLOR_KEYS.map((k) => `<div class="sw-item"><i style="background:${col[k]}"></i><b>${L.roles[k]}</b><span>${col[k].toLowerCase()}</span></div>`).join("")}</div>
<div class="cols look"><div><p class="h3">${L.fontLabel}: ${e(font)}</p><p class="aa">Aa Ää Öö 123</p><p class="para">${e(L.sample)}</p></div>
<div><p class="h3">${L.contrast}</p><ul class="items"><li><span>${L.textOnPaper}</span><span class="tag"><b>${ratio(col.ink, col.paper)}:1</b></span></li><li><span>${L.accentOnPaper}</span><span class="tag"><b>${ratio(col.accent, col.paper)}:1</b></span></li></ul>${brand.logo ? `<p class="h3 h3-gap">Logo</p><img class="logo-s" src="${e(brand.logo)}" alt="">` : ""}</div></div>`,
  );

// 5. Open questions
const openAll = status.files.flatMap((f) => f.openItems.map((o) => ({ ...o, key: f.key })));
if (!openAll.length) slide(L.openK, L.openTitle, e(L.openSub), `<p class="note">${L.openNone}</p>`);
for (const part of chunk(openAll, 9))
  slide(L.openK, L.openTitle, e(L.openSub), `<table class="facts"><tbody>${part.map((o) => `<tr><td class="k">${e(L.files[o.key])}</td><td>${e(o.section)}</td><td>${o.text ? inl(o.text) : `<span class="gap">${L.empty}</span>`}</td><td class="mk mk-s">${pill({ kind: "open", source: "" })}</td></tr>`).join("")}</tbody></table>`);

// 6. How to use
const site = readJson(path.join(dir, "raw", "site.json"));
const texts = readJson(path.join(dir, "raw", "texts.json"));
const readList = [site?.pages?.length ? L.pages(site.pages.length) : "", texts?.used ? L.texts(texts.used, (texts.files ?? []).join(", ")) : ""].filter(Boolean);
slide(
  L.method,
  L.methodTitle,
  null,
  `<div class="cols"><div><p class="h3">${L.use}</p><ol class="list">${L.useList.map((x) => `<li>${e(x)}</li>`).join("")}</ol></div>
<div><p class="h3">${L.read}</p>${readList.length ? `<ul class="list">${readList.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : `<p class="note">${e(L.noRaw)}</p>`}
<p class="h3 h3-gap">${L.files.company}, ${L.files.audience}, ${L.files.brand}</p><ul class="pills">${status.files.map((f) => `<li>${e(f.file)}</li>`).join("")}<li>brand.json</li></ul></div></div>`,
);

const t = status.totals;
const cover = `<section class="slide cover">${brand.logo ? `<img class="logo" src="${e(brand.logo)}" alt="${e(brandName)}">` : `<p class="brand">${e(brandName)}</p>`}
<div class="cover-main"><p class="kicker">${e(L.title)}</p><h1>${e(company)}</h1>
<dl class="stats"><div><dt>${L.sConfirmed}</dt><dd>${t.confirmed}</dd></div><div><dt>${L.sDerived}</dt><dd>${t.derived}</dd></div><div><dt>${L.sOpen}</dt><dd>${t.open}</dd></div><div><dt>${L.sReady}</dt><dd>${t.ready}<span> / ${t.files}</span></dd></div></dl></div>
<div class="cover-meta"><p><b>${L.date}</b> ${dateText}</p>${args.note && args.note !== "true" ? `<p class="cover-note">${e(args.note)}</p>` : ""}</div></section>`;

// The look. Colours and font come from brand.json; change them there, not here.
const css = `
:root{--paper:${col.paper};--soft:${col.soft};--ink:${col.ink};--muted:${col.muted};--line:${col.line};--accent:${col.accent};--night:${col.night};--font:"${font}","Helvetica Neue",Arial,system-ui,sans-serif;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--soft);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
.deck{width:min(1280px,100% - 32px);margin:32px auto;display:grid;gap:28px}
.slide{background:var(--paper);border-radius:20px;padding:48px 56px 28px;min-height:720px;display:flex;flex-direction:column;min-width:0}
.kicker{margin:0 0 14px;font-size:14px;font-weight:500;color:var(--muted)}
h1,h2,h3,p{margin:0}
h2{font-size:38px;font-weight:500;line-height:1.15;letter-spacing:-0.02em;max-width:22em}
.sub{margin-top:12px;color:var(--muted);max-width:58em}
.body{margin-top:32px;flex:1;min-width:0}
.foot{margin-top:28px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;font-size:12px;color:var(--muted)}
.note{font-size:15px;color:var(--muted);max-width:40em}
.cover{background:var(--night) radial-gradient(900px circle at 100% 0%,rgba(255,255,255,.13),transparent 60%);color:#fff;padding-bottom:48px}
.brand{font-size:14px;font-weight:600;letter-spacing:.32em}
.logo{height:36px;width:auto;align-self:flex-start}
.cover-main{margin-top:auto}
.cover .kicker{color:rgba(255,255,255,.64);font-size:16px}
h1{font-size:96px;font-weight:500;line-height:1;letter-spacing:-0.035em;overflow-wrap:anywhere}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:48px 0 0}
.stats div{border-top:1px solid rgba(255,255,255,.28);padding-top:14px;display:flex;flex-direction:column-reverse;gap:2px}
.stats dd{margin:0;font-size:40px;font-weight:500;letter-spacing:-0.02em;line-height:1.1}
.stats dd span{font-size:22px;color:rgba(255,255,255,.64)}
.stats dt{font-size:14px;color:rgba(255,255,255,.64)}
.cover-meta{margin-top:40px;display:flex;flex-wrap:wrap;gap:6px 32px;font-size:14px;color:rgba(255,255,255,.64)}
.cover-meta b{color:#fff;font-weight:500;margin-right:6px}
.cover-note{flex-basis:100%;margin-top:10px;max-width:70em}
table{width:100%;border-collapse:collapse;font-size:15px;line-height:1.4}
th{text-align:left;font-size:12px;font-weight:500;color:var(--muted);padding:0 16px 8px 0;border-bottom:1px solid var(--ink)}
td{padding:11px 16px 11px 0;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
td.k{font-weight:500;width:22%}
td.mk{width:26%;white-space:normal}
td.mk-s{width:9%}
td.mk .src{display:inline;margin:0 0 0 8px}
td:last-child,th:last-child{padding-right:0}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;background:var(--soft);border-radius:4px;padding:1px 5px}
.v{display:inline-block;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:500;white-space:nowrap;line-height:1.4}
.m-confirmed,.st-ready{background:var(--ink);color:var(--paper)}
.m-derived,.st-draft{box-shadow:inset 0 0 0 1.5px var(--ink)}
.m-open,.st-fix{box-shadow:inset 0 0 0 1.5px var(--accent);background:var(--paper)}
.st-missing{background:var(--line);color:var(--muted)}
.src{display:block;font-size:12px;color:var(--muted);margin-top:4px;line-height:1.35}
.gap{color:var(--muted);font-style:italic}
.status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.tile{background:var(--soft);border-radius:14px;padding:24px}
.tile h3{font-size:19px;font-weight:500;letter-spacing:-0.01em}
.tile-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.file{font-size:13px;color:var(--muted);margin-top:2px}
.stack{display:flex;gap:2px;height:10px;margin-top:22px;border-radius:999px;overflow:hidden;background:var(--line)}
.stack i{display:block;min-width:4px}
.s-confirmed{background:var(--ink)}
.s-derived{background:var(--muted)}
.s-open{background:var(--accent)}
.counts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 20px}
.counts div{display:flex;flex-direction:column-reverse}
.counts dd{margin:0;font-size:34px;font-weight:500;letter-spacing:-0.02em;line-height:1.1;font-variant-numeric:tabular-nums}
.counts dt{font-size:13px;color:var(--muted)}
.meta{font-size:13px;color:var(--muted)}
.meta b{font-weight:500;color:var(--ink);margin-right:6px}
.meta.warn{margin-top:8px;color:var(--ink);font-weight:500}
.para{max-width:52em}
.para-big{font-size:26px;line-height:1.35;letter-spacing:-0.01em;max-width:30em}
.para .v{vertical-align:2px;margin-left:6px}
.para .src{display:inline;margin-left:8px}
.sec{font-size:19px;font-weight:500;letter-spacing:-0.01em;margin:0 0 12px}
.facts+.sec,.items+.sec,.para+.sec,.rules+.sec{margin-top:34px}
.sec+.para{margin-top:0}
.facts+.items,.items+.facts,.facts+.para,.items+.para,.items+.items,.para+.facts,.para+.items{margin-top:18px}
.items{list-style:none;margin:0;padding:0}
.items li{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:10px 0;border-bottom:1px solid var(--line);font-size:15px;line-height:1.4}
.items li>span:first-child{min-width:0;overflow-wrap:anywhere}
.items .tag{flex:none;width:36%;min-width:150px}
.items .src{display:inline;margin:0 0 0 8px}
.rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:stretch}
.rule ul{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:14px;font-size:14.5px;line-height:1.4}
.rule li{display:grid;gap:2px}
.rule li b{font-size:12px;font-weight:500;color:var(--muted)}
.rule .v{margin-top:8px;justify-self:start}
.rule .src{margin-top:4px}
.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 56px;align-items:start}
.h3{font-size:14px;font-weight:600;margin-bottom:12px}
.h3-gap{margin-top:28px}
.list{margin:0;padding-left:20px;display:grid;gap:8px;overflow-wrap:anywhere}
.pills{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pills li{background:var(--soft);border-radius:999px;padding:4px 12px;font-size:13px}
.sw{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}
.sw-item{display:grid;gap:2px;font-size:13px}
.sw-item i{display:block;height:96px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--line);margin-bottom:8px}
.sw-item b{font-weight:500}
.sw-item span{color:var(--muted);font-variant-numeric:tabular-nums}
.pics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 16px}
.pic{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.pic-im{height:126px;background:var(--soft);display:flex;align-items:center;justify-content:center}
.pic-im img{max-width:100%;max-height:126px;object-fit:contain;display:block}
.pic-no .pic-im img{opacity:.45;filter:grayscale(1)}
.pic figcaption{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:start;padding:10px 12px;font-size:13px;line-height:1.35;border-top:1px solid var(--line);flex:1}
.pic-n{font-weight:600;font-variant-numeric:tabular-nums}
.pic-t{overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pic .v{grid-column:2;justify-self:start;font-size:12px;padding:2px 10px}
.look{margin-top:36px}
.aa{font-size:56px;font-weight:500;letter-spacing:-0.03em;line-height:1.1;margin-bottom:10px}
.logo-s{max-height:56px;max-width:240px}
@media (max-width:1311px){
.slide{padding:32px 24px 20px;min-height:0}
h1{font-size:clamp(40px,10vw,96px)}
h2{font-size:clamp(26px,5vw,38px)}
.cover{min-height:560px}
.stats{grid-template-columns:repeat(2,1fr)}
.stats dd{font-size:30px}
}
@media (max-width:860px){
.cols,.status,.rules{grid-template-columns:1fr;gap:16px}
.sw{grid-template-columns:repeat(3,minmax(0,1fr))}
.pics{grid-template-columns:repeat(2,minmax(0,1fr))}
.body{overflow-x:auto}
table.facts{min-width:520px}
.items li{flex-direction:column;gap:6px}
.items .tag{width:auto}
.para-big{font-size:21px}
.foot span:nth-child(2){display:none}
}
@media print{
@page{size:1280px 800px;margin:0}
body{background:#fff}
.deck{width:1280px;margin:0;gap:0}
.slide{border-radius:0;break-after:page;break-inside:avoid;min-height:800px}
.cover,.v,.tile,.stack,.stack i,.pills li,.sw-item i,.pic-im,code{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(L.title)}: ${e(company)}</title>
${brand.fontUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${e(brand.fontUrl)}" rel="stylesheet">` : ""}
<style>${css}</style></head>
<body><main class="deck">
${cover}
${slides.join("\n")}
</main></body></html>
`;
const outFile = path.resolve(args.out ?? path.join(dir, "report.html"));
fs.writeFileSync(outFile, html);
console.log(`${outFile}: ${page} slides, ${(html.length / 1024).toFixed(0)} kB\n${path.join(dir, "report.md")}\n${path.join(dir, "status.json")}`);
