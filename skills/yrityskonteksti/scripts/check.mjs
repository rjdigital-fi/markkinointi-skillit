#!/usr/bin/env node
// Checks the three context files and brand.json and writes status.json. Node 18+, no dependencies.
//   node check.mjs --dir <work folder> [--strict] [--today 2026-01-31]
// It counts what is confirmed, derived and open, and finds what breaks the format: a fact without a marker,
// a marker without a source, a missing section, a voice rule without a real example, a file without an owner.
// Open items are not errors: they are the questions still to ask. --strict exits with 1 when the format is broken.
import fs from "node:fs";
import path from "node:path";
import { SLOTS, REVIEW_DAYS, readContextFile, checkBrand } from "./core.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? "yrityskonteksti");
const today = args.today && args.today !== "true" ? new Date(args.today) : new Date();

export function checkFolder(dir, today = new Date()) {
  const files = SLOTS.map((slot) => {
    const name = slot.names.find((n) => fs.existsSync(path.join(dir, n)));
    if (!name) return { key: slot.key, file: slot.names[0], state: "missing", confirmed: 0, derived: 0, open: 0, openItems: [], problems: [`file missing: ${slot.names.join(" or ")}`] };
    const r = readContextFile(name, fs.readFileSync(path.join(dir, name), "utf8"), today);
    const problems = [];
    for (const [re, label] of slot.need) if (!r.sections.some((h) => re.test(h))) problems.push(`section missing: ${label}`);
    for (const u of r.unmarked) problems.push(`no marker (${u.section}): ${u.text}`);
    for (const u of r.noSource) problems.push(`marker without a source (${u.section}): ${u.text}`);
    for (const v of r.voiceProblems) problems.push(`voice rule "${v.rule}" lacks: ${v.missing.join(", ")}`);
    if (!r.owner) problems.push("owner missing in the header of the file");
    const notes = [];
    if (r.ageDays === null) notes.push("not reviewed by the owner yet");
    else if (r.ageDays > REVIEW_DAYS) notes.push(`reviewed ${r.ageDays} days ago: ask the owner to read it again`);
    const state = problems.length ? "fix" : r.open || r.ageDays === null || r.ageDays > REVIEW_DAYS ? "draft" : "ready";
    return { key: slot.key, file: name, state, title: r.title, company: r.company, owner: r.owner, reviewed: r.reviewed, ageDays: r.ageDays, confirmed: r.confirmed, derived: r.derived, open: r.open, openItems: r.openItems, problems, notes };
  });
  const brandFile = path.join(dir, "brand.json");
  let brand = { state: "missing", problems: ["brand.json missing"] };
  if (fs.existsSync(brandFile)) {
    try {
      const p = checkBrand(JSON.parse(fs.readFileSync(brandFile, "utf8")));
      brand = { state: p.length ? "fix" : "ready", problems: p };
    } catch (err) {
      brand = { state: "fix", problems: [`brand.json is not valid JSON: ${err.message}`] };
    }
  }
  const sum = (k) => files.reduce((a, f) => a + f[k], 0);
  return { checked: today.toISOString().slice(0, 10), company: files.find((f) => f.company)?.company ?? "", totals: { confirmed: sum("confirmed"), derived: sum("derived"), open: sum("open"), ready: files.filter((f) => f.state === "ready").length, files: files.length }, files, brand };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  if (!fs.existsSync(dir)) { console.error(`Folder not found: ${dir}`); process.exit(1); }
  const s = checkFolder(dir, today);
  fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(s, null, 2) + "\n");
  const word = { ready: "ready", draft: "draft", fix: "needs fixing", missing: "missing" };
  const lines = [`${path.join(dir, "status.json")}`, `confirmed ${s.totals.confirmed} · derived ${s.totals.derived} · open ${s.totals.open} · files ready ${s.totals.ready}/${s.totals.files}`];
  for (const f of s.files) {
    lines.push(`\n${f.file}: ${word[f.state]} (confirmed ${f.confirmed}, derived ${f.derived}, open ${f.open})`);
    for (const p of f.problems) lines.push(`  fix: ${p}`);
    for (const n of f.notes ?? []) lines.push(`  note: ${n}`);
    for (const o of f.openItems.slice(0, 12)) lines.push(`  open: ${o.section}: ${o.text || "(empty)"}`);
    if (f.openItems.length > 12) lines.push(`  … and ${f.openItems.length - 12} more open items`);
  }
  lines.push(`\nbrand.json: ${word[s.brand.state]}`);
  for (const p of s.brand.problems) lines.push(`  fix: ${p}`);
  console.log(lines.join("\n"));
  const broken = s.files.some((f) => f.state === "fix" || f.state === "missing") || s.brand.state !== "ready";
  if (args.strict && broken) process.exit(1);
}
