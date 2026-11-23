#!/usr/bin/env node
// Writes the exchange rate the report needs into groups.json, when the source's prices are in another currency
// than the report. Uses the European Central Bank's daily reference rates (free, no key). Node 18+, no dependencies.
// Sends nothing about the research: the request is a plain download of the public rate file.
//
//   node rate.mjs [--dir .] [--from USD] [--to EUR]
//
// --from defaults to "currency" in groups.json, --to to "report_currency" (EUR when not set).
// Result in groups.json: "rate": { "value": 0.9099, "date": "2026-11-20", "source": "Euroopan keskuspankki" }
// value = one unit of the source currency in the report currency.
import fs from "node:fs";
import path from "node:path";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const file = path.join(path.resolve(args.dir ?? "."), "groups.json");
if (!fs.existsSync(file)) {
  console.error("rate.mjs needs groups.json in " + path.dirname(file));
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const from = String(args.from ?? cfg.currency ?? "USD").toUpperCase();
const to = String(args.to ?? cfg.report_currency ?? "EUR").toUpperCase();
if (from === to) {
  delete cfg.rate;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`prices are already in ${to}: no rate needed`);
  process.exit(0);
}

const URL_ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
let xml;
try {
  const res = await fetch(URL_ECB, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  xml = await res.text();
} catch (err) {
  console.error(`could not fetch the ECB rates (${err.message}). Set "rate" in groups.json by hand, with its date and source, or the report keeps the prices in ${from}.`);
  process.exit(1);
}
// The file gives 1 EUR in each currency.
const perEur = { EUR: 1 };
for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) perEur[m[1]] = Number(m[2]);
const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1] ?? null;
if (!perEur[from] || !perEur[to]) {
  console.error(`the ECB file has no rate for ${!perEur[from] ? from : to}. Set "rate" in groups.json by hand, with its date and source.`);
  process.exit(1);
}
const value = Math.round((perEur[to] / perEur[from]) * 10000) / 10000;
cfg.report_currency = to;
cfg.rate = { value, date, source: (cfg.lang ?? "fi") === "en" ? "European Central Bank" : "Euroopan keskuspankki" };
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
console.log(`1 ${from} = ${value} ${to} (ECB reference rate ${date}), written to groups.json`);
