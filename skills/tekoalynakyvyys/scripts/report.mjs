#!/usr/bin/env node
// Builds report.html (slides) and report.md from result.json. Node 18+, no dependencies.
//   node report.mjs --dir <work folder> [--lang fi|en] [--note "..."] [--brand "NAME"] [--icons off|ai] [--out report.html]
// One self-contained HTML file with no scripts. Opens in any browser and prints to PDF one slide per page.
// The look (name, colours, font, logo) comes from brand.json: the one in the work folder, else the one in the skill folder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const next = rest[i + 1];
  args[rest[i].slice(2)] = next !== undefined && !next.startsWith("--") ? rest[++i] : "true";
}
const dir = path.resolve(args.dir ?? ".");
const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
if (!fs.existsSync(path.join(dir, "result.json"))) {
  console.error("result.json not found. Run analyze.mjs first.");
  process.exit(1);
}
const r = readJson(path.join(dir, "result.json"));
const brief = fs.existsSync(path.join(dir, "brief.json")) ? readJson(path.join(dir, "brief.json")) : {};
const brandFile = [path.join(dir, "brand.json"), path.join(here, "..", "brand.json")].find((f) => fs.existsSync(f));
const brand = brandFile ? readJson(brandFile) : {};
const col = { paper: "#ffffff", soft: "#f3f3f3", ink: "#141414", muted: "#6b6b6b", line: "#e2e2e2", accent: "#ff5a1f", night: "#000000", ...(brand.colors ?? {}) };
const font = brand.font || "Hanken Grotesk";
const lang = (args.lang ?? brief.lang ?? "fi") === "en" ? "en" : "fi";
// Site icons of companies, sources and AIs come from Google's favicon service when the report is opened.
// "icons": false in brand.json or --icons off leaves them out, "icons": "ai" or --icons ai keeps only the icons of the AIs
// (for made-up companies). A name without a known site gets its first letter.
const icons = args.icons === "off" || args.icons === "ai" ? args.icons : brand.icons === false ? "off" : brand.icons === "ai" ? "ai" : "all";
const ENGINE_SITE = { chatgpt: "chatgpt.com", gemini: "gemini.google.com", aimode: "google.com", aioverview: "google.com", perplexity: "perplexity.ai", copilot: "copilot.microsoft.com", claude: "claude.ai" };
const brandName = args.brand && args.brand !== "true" ? args.brand : brand.name ?? "";

const L = {
  fi: {
    title: "Tekoälynäkyvyyden kartoitus", credit: brand.credit?.fi ?? "", date: "Tehty", data: "Data", runs: (n) => (n > 1 ? `${n} ajoa per kysymys` : "1 ajo per kysymys"),
    sNamed: "vastauksessa yritys mainittiin", sShare: "vastauksista mainitsi yrityksen", sCited: "vastauksessa oma sivusto oli lähteenä", sInstead: "muuta yritystä mainittiin",
    of: "/", matrix: "Kysymykset ja tekoälyt", matrixTitle: (c) => `Missä vastauksissa ${c} mainitaan`, matrixSub: (n) => `Jokainen kysymys kysyttiin jokaiselta tekoälyltä${n > 1 ? ` ${n} kertaa` : ""}. Ruutu kertoo, monessako vastauksessa yritys mainittiin nimeltä.`,
    question: "Kysymys", yes: "Mainittu", some: "Osassa", no: "Ei mainittu", none: "Ei vastausta", cited: "sivusto lähteenä",
    eng: "Tekoälyt", engTitle: "Näkyvyys tekoälyittäin", engSub: "Mainittu = yrityksen nimi on vastauksen tekstissä. Lähteenä = tekoäly nojasi yrityksen omaan sivustoon.", named: "Mainittu", asSource: "Lähteenä",
    comp: "Kuka mainitaan", compTitle: "Yritykset, jotka tekoäly nimeää näihin kysymyksiin", compSub: "Luku kertoo, monessako vastauksessa yritys mainittiin. Oma yritys on korostettu.", company: "Yritys", answers: "Vastauksia", share: "Osuus", ais: "Tekoälyt", you: "oma yritys", compNone: "Vastauksista ei löytynyt muita nimettyjä yrityksiä.",
    src: "Lähteet", srcTitle: "Sivustot, joihin tekoäly nojaa", srcSub: "Tekoäly hakee vastauksensa näiltä sivustoilta. Listalla näkyy myös, onko oma sivusto mukana.", site: "Sivusto", own: "oma sivusto", ownPages: "Omat sivut, joihin tekoäly viittasi", ownNone: "Oma sivusto ei ollut lähteenä yhdessäkään vastauksessa.", srcNone: "Vastauksissa ei ollut lähteitä.",
    quotes: "Mitä tekoäly sanoo", quotesTitle: (c) => `Näin tekoäly kuvaa yritystä ${c}`, quotesSub: "Otteet ovat suoraan vastauksista. Tarkistakaa, että tiedot pitävät paikkansa.",
    method: "Menetelmä", methodTitle: "Näin kartoitus tehtiin", asked: "Kysytyt kysymykset", searches: "Hakuja, joita tekoäly teki vastatakseen", read: "Näin luette tuloksen",
    work: "Kolme työaluetta", workTitle: "Mistä tulos syntyy", workSub: (c) => `Näkyvyys tekoälyn vastauksissa rakentuu kolmesta asiasta. Jokaisesta katsottiin pikaisesti, missä ${c} on nyt.`,
    workSmall: "Suuntaa antava pikatarkistus: se katsoo etusivun, robots.txt-tiedoston ja vastausten lähdesivut. Lähteistä ovat mukana vain ulkopuoliset sivut, joilla mainitaan alan yrityksiä. Kilpailijoiden omat sivut on jätetty pois. Koko sivustoa tarkistus ei käy läpi.",
    level: { ok: "Kunnossa", some: "Parannettavaa", gap: "Selvä puute", none: "Ei voitu tarkistaa" }, inOrder: "kunnossa", gaps: "Kehityskohteet", job: "Mitä työ on", mentionsNone: "Luetuista lähdesivuista yksikään ei mainitse alan yrityksiä, joten tätä ei voitu arvioida.",
    areas: {
      tech: ["Tekninen pohja", "Pääseekö tekoäly lukemaan sivustoanne?", "Varmistetaan, että tekoälyn botit pääsevät jokaiselle tärkeälle sivulle ja saavat tekstin luettavaksi."],
      content: ["Sisältö ja jäsentely", "Kertooko sivusto selvästi, mitä myytte, kenelle ja missä?", "Tehdään sivut, jotka vastaavat ostajan kysymyksiin suoraan, ja jäsennetään ne niin, että vastauksen voi poimia."],
      mentions: ["Maininnat muualla", "Oletteko niillä ulkopuolisilla sivuilla, joihin vastaukset nojaavat?", "Hankitaan maininnat niihin vertailuihin, listoihin ja medioihin, joita tekoäly käyttää lähteenä."],
    },
    checks: {
      "bots-chatgpt": ["ChatGPT:n hakubotit saavat lukea sivuston", "ChatGPT:n hakubotteja on estetty robots.txt-tiedostossa", "ChatGPT:n bottien sääntöjä ei voitu lukea"],
      "bots-google": ["Googlen botit saavat lukea sivuston", "Googlen botteja on estetty robots.txt-tiedostossa", "Googlen bottien sääntöjä ei voitu lukea"],
      "bots-others": ["Perplexityn, Clauden ja Bingin botit saavat lukea sivuston", "Perplexityn, Clauden tai Bingin botteja on estetty robots.txt-tiedostossa", "Muiden tekoälybottien sääntöjä ei voitu lukea"],
      text: ["Etusivun teksti on luettavissa ilman JavaScriptiä", "Etusivulla on hyvin vähän tekstiä ilman JavaScriptiä", "Etusivua ei voitu lukea"],
      sitemap: ["Sivukartta löytyy", "Sivukarttaa ei löytynyt", "Sivukarttaa ei voitu tarkistaa"],
      service: ["Etusivun otsikot kertovat, mitä myytte", "Etusivun otsikoissa ei näy sanoja, joilla palvelu on kuvattu", "Etusivun otsikoita ei voitu verrata palvelun kuvaukseen"],
      area: ["Toiminta-alue ({x}) mainitaan etusivulla", "Toiminta-aluetta ({x}) ei mainita etusivulla", "Toiminta-aluetta ei voitu tarkistaa"],
      prices: ["Hinnat tai linkki hinnastoon löytyy etusivulta", "Hintoja tai linkkiä hinnastoon ei löytynyt etusivulta", "Hintoja ei voitu tarkistaa"],
      faq: ["Usein kysytyt kysymykset löytyvät etusivulta", "Usein kysyttyjä kysymyksiä ei löytynyt etusivulta", "Usein kysyttyjä kysymyksiä ei voitu tarkistaa"],
      schema: ["Yritystiedoilla on rakenteinen merkintä", "Yritystiedoilta puuttuu rakenteinen merkintä", "Rakenteista merkintää ei voitu tarkistaa"],
      source: ["{x}: yrityksenne mainitaan", "{x}: teitä ei mainita", "{x}: sivua ei voitu lukea"],
    },
    notes: (n, runs) => [
      "Tekoälyn vastaus vaihtelee kerrasta toiseen. Tämä kartoitus on tilannekuva yhdeltä päivältä.",
      runs > 1 ? "Jokainen kysymys kysyttiin useaan kertaan, ja ruudussa näkyy, monessako vastauksessa yritys mainittiin." : "Jokainen kysymys kysyttiin kerran. Toistakaa ajo, ennen kuin teette tuloksesta isoja päätöksiä.",
      n < 20 ? "Otos on pieni. Alle kymmenen prosenttiyksikön erot ovat todennäköisesti satunnaisvaihtelua." : "Alle kymmenen prosenttiyksikön muutokset kahden ajon välillä ovat todennäköisesti satunnaisvaihtelua.",
      "Pitäkää kysymykset samoina ja ajakaa kartoitus uudelleen noin kerran kuussa, niin näette suunnan.",
      "Maininta lasketaan nimestä vastauksen tekstissä. Pelkkä linkki ei ole maininta, se lasketaan lähteeksi.",
    ],
  },
  en: {
    title: "AI visibility check", credit: brand.credit?.en ?? "", date: "Built", data: "Data", runs: (n) => (n > 1 ? `${n} runs per question` : "1 run per question"),
    sNamed: "answers named the company", sShare: "of answers named the company", sCited: "answers cited the company's site", sInstead: "other companies were named",
    of: "/", matrix: "Questions and AIs", matrixTitle: (c) => `Which answers name ${c}`, matrixSub: (n) => `Each question was asked from each AI${n > 1 ? ` ${n} times` : ""}. A cell shows in how many answers the company was named.`,
    question: "Question", yes: "Named", some: "Sometimes", no: "Not named", none: "No answer", cited: "site cited",
    eng: "AIs", engTitle: "Visibility by AI", engSub: "Named = the company name is in the answer text. Cited = the AI relied on the company's own site.", named: "Named", asSource: "Cited",
    comp: "Who is named", compTitle: "Companies the AIs name for these questions", compSub: "The number is the count of answers that named the company. Your company is highlighted.", company: "Company", answers: "Answers", share: "Share", ais: "AIs", you: "your company", compNone: "No other named companies were found in the answers.",
    src: "Sources", srcTitle: "Sites the AIs rely on", srcSub: "The AIs build their answers from these sites. The list also shows whether your own site is among them.", site: "Site", own: "your site", ownPages: "Your pages the AIs cited", ownNone: "Your site was not a source in any answer.", srcNone: "The answers had no sources.",
    quotes: "What the AIs say", quotesTitle: (c) => `How the AIs describe ${c}`, quotesSub: "The excerpts are straight from the answers. Check that the facts are right.",
    method: "Method", methodTitle: "How the check was done", asked: "Questions asked", searches: "Searches the AIs ran to answer", read: "How to read the result",
    work: "Three areas of work", workTitle: "Where the result comes from", workSub: (c) => `Visibility in AI answers is built on three things. Each got a quick look at where ${c} is now.`,
    workSmall: "A rough check: it looks at the homepage, robots.txt and the source pages of the answers. Of the sources, only outside pages that name companies of the trade are included. Competitors' own sites are left out. It does not go through the whole site.",
    level: { ok: "In order", some: "Room to improve", gap: "Clear gap", none: "Could not be checked" }, inOrder: "in order", gaps: "To develop", job: "What the work is", mentionsNone: "None of the source pages that could be read names companies of the trade, so this could not be assessed.",
    areas: {
      tech: ["Technical base", "Can the AIs read your site?", "Making sure AI bots reach every important page and get the text to read."],
      content: ["Content and structure", "Does the site say clearly what you sell, to whom and where?", "Building pages that answer the buyer's questions directly, structured so that the answer can be picked up."],
      mentions: ["Mentions elsewhere", "Are you on the outside pages the answers lean on?", "Earning mentions in the comparisons, lists and media the AIs use as sources."],
    },
    checks: {
      "bots-chatgpt": ["ChatGPT's search bots may read the site", "ChatGPT's search bots are blocked in robots.txt", "The rules for ChatGPT's bots could not be read"],
      "bots-google": ["Google's bots may read the site", "Google's bots are blocked in robots.txt", "The rules for Google's bots could not be read"],
      "bots-others": ["The bots of Perplexity, Claude and Bing may read the site", "Bots of Perplexity, Claude or Bing are blocked in robots.txt", "The rules for other AI bots could not be read"],
      text: ["The homepage text can be read without JavaScript", "The homepage has very little text without JavaScript", "The homepage could not be read"],
      sitemap: ["A sitemap was found", "No sitemap was found", "The sitemap could not be checked"],
      service: ["The homepage headings say what you sell", "The homepage headings do not use the words that describe the service", "The homepage headings could not be compared with the service description"],
      area: ["The service area ({x}) is on the homepage", "The service area ({x}) is not on the homepage", "The service area could not be checked"],
      prices: ["Prices or a link to pricing are on the homepage", "No prices or link to pricing on the homepage", "Prices could not be checked"],
      faq: ["Frequently asked questions are on the homepage", "No frequently asked questions on the homepage", "Frequently asked questions could not be checked"],
      schema: ["Company details have structured data", "Company details lack structured data", "Structured data could not be checked"],
      source: ["{x}: your company is named", "{x}: you are not named", "{x}: the page could not be read"],
    },
    notes: (n, runs) => [
      "AI answers vary from one run to the next. This check is a snapshot of one day.",
      runs > 1 ? "Each question was asked several times, and a cell shows in how many answers the company was named." : "Each question was asked once. Repeat the run before making big decisions on the result.",
      n < 20 ? "The sample is small. Differences under ten percentage points are likely noise." : "Changes under ten percentage points between two runs are likely noise.",
      "Keep the questions the same and rerun the check about once a month to see the direction.",
      "A mention is the name in the answer text. A bare link is not a mention; it counts as a source.",
    ],
  },
}[lang];

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const loc = lang === "en" ? "en-GB" : "fi-FI";
const dateText = new Date(r.date ?? Date.now()).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" });
const t = r.total;
const engLabel = Object.fromEntries(r.engines.map((x) => [x.id, x.label]));
const dataSources = (r.sourcesOfData ?? []).join(", ");

// checks.json is optional: site-check.mjs writes it. Without it the report has no "work" section.
const checksFile = path.join(dir, "checks.json");
const work = fs.existsSync(checksFile) ? readJson(checksFile) : null;
const workAreas = work
  ? ["tech", "content", "mentions"].map((key, i) => {
      const list = (work[key] ?? []).filter((c) => L.checks[c.id]);
      const text = (c) => L.checks[c.id][c.ok === true ? 0 : c.ok === false ? 1 : 2].replace("{x}", c.detail ?? "");
      const gaps = list.filter((c) => c.ok === false).map(text);
      const oks = list.filter((c) => c.ok === true).map(text);
      const unknown = list.filter((c) => c.ok == null).map(text);
      const known = gaps.length + oks.length;
      const level = !known ? "none" : !gaps.length ? "ok" : gaps.length / known >= 0.5 ? "gap" : "some";
      const [title, question, job] = L.areas[key];
      return { key, n: i + 1, title, question, job, gaps, oks, unknown, known, level };
    })
  : [];

// ---------- report.md ----------
const cellMd = (c) => (c.verdict === "none" ? "–" : `${c.verdict === "yes" ? L.yes : c.verdict === "sometimes" ? L.some : L.no} ${c.mentioned}/${c.answers}`);
const md = [
  `# ${L.title}: ${r.company}`,
  "",
  `${L.date} ${dateText} · ${L.runs(r.runs)}${dataSources ? ` · ${L.data}: ${dataSources}` : ""}`,
  "",
  `- **${t.mentioned} / ${t.answers}** ${L.sNamed} (${t.share} %)`,
  `- **${t.cited} / ${t.answers}** ${L.sCited}`,
  `- **${r.competitors.length}** ${L.sInstead}`,
  "",
  `## ${L.matrixTitle(r.company)}`,
  "",
  `| ${L.question} | ${r.engines.map((x) => x.label).join(" | ")} |`,
  `| --- | ${r.engines.map(() => "---").join(" | ")} |`,
  ...r.questions.map((q) => `| ${q.question.replace(/\|/g, "/")} | ${r.engines.map((x) => cellMd(q.cells[x.id])).join(" | ")} |`),
  "",
  `## ${L.engTitle}`,
  "",
  `| ${L.ais} | ${L.named} | ${L.asSource} |`,
  "| --- | --- | --- |",
  ...r.engines.map((x) => `| ${x.label} | ${x.mentioned}/${x.answers} | ${x.cited}/${x.answers} |`),
  "",
  `## ${L.compTitle}`,
  "",
  ...(r.competitors.length
    ? [`| ${L.company} | ${L.answers} | ${L.share} | ${L.ais} |`, "| --- | --- | --- | --- |", `| **${r.company}** (${L.you}) | ${t.mentioned} | ${t.share} % | ${r.engines.filter((x) => x.mentioned).map((x) => x.label).join(", ") || "–"} |`, ...r.competitors.slice(0, 20).map((c) => `| ${c.name} | ${c.answers} | ${c.share} % | ${Object.keys(c.engines).map((k) => engLabel[k] ?? k).join(", ")} |`)]
    : [L.compNone]),
  "",
  `## ${L.srcTitle}`,
  "",
  ...(r.sources.length ? [`| ${L.site} | ${L.answers} | ${L.share} |`, "| --- | --- | --- |", ...r.sources.slice(0, 20).map((s) => `| ${s.domain}${s.own ? ` (${L.own})` : ""} | ${s.answers} | ${s.share} % |`)] : [L.srcNone]),
  "",
  r.ownPages.length ? `**${L.ownPages}:**\n\n${r.ownPages.map((u) => `- ${u}`).join("\n")}` : L.ownNone,
  "",
  ...(r.quotes.length ? [`## ${L.quotesTitle(r.company)}`, "", ...r.quotes.slice(0, 8).map((q) => `> ${q.quote}\n>\n> ${engLabel[q.engine] ?? q.engine} · ${q.question}\n`)] : []),
  ...(work
    ? [
        `## ${L.workTitle}`,
        "",
        L.workSub(r.company),
        "",
        ...workAreas.flatMap((a) => [
          `### ${a.n}. ${a.title}: ${L.level[a.level]}`,
          "",
          `${a.question}${a.known ? ` **${a.oks.length} / ${a.known}** ${L.inOrder}.` : ""}`,
          "",
          ...a.gaps.map((x) => `- → ${x}`),
          ...a.oks.map((x) => `- ✓ ${x}`),
          ...a.unknown.map((x) => `- ? ${x}`),
          ...(a.key === "mentions" && !a.known && !a.unknown.length ? [L.mentionsNone] : []),
          "",
          `**${L.job}:** ${a.job}`,
          "",
        ]),
        `_${L.workSmall}_`,
        "",
      ]
    : []),
  `## ${L.methodTitle}`,
  "",
  `**${L.asked}:**`,
  "",
  ...r.questions.map((q, i) => `${i + 1}. ${q.question}`),
  "",
  ...L.notes(t.answers, r.runs).map((x) => `- ${x}`),
  "",
  L.credit ? `_${L.credit}_` : "",
].join("\n");
fs.writeFileSync(path.join(dir, "report.md"), md.replace(/\n{3,}/g, "\n\n") + "\n");

// ---------- report.html ----------
const ico = (domain, name, ai = false) =>
  domain && (icons === "all" || (icons === "ai" && ai))
    ? `<img class="ico" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&amp;sz=64" alt="" width="20" height="20" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="ico ico-l" aria-hidden="true">${e(String(name).trim().charAt(0).toUpperCase())}</span>`;
const eng = (id, label) => `<span class="eng">${ico(ENGINE_SITE[id], label, true)}${e(label)}</span>`;
let page = 1;
const slides = [];
const slide = (kicker, title, sub, body) => {
  page++;
  slides.push(`<section class="slide"><p class="kicker">${e(kicker)}</p><h2>${e(title)}</h2>${sub ? `<p class="sub">${e(sub)}</p>` : ""}<div class="body">${body}</div><footer class="foot"><span>${e(L.title)}: ${e(r.company)}</span><span>${e(L.credit)}</span><span>${page}</span></footer></section>`);
};
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// 1. Matrix
const cell = (c) => {
  if (!c || c.verdict === "none") return `<td class="cell"><span class="v v-none">${L.none}</span></td>`;
  const word = c.verdict === "yes" ? L.yes : c.verdict === "sometimes" ? L.some : L.no;
  return `<td class="cell"><span class="v v-${c.verdict}">${word}</span><small>${c.mentioned} ${L.of} ${c.answers}${c.cited ? ` · ${L.cited}` : ""}</small></td>`;
};
for (const part of chunk(r.questions, 6))
  slide(L.matrix, L.matrixTitle(r.company), L.matrixSub(r.runs), `<table class="matrix"><thead><tr><th>${L.question}</th>${r.engines.map((x) => `<th>${eng(x.id, x.label)}</th>`).join("")}</tr></thead><tbody>${part.map((q) => `<tr><td class="q">${e(q.question)}</td>${r.engines.map((x) => cell(q.cells[x.id])).join("")}</tr>`).join("")}</tbody></table>`);

// 2. By engine
const bar = (part, whole, cls = "") => `<div class="bar ${cls}"><i style="width:${whole ? Math.max((100 * part) / whole, part ? 2 : 0) : 0}%"></i></div>`;
slide(
  L.eng,
  L.engTitle,
  L.engSub,
  `<div class="engines">${r.engines
    .map(
      (x) => `<section class="tile"><h3>${eng(x.id, x.label)}</h3>
<p class="big">${x.mentioned}<span> ${L.of} ${x.answers}</span></p><p class="lab">${L.named}</p>${bar(x.mentioned, x.answers)}
<p class="big big-s">${x.cited}<span> ${L.of} ${x.answers}</span></p><p class="lab">${L.asSource}</p>${bar(x.cited, x.answers, "bar-soft")}</section>`,
    )
    .join("")}</div>`,
);

// 3. Who is named
const own = { name: r.company, domain: r.domain, answers: t.mentioned, share: t.share, engines: Object.fromEntries(r.engines.filter((x) => x.mentioned).map((x) => [x.id, x.mentioned])), own: true };
const board = [...r.competitors.slice(0, 13), own].sort((a, b) => b.answers - a.answers || (a.own ? -1 : 1));
const top = Math.max(1, ...board.map((c) => c.answers));
slide(
  L.comp,
  L.compTitle,
  L.compSub,
  r.competitors.length
    ? `<table class="board"><thead><tr><th>${L.company}</th><th></th><th class="num">${L.answers}</th><th class="num">${L.share}</th><th>${L.ais}</th></tr></thead><tbody>${board
        .map((c) => `<tr${c.own ? ' class="own"' : ""}><td>${ico(c.domain, c.name)}${e(c.name)}${c.own ? ` <em>${L.you}</em>` : ""}</td><td class="barcell">${bar(c.answers, top)}</td><td class="num">${c.answers}</td><td class="num">${c.share} %</td><td class="path">${Object.keys(c.engines).map((k) => eng(k, engLabel[k] ?? k)).join(" ") || "–"}</td></tr>`)
        .join("")}</tbody></table>`
    : `<p class="note">${L.compNone}</p>`,
);

// 4. Sources
const srcTop = Math.max(1, ...r.sources.map((s) => s.answers));
const srcRows = [...r.sources.slice(0, 12)];
const ownSrc = r.sources.find((s) => s.own);
if (ownSrc && !srcRows.includes(ownSrc)) srcRows.push(ownSrc);
slide(
  L.src,
  L.srcTitle,
  L.srcSub,
  r.sources.length
    ? `<div class="cols"><div><table class="board"><thead><tr><th>${L.site}</th><th></th><th class="num">${L.answers}</th><th class="num">${L.share}</th></tr></thead><tbody>${srcRows.map((s) => `<tr${s.own ? ' class="own"' : ""}><td>${ico(s.domain, s.domain)}${e(s.domain)}${s.own ? ` <em>${L.own}</em>` : ""}</td><td class="barcell">${bar(s.answers, srcTop)}</td><td class="num">${s.answers}</td><td class="num">${s.share} %</td></tr>`).join("")}</tbody></table></div>
<div><h3 class="h3">${L.ownPages}</h3>${r.ownPages.length ? `<ul class="list">${r.ownPages.slice(0, 10).map((u) => `<li>${e(u.replace(/^https?:\/\/(www\.)?/, ""))}</li>`).join("")}</ul>` : `<p class="note">${L.ownNone}</p>`}</div></div>`
    : `<p class="note">${L.srcNone}</p>`,
);

// 5. Quotes
if (r.quotes.length)
  slide(L.quotes, L.quotesTitle(r.company), L.quotesSub, `<div class="quotes">${r.quotes.slice(0, 4).map((q) => `<blockquote><p>${e(q.quote)}</p><footer>${eng(q.engine, engLabel[q.engine] ?? q.engine)} · ${e(q.question)}</footer></blockquote>`).join("")}</div>`);

// 6. Where the result comes from (only when site-check.mjs has been run)
if (work) {
  const rows = (list, sign, cls) => list.map((x) => `<li class="${cls}"><b aria-hidden="true">${sign}</b><span>${e(x)}</span></li>`).join("");
  slide(
    L.work,
    L.workTitle,
    L.workSub(r.company),
    `<div class="work">${workAreas
      .map(
        (a) => `<section class="tile work-card"><div class="work-top"><span class="work-num">${a.n}</span><h3>${e(a.title)}</h3><span class="v lv-${a.level}">${L.level[a.level]}</span></div>
<p class="work-q">${e(a.question)}</p>
${a.known ? `<div class="meter"><span class="meter-bar">${Array.from({ length: a.known }, (_, i) => `<i${i < a.oks.length ? ' class="on"' : ""}></i>`).join("")}</span><span class="meter-num"><b>${a.oks.length}</b> ${L.of} ${a.known} ${L.inOrder}</span></div>` : ""}
${a.gaps.length ? `<p class="work-label">${L.gaps}</p>` : ""}<ul class="checks">${rows(a.gaps, "→", "is-gap")}${rows(a.oks, "✓", "is-ok")}${rows(a.unknown, "?", "is-unknown")}</ul>
${a.key === "mentions" && !a.known && !a.unknown.length ? `<p class="work-none">${L.mentionsNone}</p>` : ""}
<p class="work-job"><b>${L.job}:</b>${e(a.job)}</p></section>`,
      )
      .join("")}</div><p class="work-small">${e(L.workSmall)}</p>`,
  );
}

// 7. Method
slide(
  L.method,
  L.methodTitle,
  "",
  `<div class="cols"><div><h3 class="h3">${L.asked}</h3><ol class="list">${r.questions.map((q) => `<li>${e(q.question)}</li>`).join("")}</ol>${r.searches.length ? `<h3 class="h3 h3-gap">${L.searches}</h3><ul class="pills">${r.searches.slice(0, 14).map((s) => `<li>${e(s)}</li>`).join("")}</ul>` : ""}</div>
<div><h3 class="h3">${L.read}</h3><ul class="list">${L.notes(t.answers, r.runs).map((x) => `<li>${e(x)}</li>`).join("")}</ul></div></div>`,
);

const logo = brand.logo ? `<img class="logo" src="${e(brand.logo)}" alt="${e(brandName)}">` : brandName ? `<p class="brand">${e(brandName)}</p>` : "";
const cover = `<section class="slide cover">${logo}<div class="cover-main"><p class="kicker">${L.title}</p><h1>${e(r.company)}</h1>
<dl class="stats"><div><dt>${L.sNamed}</dt><dd>${t.mentioned}<span> ${L.of} ${t.answers}</span></dd></div><div><dt>${L.sShare}</dt><dd>${t.share} %</dd></div><div><dt>${L.sCited}</dt><dd>${t.cited}<span> ${L.of} ${t.answers}</span></dd></div><div><dt>${L.sInstead}</dt><dd>${r.competitors.length}</dd></div></dl></div>
<div class="cover-meta"><p><b>${L.ais}</b> ${r.engines.map((x) => e(x.label)).join(", ")}</p><p><b>${L.date}</b> ${dateText}</p><p>${L.runs(r.runs)}</p>${dataSources ? `<p><b>${L.data}</b> ${e(dataSources)}</p>` : ""}${args.note && args.note !== "true" ? `<p class="cover-note">${e(args.note)}</p>` : ""}</div></section>`;

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
.sub{margin-top:12px;color:var(--muted);max-width:52em}
.body{margin-top:32px;flex:1;min-width:0}
.foot{margin-top:28px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;font-size:12px;color:var(--muted)}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.note{font-size:15px;color:var(--muted);max-width:40em}
.cover{background:var(--night) radial-gradient(900px circle at 100% 0%,rgba(255,255,255,.13),transparent 60%);color:#fff;padding-bottom:48px}
.brand{font-size:14px;font-weight:600;letter-spacing:.32em}
.logo{height:36px;width:auto;align-self:flex-start}
.ico{display:inline-block;width:20px;height:20px;border-radius:5px;vertical-align:-4px;margin-right:10px;object-fit:contain;background:#fff}
.ico-l{background:var(--soft);color:var(--muted);font-size:11px;font-weight:600;line-height:20px;text-align:center}
.eng{display:inline-flex;align-items:center;white-space:nowrap;margin-right:12px}
.eng .ico{margin-right:6px;vertical-align:0}
blockquote footer .eng{vertical-align:-4px;margin-right:0}
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
table{width:100%;border-collapse:collapse;font-size:15px;line-height:1.35}
th{text-align:left;font-size:12px;font-weight:500;color:var(--muted);padding:0 12px 8px 0;border-bottom:1px solid var(--ink)}
td{padding:10px 12px 10px 0;border-bottom:1px solid var(--line);vertical-align:middle}
td small{display:block;font-size:12px;color:var(--muted);margin-top:3px}
.matrix .q{width:42%;font-weight:500}
.v{display:inline-block;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:500;white-space:nowrap}
.v-yes{background:var(--ink);color:var(--paper)}
.v-sometimes{box-shadow:inset 0 0 0 1.5px var(--ink)}
.v-no{background:var(--soft);color:var(--muted)}
.v-none{color:var(--muted);padding-left:0}
.engines{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
.tile{background:var(--soft);border-radius:14px;padding:24px}
.tile h3{font-size:16px;font-weight:600;margin-bottom:18px}
.big{font-size:56px;font-weight:500;letter-spacing:-0.03em;line-height:1}
.big span{font-size:22px;color:var(--muted);letter-spacing:0}
.big-s{font-size:32px;margin-top:22px}
.lab{font-size:13px;color:var(--muted);margin:4px 0 8px}
.bar{height:8px;border-radius:999px;background:var(--line);overflow:hidden;min-width:60px}
.bar i{display:block;height:100%;border-radius:999px;background:var(--ink)}
.bar-soft i{background:var(--muted)}
.board .barcell{width:34%}
.board tr.own td{font-weight:600}
.board tr.own .bar i{background:var(--accent)}
.board em{font-style:normal;font-weight:500;font-size:12px;color:var(--muted);margin-left:6px}
.path{color:var(--muted);font-size:13px}
.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 56px;align-items:start}
.h3{font-size:14px;font-weight:600;margin-bottom:12px}
.h3-gap{margin-top:28px}
.list{margin:0;padding-left:20px;display:grid;gap:8px;overflow-wrap:anywhere}
.pills{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pills li{background:var(--soft);border-radius:999px;padding:4px 12px;font-size:13px}
.quotes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
blockquote{margin:0;background:var(--soft);border-radius:14px;padding:22px 24px}
blockquote p{font-size:17px;line-height:1.45}
blockquote footer{margin-top:12px;font-size:12px;color:var(--muted)}
.work{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:stretch}
.work-card{display:flex;flex-direction:column;padding:20px 22px}
.work-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:8px}
.work-top .v{margin-left:auto}
.work-num{flex:none;width:28px;height:28px;border-radius:999px;background:var(--paper);font-size:13px;font-weight:600;line-height:28px;text-align:center}
.lv-ok{background:var(--ink);color:var(--paper)}
.lv-some{box-shadow:inset 0 0 0 1.5px var(--ink)}
.lv-gap{box-shadow:inset 0 0 0 1.5px var(--accent);background:var(--paper)}
.lv-none{background:var(--line);color:var(--muted)}
.work-card h3{font-size:19px;font-weight:500;letter-spacing:-0.01em;margin:0}
.work-q{font-size:14px;color:var(--muted)}
.meter{display:flex;align-items:center;gap:12px;margin-top:12px}
.meter-bar{display:flex;gap:4px;flex:1}
.meter-bar i{flex:1;height:6px;border-radius:999px;background:var(--line)}
.meter-bar i.on{background:var(--ink)}
.meter-num{font-size:13px;color:var(--muted);white-space:nowrap}
.meter-num b{color:var(--ink);font-weight:600}
.work-label{margin-top:12px;font-size:12px;font-weight:600}
.checks{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:5px;font-size:13.5px;line-height:1.35}
.checks li{display:flex;gap:8px;overflow-wrap:anywhere;min-width:0}
.checks span{min-width:0}
.checks b{flex:none;width:16px;font-weight:600}
.checks .is-gap b{color:var(--accent)}
.checks .is-ok,.checks .is-unknown{color:var(--muted)}
.work-none{font-size:14px;color:var(--muted)}
.work-job{margin-top:auto;padding-top:14px;font-size:13px;line-height:1.4}
.work-job b{font-weight:600;margin-right:6px}
.work-small{margin-top:12px;font-size:12px;color:var(--muted);max-width:90em}
@media (max-width:1311px){
.slide{padding:32px 24px 20px;min-height:0}
h1{font-size:clamp(40px,10vw,96px)}
h2{font-size:clamp(26px,5vw,38px)}
.cover{min-height:560px}
.stats{grid-template-columns:repeat(2,1fr)}
.stats dd{font-size:30px}
}
@media (max-width:860px){
.cols,.quotes,.work{grid-template-columns:1fr;gap:28px}
.work{gap:16px}
.body{overflow-x:auto}
.matrix{min-width:560px}
.foot span:nth-child(2){display:none}
}
@media print{
@page{size:1280px 800px;margin:0}
body{background:#fff}
.deck{width:1280px;margin:0;gap:0}
.slide{border-radius:0;break-after:page;break-inside:avoid;min-height:800px}
.cover,.v,.tile,.bar,.bar i,.pills li,blockquote,.meter-bar i,.work-num{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L.title}: ${e(r.company)}</title>
${brand.fontUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${e(brand.fontUrl)}" rel="stylesheet">` : ""}
<style>${css}</style></head>
<body><main class="deck">
${cover}
${slides.join("\n")}
</main></body></html>
`;
const outFile = path.resolve(args.out ?? path.join(dir, "report.html"));
fs.writeFileSync(outFile, html);
console.log(`${outFile}: ${page} slides, ${(html.length / 1024).toFixed(0)} kB\n${path.join(dir, "report.md")}`);
