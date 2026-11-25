#!/usr/bin/env node
// Rough checks of the three things AI visibility is built on: can AI bots read the site, does the homepage
// say what is sold, and is the company on the outside pages the answers leaned on.
// Reads brief.json, answers.json and result.json, writes checks.json. Node 18+, no dependencies, no paid calls.
//   node site-check.mjs --dir <work folder>
// It fetches the company's robots.txt, homepage and sitemap.xml, and up to ten source pages from the answers.
// Run it after analyze.mjs, once the competitor list in brief.json is sorted.
import fs from "node:fs";
import path from "node:path";
import { domainOf } from "./core.mjs";
import { workChecks, topSourcePages } from "./checks.mjs";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? ".");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
for (const f of ["brief.json", "answers.json", "result.json"])
  if (!fs.existsSync(path.join(dir, f))) {
    console.error(`${f} not found in ${dir}${f === "result.json" ? ". Run analyze.mjs first." : ""}`);
    process.exit(1);
  }
const brief = read("brief.json");
const answers = read("answers.json");
const result = read("result.json");
const domain = domainOf(brief.domain);
if (!domain) {
  console.error('brief.json needs "domain", for example "example.fi"');
  process.exit(1);
}

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Page text, or null when the page cannot be read. `status` is 0 when nothing answered. */
async function get(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5", "accept-language": "fi,en;q=0.8" },
    });
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return { status: res.status, text: null };
    }
    const chunks = [];
    let size = 0;
    const reader = res.body.getReader();
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { status: res.status, text: Buffer.concat(chunks).toString("utf8") };
  } catch {
    return { status: 0, text: null }; // timeout, DNS or TLS failure: reported as "could not be checked"
  }
}

const rivals = result.competitors ?? [];
const names = [...new Set([...(brief.competitors ?? []), ...rivals.map((c) => c.name)])];
const guesses = (result.unconfirmed ?? []).map((c) => c.name);
const sources = topSourcePages(answers, domain, rivals.map((c) => c.domain).filter(Boolean), 10, [...names, ...guesses]);

const base = `https://${domain}`;
const [robots, homeFirst, sitemapFile, ...pages] = await Promise.all([get(`${base}/robots.txt`), get(`${base}/`), get(`${base}/sitemap.xml`), ...sources.map((s) => get(s.url))]);
const home = homeFirst.text == null && homeFirst.status === 0 ? await get(`https://www.${domain}/`) : homeFirst;

// A missing robots.txt (404) allows everything. Any other failure means the rules could not be read.
const robotsText = robots.text != null && !/^\s*</.test(robots.text) ? robots.text : robots.status === 404 || robots.text != null ? "" : null;
const listed = robotsText ? /^\s*sitemap\s*:/im.test(robotsText) : false;
const sitemap = listed || /<(urlset|sitemapindex)\b/i.test(sitemapFile.text ?? "") ? true : sitemapFile.status === 0 && robotsText == null ? null : false;

const work = workChecks(
  { company: brief.company, domain, sells: brief.sells ?? "", area: brief.area ?? "", competitors: names },
  { robots: robotsText, home: home.text, sitemap },
  sources.map((s, i) => ({ domain: s.domain, html: pages[i].text })),
);
const out = {
  date: new Date().toISOString().slice(0, 10),
  domain,
  ...work,
  pagesRead: sources.map((s, i) => ({ domain: s.domain, url: s.url, answers: s.answers, read: pages[i].text != null })),
};
fs.writeFileSync(path.join(dir, "checks.json"), JSON.stringify(out, null, 2));

const mark = (c) => (c.ok === true ? "ok " : c.ok === false ? "GAP" : " ? ");
for (const [key, title] of [["tech", "Technical base: can AI bots read the site"], ["content", "Content: does the homepage say what is sold, to whom and where"], ["mentions", "Mentions elsewhere: outside pages the answers leaned on"]]) {
  console.log(`\n${title}`);
  for (const c of work[key]) console.log(`  ${mark(c)} ${c.id}${c.detail ? ` (${c.detail})` : ""}`);
  if (!work[key].length) console.log("  none of the source pages that could be read names companies of this trade");
}
const unread = out.pagesRead.filter((p) => !p.read).length;
console.log(`\nread ${out.pagesRead.length - unread} of ${out.pagesRead.length} source pages${home.text == null ? ", the homepage could not be read" : ""}`);
if (!brief.sells) console.log('Note: brief.json has no "sells", so the homepage headings could not be compared with what the company sells.');
console.log("These are rough checks of the homepage, robots.txt and the source pages, not an audit of the whole site.\nwrote checks.json");
