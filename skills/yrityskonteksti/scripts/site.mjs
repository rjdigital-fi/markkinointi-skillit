#!/usr/bin/env node
// Reads a company's own website: the front page, the pages that say the most about the business, and the stylesheets.
// Writes raw/site.json with the texts, the colours and fonts in use and a first guess for brand.json. Node 18+, no dependencies.
//   node site.mjs --url https://example.com --dir <work folder> [--max 7]
// Only public pages are fetched, without logging in. Nothing is sent anywhere else.
import fs from "node:fs";
import path from "node:path";
import { htmlText, htmlMeta, htmlLinks, pickPages, stylesheetUrls, inlineCss, cssColors, cssFonts, suggestBrand, decode } from "./core.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
if (!args.url || args.url === "true") {
  console.error("Usage: node site.mjs --url https://example.com --dir <work folder> [--max 7]");
  process.exit(1);
}
const dir = path.resolve(args.dir ?? "yrityskonteksti");
const max = Math.max(0, Math.min(15, Number(args.max ?? 7) || 7));
const start = /^https?:\/\//i.test(args.url) ? args.url : `https://${args.url}`;
const UA = "yrityskonteksti-skill (+https://github.com/rjdigital-fi/markkinointi-skillit)";

async function get(url, limit = 1_500_000) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,text/css,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { url: res.url, text: (await res.text()).slice(0, limit) };
}

let home;
try {
  home = await get(start);
} catch (err) {
  console.error(`Could not read ${start}: ${err.message}\nIf the site blocks automated reading, save the text of the main pages to ${path.join(dir, "raw", "site.txt")} and continue from there.`);
  process.exit(1);
}

const page = (url, html) => ({ url, ...htmlMeta(html), text: htmlText(html).slice(0, 8000) });
const pages = [page(home.url, home.text)];
const failed = [];
for (const url of pickPages(htmlLinks(home.text, home.url), max)) {
  try {
    const p = await get(url);
    pages.push(page(p.url, p.text));
  } catch (err) {
    failed.push({ url, error: err.message });
  }
}

let css = inlineCss(home.text);
const sheets = stylesheetUrls(home.text, home.url).slice(0, 6);
for (const url of sheets) {
  try { css += "\n" + (await get(url)).text; } catch (err) { failed.push({ url, error: err.message }); }
}
// Colours written straight on elements count too (page builders do this a lot).
css += "\n" + [...home.text.matchAll(/style=["']([^"']+)["']/gi)].map((m) => m[1]).join(";\n");

const colors = cssColors(css).slice(0, 24);
const fonts = cssFonts(css).slice(0, 8);
const attr = (re) => { const m = home.text.match(re); if (!m) return ""; try { return new URL(decode(m[1]), home.url).href; } catch { return ""; } };
const logo = {
  image: attr(/<img\b[^>]*(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*?src=["']([^"']+)["']/i) || attr(/<img\b[^>]*src=["']([^"']*logo[^"']*)["']/i),
  icon: attr(/<link\b[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i),
  shareImage: attr(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i),
};
const name = (home.text.match(/<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "").trim();
const suggestion = suggestBrand(colors, fonts, decode(name));
suggestion.logo = logo.image;

const out = {
  url: home.url,
  read: new Date().toISOString().slice(0, 10),
  note: "Texts, colours and fonts as found on the public site. brandSuggestion is a guess from how often each colour is used: confirm every value with the owner.",
  pages,
  colors,
  fonts,
  logo,
  brandSuggestion: suggestion,
  failed,
};
fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
const file = path.join(dir, "raw", "site.json");
fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`${file}
pages read: ${pages.length}${failed.length ? ` (${failed.length} could not be read)` : ""}
${pages.map((p) => `  ${p.url}  ${p.text.split(/\s+/).length} words`).join("\n")}
colours: ${colors.slice(0, 8).map((c) => `${c.hex}×${c.count}`).join(" ") || "none found"}
fonts: ${fonts.map((f) => f.family).join(", ") || "none found"}
suggested accent: ${suggestion.colors.accent}`);
