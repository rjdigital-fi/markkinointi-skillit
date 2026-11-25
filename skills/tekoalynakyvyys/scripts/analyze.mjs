#!/usr/bin/env node
// Reads brief.json and answers.json, writes result.json and prints the summary. Node 18+, no dependencies.
//   node analyze.mjs --dir <work folder>
// Run it again after you move names between "competitors" and "notCompanies" in brief.json.
import fs from "node:fs";
import path from "node:path";
import { analyze } from "./core.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? ".");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
for (const f of ["brief.json", "answers.json"])
  if (!fs.existsSync(path.join(dir, f))) {
    console.error(`${f} not found in ${dir}`);
    process.exit(1);
  }
const brief = read("brief.json");
const answers = read("answers.json");
const result = analyze(brief, answers);
result.sourcesOfData = [...new Set(answers.map((a) => a.source).filter(Boolean))];
fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));

const t = result.total;
console.log(`${result.company}: named in ${t.mentioned} of ${t.answers} answers (${t.share} %), own site cited in ${t.cited}`);
for (const e of result.engines) console.log(`  ${e.label}: named ${e.mentioned}/${e.answers}, cited ${e.cited}/${e.answers}`);
console.log("\nQuestions:");
for (const q of result.questions) console.log(`  ${q.mentioned}/${q.answers}  ${q.question}`);
console.log(`\nNamed instead (${result.competitors.length}): ${result.competitors.slice(0, 15).map((c) => `${c.name} ${c.answers}`).join(", ") || "none found"}`);
if (result.unconfirmed.length) console.log(`\nUnconfirmed names, found only as bold or heading text. Read the answers and move real companies to "competitors" and the rest to "notCompanies" in brief.json:\n  ${result.unconfirmed.map((c) => `${c.name} (${c.answers})`).join(", ")}`);
console.log(`\nTop sources: ${result.sources.slice(0, 10).map((s) => `${s.domain} ${s.answers}`).join(", ") || "none"}`);
if (t.answers < 10) console.log("\nNote: under 10 answers is a thin sample. Say so in the report and do not read small differences into it.");
console.log("\nwrote result.json");
