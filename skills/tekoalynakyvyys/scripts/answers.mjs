#!/usr/bin/env node
// Brings one AI answer from ANY tool into answers.json. Node 18+, no dependencies.
// Save the tool's answer (MCP, API or export) as a JSON file as it came, or the plain answer text as .txt or .md, and run:
//
//   node answers.mjs --file answer.json --question "the question" --engine chatgpt [--run 1] [--dir .]
//
// Engines: chatgpt, gemini, aimode, perplexity, claude, copilot, or any other name.
// The fields are found by name wherever they sit in the JSON, so the answer shapes of DataForSEO, Cloro, SerpApi,
// SearchApi, HasData and AI visibility tools all work. Always read the printed summary: it shows what was
// found, and a 0 means the tool names that part differently (add it by hand to answers.json then).
import fs from "node:fs";
import path from "node:path";
import { normalizeAnswer, engineLabel } from "./core.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
if (!args.file || !args.question || !args.engine) {
  console.error('Usage: node answers.mjs --file answer.json --question "..." --engine chatgpt [--run 1] [--dir .]');
  process.exit(1);
}
const dir = path.resolve(args.dir ?? ".");
const norm = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").trim().toLowerCase();
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const urlOf = (o) => [o.url, o.link, o.href, o.source_url, o.sourceUrl, o.uri].find((u) => typeof u === "string" && /^https?:\/\//.test(u));
const titleOf = (o) => [o.title, o.name, o.source_title, o.label].find((t) => typeof t === "string" && t.trim()) ?? "";
const textOf = (v) => (typeof v === "string" ? v : isObj(v) ? [v.markdown, v.name, v.title, v.query, v.keyword, v.text].find((t) => typeof t === "string" && t.trim()) : null);
function collect(j, test, out = [], depth = 0) {
  if (depth > 12 || !j || typeof j !== "object") return out;
  if (Array.isArray(j)) for (const x of j) collect(x, test, out, depth + 1);
  else
    for (const [k, v] of Object.entries(j)) {
      if (test(norm(k), v)) out.push(v);
      collect(v, test, out, depth + 1);
    }
  return out;
}
const strings = (v) => (Array.isArray(v) ? v.map(textOf).filter(Boolean) : typeof v === "string" ? [v] : []);

const raw = fs.readFileSync(args.file, "utf8").replace(/^﻿/, "");
let entry;
if (/\.(txt|md)$/i.test(args.file)) {
  // Plain text: the answer as copied from the app. Links in the text become the sources.
  const urls = [...new Set([...raw.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((m) => m[0].replace(/[.,;]+$/, "")))];
  entry = { text: raw, sources: urls.map((url) => ({ url })), searches: [], brands: [] };
} else {
  const json = JSON.parse(raw);
  const searches = collect(json, (k, v) => /fan ?out|search quer|^queries$|web search(es)?$|^searches$|search terms/.test(k) && (Array.isArray(v) || typeof v === "string")).flatMap(strings);
  const urlsUnder = (pattern) => {
    const found = [];
    for (const list of collect(json, (k, v) => pattern.test(k) && Array.isArray(v)))
      for (const item of list) {
        const u = typeof item === "string" ? (/^https?:\/\//.test(item) ? item : null) : isObj(item) ? urlOf(item) : null;
        if (u && !found.some((s) => s.url === u)) found.push({ url: u, title: isObj(item) ? titleOf(item) : "" });
      }
    return found;
  };
  let sources = urlsUnder(/source|citation|reference|annotation/);
  if (!sources.length) sources = urlsUnder(/^links?$|search results?$|^results$|organic/);
  const brands = collect(json, (k, v) => /brand|mention|^entities$|compan/.test(k) && Array.isArray(v)).flatMap(strings);
  const texts = collect(json, (k, v) => /^(text|answer|markdown|response|content|output|message|result)$/.test(k) && typeof v === "string");
  entry = { text: texts.sort((a, b) => b.length - a.length)[0] ?? "", sources, searches, brands };
}
const answer = { ...normalizeAnswer({ ...entry, question: args.question, engine: args.engine, run: args.run }), date: args.date ?? new Date().toISOString().slice(0, 10), ...(args.source ? { source: args.source } : {}) };
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "answers.json");
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
const i = all.findIndex((a) => a.question === answer.question && a.engine === answer.engine && (a.run ?? 1) === answer.run);
if (i > -1) all[i] = answer;
else all.push(answer);
fs.writeFileSync(file, JSON.stringify(all, null, 2));
console.log(`${engineLabel(answer.engine)}, run ${answer.run}\nanswer: ${answer.text.length} characters\nsources: ${answer.sources.length}${answer.sources.length ? ` (${[...new Set(answer.sources.map((s) => s.domain))].slice(0, 6).join(", ")})` : ""}\nsearches: ${answer.searches.length}\nbrands: ${answer.brands.length}\nanswers.json now has ${all.length} answers`);
