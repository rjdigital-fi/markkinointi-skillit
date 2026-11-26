#!/usr/bin/env node
// Builds the image board: a numbered page of the company's own pictures, in the company's own look, so the owner
// can answer with numbers which pictures look like the company and which do not. Node 18+, no dependencies.
//   node images.mjs --dir <work folder> [--url https://example.com] [--folder path/to/pictures] [--max 18] [--lang fi|en]
//   node images.mjs --dir <work folder> --board                       rebuild the board after editing raw/images.json
//   node images.mjs --dir <work folder> --good 3,5 --no 1,2 --unsure 4   record the owner's answer
// Pictures come from the pages listed in raw/site.json (or --url) and from an optional local folder.
// Near-identical pictures are shown once, icons, logos and badges are left off, and a large set is sampled.
// Only public pages are fetched, without logging in. Nothing is sent anywhere else.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { htmlImages, htmlLinks, pickPages, imageSize, imageStem, skipReason, groupImages, sampleGroups, parseNumbers, COLOR_KEYS } from "./core.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const has = (k) => args[k] !== undefined && args[k] !== "true";
const dir = path.resolve(args.dir ?? "yrityskonteksti");
const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const jsonFile = path.join(dir, "raw", "images.json");
const imgDir = path.join(dir, "raw", "images");
const UA = "yrityskonteksti-skill (+https://github.com/rjdigital-fi/markkinointi-skillit)";
const MAX_BYTES = 12_000_000;
const MAX_FILES = 120;

const english = ["company.md", "audience.md", "brand.md"].some((f) => fs.existsSync(path.join(dir, f)));
const lang = args.lang === "en" || args.lang === "fi" ? args.lang : english ? "en" : "fi";
const L = {
  fi: {
    file: "kuvataulu.html", kicker: "Brändi ja ääni · kuvat", title: "Mitkä näistä kuvista ovat teidän näköisiänne?",
    lead: "Vastatkaa numeroilla kolmena listana: hyvät, ei käytetä ja en osaa sanoa. Perusteluja ei tarvita. Kuvasääntö kirjoitetaan valinnoistanne.",
    answer: "Esimerkki vastauksesta", answerText: "Hyvät: 2, 5, 6. Ei käytetä: 1, 4. En osaa sanoa: 3.",
    pages: (n) => (n === 1 ? "Käytössä yhdellä luetulla sivulla" : `Käytössä ${n} luetulla sivulla`), folder: "Omasta kansiosta",
    versions: (n) => `${n} lähes samanlaista versiota`, board: "kuvataulu",
    shown: (a, b) => `Taululla on ${a} kuvaa ${b} löydetystä. Lähes samanlaiset kuvat näytetään kerran.`,
    left: (n) => `${n} kuvaa jäi otoksen ulkopuolelle.`, dropped: (n) => `${n} kuvaketta, logoa ja muuta pientä kuvaa jätettiin pois.`,
  },
  en: {
    file: "image-board.html", kicker: "Brand and voice · pictures", title: "Which of these pictures look like you?",
    lead: "Answer with numbers in three lists: good, not used and cannot say. No reasons needed. The picture rule is written from your choices.",
    answer: "An example answer", answerText: "Good: 2, 5, 6. Not used: 1, 4. Cannot say: 3.",
    pages: (n) => (n === 1 ? "Used on one of the pages read" : `Used on ${n} of the pages read`), folder: "From your own folder",
    versions: (n) => `${n} near-identical versions`, board: "image board",
    shown: (a, b) => `The board shows ${a} of the ${b} pictures found. Near-identical pictures are shown once.`,
    left: (n) => `${n} pictures were left out of the sample.`, dropped: (n) => `${n} icons, logos and other small pictures were left out.`,
  },
}[lang];

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function writeBoard(data) {
  const base = readJson(path.join(here, "..", "brand.json")) ?? {};
  const brand = readJson(path.join(dir, "brand.json")) ?? base;
  const col = { paper: "#ffffff", soft: "#f3f3f3", ink: "#141414", muted: "#6b6b6b", line: "#e2e2e2", accent: "#ff5a1f", night: "#000000", ...(brand.colors ?? {}) };
  for (const k of COLOR_KEYS) if (!/^#[0-9a-f]{6}$/i.test(col[k] ?? "")) col[k] = { paper: "#ffffff", soft: "#f3f3f3", ink: "#141414", muted: "#6b6b6b", line: "#e2e2e2", accent: "#ff5a1f", night: "#000000" }[k];
  const font = brand.font || "Hanken Grotesk";
  const shown = data.groups.filter((g) => g.show !== false);
  const total = data.groups.length + (data.left?.length ?? 0);
  const note = (g) => [g.note, g.pages?.length ? L.pages(g.pages.length) : g.folder ? L.folder : "", g.versions?.length > 1 ? L.versions(g.versions.length) : ""].filter(Boolean).join(". ");
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(L.title)}</title>
${brand.fontUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${e(brand.fontUrl)}" rel="stylesheet">` : ""}
<style>
:root{--paper:${col.paper};--soft:${col.soft};--ink:${col.ink};--muted:${col.muted};--line:${col.line};--accent:${col.accent};color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 "${font}","Helvetica Neue",Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1280px;margin:0 auto;padding:48px 24px 56px}
.kicker{margin:0;color:var(--muted);font-size:14px;font-weight:500}
h1{font-weight:500;font-size:clamp(28px,4.4vw,38px);line-height:1.15;letter-spacing:-0.02em;margin:10px 0 12px;max-width:20em}
.lead{color:var(--muted);max-width:44em;margin:0}
.how{margin:20px 0 32px;background:var(--soft);border-radius:14px;padding:14px 18px;font-size:15px;max-width:44em}
.how b{font-weight:600;margin-right:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
figure{margin:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;break-inside:avoid}
.im{height:250px;display:flex;align-items:center;justify-content:center;background:var(--soft)}
.im img{max-width:100%;max-height:250px;object-fit:contain;display:block}
figcaption{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;font-size:14px;line-height:1.4;flex:1;border-top:1px solid var(--line)}
.n{flex:none;width:32px;height:32px;border-radius:50%;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;font-variant-numeric:tabular-nums}
.t{min-width:0;overflow-wrap:anywhere}
.t b{font-weight:600;display:block}
.t span{color:var(--muted)}
footer{margin-top:32px;border-top:1px solid var(--line);padding-top:14px;color:var(--muted);font-size:13px;display:flex;flex-wrap:wrap;gap:4px 24px;justify-content:space-between}
@media print{main{padding:24px}.im,.n,.how{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body><main>
<p class="kicker">${e(L.kicker)}</p>
<h1>${e(L.title)}</h1>
<p class="lead">${e(L.lead)}</p>
<p class="how"><b>${e(L.answer)}</b>${e(L.answerText)}</p>
<div class="grid">
${shown.map((g) => `<figure><div class="im"><img src="${e(g.file)}" alt="" loading="lazy"></div><figcaption><div class="n">${g.n}</div><div class="t"><b>${e(g.label)}</b><span>${e(note(g))}</span></div></figcaption></figure>`).join("\n")}
</div>
<footer><span>${e([data.company || brand.name || "", L.board, showDate(data.read ?? "")].filter(Boolean).join(" · "))}</span><span>${e([L.shown(shown.length, total), data.left?.length ? L.left(data.left.length) : "", data.dropped?.length ? L.dropped(data.dropped.length) : ""].filter(Boolean).join(" "))}</span></footer>
</main></body></html>
`;
  const file = path.join(dir, L.file);
  fs.writeFileSync(file, html);
  return file;
}
const short = (t) => (t.length <= 70 ? t : `${t.slice(0, 70).replace(/\s+\S*$/, "")}…`);
const showDate = (d) => (lang === "fi" ? d.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$3.$2.$1") : d);
const save = (data) => fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2) + "\n");

// ---------- record the owner's answer ----------
if (has("good") || has("no") || has("unsure")) {
  const data = readJson(jsonFile);
  if (!data) { console.error(`No ${jsonFile}. Build the board first.`); process.exit(1); }
  const shown = data.groups.filter((g) => g.show !== false);
  const lists = { good: parseNumbers(args.good), no: parseNumbers(args.no), unsure: parseNumbers(args.unsure) };
  const seen = new Map();
  const problems = [];
  for (const [verdict, nums] of Object.entries(lists))
    for (const n of nums) {
      if (!shown.some((g) => g.n === n)) problems.push(`${n} is not on the board`);
      else if (seen.has(n)) problems.push(`${n} is in two lists (${seen.get(n)} and ${verdict})`);
      else seen.set(n, verdict);
    }
  if (problems.length) { console.error(`Nothing was saved:\n  ${problems.join("\n  ")}`); process.exit(1); }
  for (const g of shown) if (seen.has(g.n)) g.verdict = seen.get(g.n);
  data.answered = new Date().toISOString().slice(0, 10);
  save(data);
  const of = (v) => shown.filter((g) => g.verdict === v);
  const line = (g) => `  ${g.n}  ${g.label}  (${g.file})`;
  const unlisted = shown.filter((g) => !g.verdict);
  console.log([
    jsonFile,
    `good ${of("good").length} · not used ${of("no").length} · cannot say ${of("unsure").length}`,
    ...["good", "no", "unsure"].flatMap((v) => (of(v).length ? [`\n${v}:`, ...of(v).map(line)] : [])),
    unlisted.length ? `\nNot in any list: ${unlisted.map((g) => g.n).join(", ")}. Ask about these separately. A picture the owner did not mention is not approved and not rejected.` : "\nEvery picture on the board has an answer.",
  ].join("\n"));
  process.exit(0);
}

// ---------- rebuild the board from raw/images.json ----------
if (args.board) {
  const data = readJson(jsonFile);
  if (!data) { console.error(`No ${jsonFile}. Run without --board first.`); process.exit(1); }
  // Numbers stay as they are once the owner has answered with them.
  if (!data.groups.some((g) => g.verdict)) { let n = 0; for (const g of data.groups) g.n = g.show === false ? 0 : ++n; }
  save(data);
  console.log(`${writeBoard(data)}\npictures on the board: ${data.groups.filter((g) => g.show !== false).length}`);
  process.exit(0);
}

// ---------- collect ----------
const site = readJson(path.join(dir, "raw", "site.json"));
const start = has("url") ? (/^https?:\/\//i.test(args.url) ? args.url : `https://${args.url}`) : site?.url;
const folder = has("folder") ? path.resolve(args.folder) : "";
if (!start && !folder) {
  console.error("Usage: node images.mjs --dir <work folder> [--url https://example.com] [--folder path/to/pictures] [--max 18]\nGive --url or --folder, or run site.mjs first so that raw/site.json exists.");
  process.exit(1);
}
if (folder && !fs.existsSync(folder)) { console.error(`Folder not found: ${folder}`); process.exit(1); }
const max = Math.max(4, Math.min(40, Number(args.max ?? 18) || 18));

async function get(url, binary) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: binary ? "image/avif,image/webp,image/*,*/*;q=0.8" : "text/html,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!binary) return { url: res.url, text: (await res.text()).slice(0, 1_500_000) };
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("file over 12 MB");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("file over 12 MB");
  return buf;
}
async function pool(list, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => { while (i < list.length) { const item = list[i++]; await fn(item); } }));
}

const failed = [];
const found = new Map(); // address or path -> { src, alt, zone, pages: Set, from }
const pagesRead = [];
if (start) {
  let pageUrls = (site?.pages ?? []).map((p) => p.url);
  if (has("url") || !pageUrls.length) {
    try {
      const home = await get(start);
      pageUrls = [home.url, ...pickPages(htmlLinks(home.text, home.url), 7)];
    } catch (err) {
      console.error(`Could not read ${start}: ${err.message}\nIf the site blocks automated reading, save the pictures into a folder and give it with --folder.`);
      if (!folder) process.exit(1);
      pageUrls = [];
    }
  }
  for (const url of [...new Set(pageUrls)]) {
    try {
      const p = await get(url);
      pagesRead.push(p.url);
      for (const img of htmlImages(p.text, p.url)) {
        // Share images are often one generated title card per page: the first page's card is enough.
        if (img.zone === "share" && pagesRead.length > 1 && !found.has(img.src)) continue;
        const old = found.get(img.src);
        if (old) { old.pages.add(p.url); if (img.zone === "content") old.zone = "content"; if (!old.alt) old.alt = img.alt; }
        else found.set(img.src, { ...img, pages: new Set([p.url]), from: p.url });
      }
    } catch (err) {
      failed.push({ url, error: err.message });
    }
  }
}
const items = [];
const web = [...found.values()].slice(0, MAX_FILES);
await pool(web, 6, async (img) => {
  try {
    const buf = await get(img.src, true);
    items.push({ ...img, buf });
  } catch (err) {
    failed.push({ url: img.src, error: err.message });
  }
});
// Keep the order the pages show the pictures in, whatever order the downloads finished in.
items.sort((a, b) => web.indexOf(found.get(a.src)) - web.indexOf(found.get(b.src)));
if (folder) {
  const walk = (d, depth = 0) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((f) => (f.name.startsWith(".") ? [] : f.isDirectory() ? (depth < 3 ? walk(path.join(d, f.name), depth + 1) : []) : /\.(jpe?g|png|webp|avif|gif)$/i.test(f.name) ? [path.join(d, f.name)] : []));
  for (const file of walk(folder).slice(0, MAX_FILES)) {
    if (fs.statSync(file).size > MAX_BYTES) { failed.push({ url: file, error: "file over 12 MB" }); continue; }
    // Named from the folder down: the full path of the user's machine does not belong in a file that may be shared.
    const src = [path.basename(folder), ...path.relative(folder, file).split(path.sep)].join("/");
    items.push({ src, alt: "", zone: "content", pages: new Set(), from: "folder", folder: true, buf: fs.readFileSync(file) });
  }
}

const dropped = [];
const kept = [];
for (const it of items) {
  const size = imageSize(it.buf) ?? { type: "", width: 0, height: 0 };
  Object.assign(it, size, { stem: imageStem(it.src), hash: crypto.createHash("sha1").update(it.buf).digest("hex") });
  const reason = skipReason(it);
  if (reason) dropped.push({ src: it.src, reason });
  else kept.push(it);
}
const { shown, left } = sampleGroups(groupImages(kept), max);

fs.rmSync(imgDir, { recursive: true, force: true });
fs.mkdirSync(imgDir, { recursive: true });
const ext = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif", gif: "gif" };
const names = new Set();
const record = (g, n) => {
  const r = g.rep;
  let name = `${r.stem.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "kuva"}.${ext[r.type]}`;
  for (let i = 2; names.has(name); i++) name = name.replace(/(-\d+)?\.(\w+)$/, `-${i}.$2`);
  names.add(name);
  fs.writeFileSync(path.join(imgDir, name), r.buf);
  const pages = [...new Set(g.items.flatMap((x) => [...x.pages]))];
  return {
    n,
    file: `raw/images/${name}`,
    label: short(g.items.find((x) => x.alt)?.alt ?? "") || r.stem,
    note: "",
    width: r.width,
    height: r.height,
    pages,
    ...(g.items.some((x) => x.folder) ? { folder: true } : {}),
    versions: g.items.map((x) => x.src),
    verdict: "",
  };
};
const data = {
  read: new Date().toISOString().slice(0, 10),
  company: readJson(path.join(dir, "brand.json"))?.name ?? "",
  note: "label and note are yours to rewrite after looking at each picture. Set \"show\": false on a picture that does not belong on the board (another company's material, a stock photo placeholder), move one from left to groups to swap it in, then run images.mjs --board. verdict is good, no or unsure and is written with --good, --no and --unsure.",
  source: { url: start ?? "", pages: pagesRead, folder: folder ? path.basename(folder) : "" },
  groups: shown.map((g, i) => record(g, i + 1)),
  left: left.map((g) => record(g, 0)),
  dropped,
  failed,
};
save(data);
const board = writeBoard(data);
const reasons = Object.entries(dropped.reduce((a, d) => ({ ...a, [d.reason]: (a[d.reason] ?? 0) + 1 }), {}));
console.log(`${board}
${jsonFile}
pages read: ${pagesRead.length}${folder ? ` · folder: ${path.basename(folder)}` : ""}
pictures found: ${items.length} · different pictures: ${shown.length + left.length} · on the board: ${shown.length}${left.length ? ` · left out of the sample: ${left.length}` : ""}
left off as not brand pictures: ${dropped.length}${reasons.length ? `\n${reasons.map(([r, n]) => `  ${n} × ${r}`).join("\n")}` : ""}${failed.length ? `\ncould not be read: ${failed.length}` : ""}
${data.groups.map((g) => `  ${String(g.n).padStart(2)}  ${g.file}  ${g.width}×${g.height}${g.versions.length > 1 ? `  (${g.versions.length} versions)` : ""}`).join("\n")}
Look at every picture on the board before showing it to the owner, and rewrite the labels in ${path.basename(jsonFile)}.`);
