#!/usr/bin/env node
// Reads the company's own writing from files on this computer and counts how it is written.
// Writes raw/texts.json (the texts) and raw/voice-stats.json (the numbers). Node 18+, no dependencies.
//   node texts.mjs --dir <work folder> <file> [<file> ...] [--min 80] [--last 60]
// A .csv file is read as a table with one text per row: LinkedIn's own data export (Shares.csv) works as it is.
// Any other file is read as plain text; separate several texts with a line of three dashes (---).
// Nothing is fetched from the web and nothing leaves this computer.
import fs from "node:fs";
import path from "node:path";
import { textsFromCsv, textsFromPlain, voiceStats } from "./core.mjs";

const rest = process.argv.slice(2);
const args = {};
const files = [];
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) { files.push(rest[i]); continue; }
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
if (!files.length) {
  console.error("Usage: node texts.mjs --dir <work folder> <file> [<file> ...] [--min 80] [--last 60]");
  process.exit(1);
}
const dir = path.resolve(args.dir ?? "yrityskonteksti");
const min = Number(args.min ?? 80) || 0; // shorter texts say little about the voice (a reshare with two words)
const last = Number(args.last ?? 60) || 60; // newest texts first; older writing may be in an older voice

let texts = [];
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
  const raw = fs.readFileSync(f, "utf8");
  const source = path.basename(f);
  texts.push(...(/\.csv$/i.test(f) ? textsFromCsv(raw, source) : textsFromPlain(raw, source)));
}
const all = texts.length;
texts = texts.filter((t) => t.text.length >= min);
texts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
texts = texts.slice(0, last);
if (!texts.length) {
  console.error(`No texts of at least ${min} characters found in ${files.join(", ")}.`);
  process.exit(1);
}
const stats = voiceStats(texts);
fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
fs.writeFileSync(path.join(dir, "raw", "texts.json"), JSON.stringify({ files: files.map((f) => path.basename(f)), found: all, used: texts.length, minLength: min, texts }, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "raw", "voice-stats.json"), JSON.stringify({ note: "Numbers describe the texts; they are not rules. Write the voice rules by reading the texts in texts.json, and quote real sentences as examples.", ...stats }, null, 2) + "\n");
console.log(`${path.join(dir, "raw", "texts.json")}
${path.join(dir, "raw", "voice-stats.json")}
texts: ${texts.length} used of ${all} found
words per text: median ${stats.wordsPerText.median} (${stats.wordsPerText.shortest}–${stats.wordsPerText.longest})
words per sentence: median ${stats.wordsPerSentence.median}, most between ${stats.wordsPerSentence.short} and ${stats.wordsPerSentence.long}
questions: ${stats.questionShare} % of sentences, exclamations: ${stats.exclamationShare} %
emoji per text: ${stats.emojiPerText}, hashtags per text: ${stats.hashtagsPerText}, texts with a list: ${stats.textsWithList} %
most used words: ${stats.words.slice(0, 12).map((w) => w.text).join(", ")}`);
