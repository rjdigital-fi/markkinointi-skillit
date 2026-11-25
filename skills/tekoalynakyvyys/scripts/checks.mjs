// Rough checks behind "Mistä tulos syntyy": can AI bots read the site, does the homepage say what is sold,
// and is the company on the pages the answers leaned on. Pure functions, no Node imports and no network,
// so the site and the free skill can share this file. Every check is indicative, never a full audit.
import { domainOf, nameForms, nameRegex } from "./core.mjs";

// Bots that fetch pages for answers (not the training crawlers, which a site may block on purpose).
// Names checked against each vendor's own crawler documentation on 2026-11-25.
export const BOTS = {
  chatgpt: ["OAI-SearchBot", "ChatGPT-User"],
  google: ["Googlebot", "Google-Extended"],
  others: ["PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User", "bingbot"],
};

/** May this user agent fetch this path, by the robots.txt text? Longest matching rule wins, allow wins a tie. */
export function robotsAllows(txt, agent, path = "/") {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(txt ?? "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow")) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const name = agent.toLowerCase();
  const own = groups.filter((g) => g.agents.includes(name));
  const rules = (own.length ? own : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best = { allow: true, len: -1 };
  for (const r of rules) {
    if (!r.path) continue; // "Disallow:" with nothing after it allows everything
    const re = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (!re.test(path)) continue;
    if (r.path.length > best.len || (r.path.length === best.len && r.allow)) best = { allow: r.allow, len: r.path.length };
  }
  return best.allow;
}

const decode = (s) =>
  String(s ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&euro;/g, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&[a-z]+;/g, " ");
const strip = (html) => decode(String(html ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** What a page says without JavaScript: title, description, headings, visible text, link texts and JSON-LD types. */
export function pageFacts(html) {
  const src = String(html ?? "");
  const body = src.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ");
  const meta = (name) => {
    const tag = src.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"))?.[0] ?? "";
    return decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "");
  };
  const types = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const t of [].concat(node["@type"] ?? [])) types.add(String(t));
    Object.values(node).forEach(walk);
  };
  for (const m of src.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      for (const t of m[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.add(t[1]);
    }
  }
  return {
    title: strip(src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: meta("description") || meta("og:description"),
    h1: [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean),
    text: strip(body),
    links: [...body.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => `${m[1]} ${strip(m[2])}`).join(" \n"),
    types: [...types],
  };
}

const STOP = /^(ja|tai|sekä|että|myös|kuin|sekä|yritys|yrityks|yritykset|yrityksille|palvelu|palvelut|palvelua|suomi|suomen|suomessa|koko|muu|muut|alue|alueella|seutu|and|the|for|services|service)$/;
// Finnish towns whose stem changes when inflected.
const TOWNS = { turku: "tur(ku|u)", lahti: "lah(ti|de)", helsinki: "helsin", pori: "pori", kemi: "kemi", oulu: "oulu", lappi: "lap(pi|i)" };

/** Word stems of a free-text description, loose enough to match Finnish case endings. */
export function stems(value) {
  const out = [];
  for (const w of String(value ?? "").toLowerCase().split(/[^a-zà-öø-ÿ0-9]+/u)) {
    if (STOP.test(w)) continue;
    if (TOWNS[w]) out.push(TOWNS[w]);
    else if (w.length >= 4) out.push(w.slice(0, Math.min(8, Math.max(4, Math.ceil(w.length * 0.6)))));
  }
  return [...new Set(out)];
}
const hasStem = (text, list) => list.some((s) => new RegExp(`(^|[^a-zà-öø-ÿ])${s}`, "iu").test(text));

const PRICE = /\d\s?(€|eur\b|e\/kk|euroa)|€\s?\d|\balv\b/i;
const PRICE_LINK = /hinna|hinta|hinno|pricing|price/i;
const FAQ = /usein kysyt|\bukk\b|\bfaq\b|kysymyksiä ja vastauksia|frequently asked/i;
const ORG = /Organization|Business|Corporation|Service$|Store$|School$|Agent$|Agency$|Restaurant|Dentist|Physician|Attorney/;
const NATIONWIDE = /^$|koko\s+(suomi|maa)|valtakunnalli|suomi$|finland|verkossa|online/i;

/**
 * site: { robots: string|null, home: string|null, sitemap: boolean|null }  (null = could not be fetched)
 * brief: { company, domain, sells, area }
 * pages: [{ domain, html: string|null }]  the third-party pages the answers leaned on most
 * brief.competitors: names of other companies the answers named. A source page counts as a place where
 * a mention is realistic only when it names the company itself or at least one of those companies.
 * The companies' own sites never get this far (topSourcePages drops them), so such a page is a third party
 * that writes about the trade: a comparison, a list, a portal or a news site.
 * Returns three areas, each a list of { id, ok: true|false|null, detail? }. ok null = could not be checked.
 */
export function workChecks(brief, site, pages) {
  const all = (bots) => (site.robots == null ? null : bots.every((b) => robotsAllows(site.robots, b)));
  const facts = site.home == null ? null : pageFacts(site.home);
  const words = facts ? facts.text.split(/\s+/).length : 0;
  const head = facts ? [facts.title, facts.description, ...facts.h1].join(" \n") : "";
  const sells = stems(brief.sells);
  const area = NATIONWIDE.test(String(brief.area ?? "").trim()) ? [] : stems(brief.area);

  const tech = [
    { id: "bots-chatgpt", ok: all(BOTS.chatgpt) },
    { id: "bots-google", ok: all(BOTS.google) },
    { id: "bots-others", ok: all(BOTS.others) },
    { id: "text", ok: facts ? words >= 120 : null },
    { id: "sitemap", ok: site.sitemap },
  ];

  const content = [{ id: "service", ok: facts && sells.length ? hasStem(head, sells) : null }];
  if (area.length) content.push({ id: "area", ok: facts ? hasStem(`${head} ${facts.text}`, area) : null, detail: String(brief.area).trim() });
  content.push(
    { id: "prices", ok: facts ? PRICE.test(facts.text) || PRICE_LINK.test(facts.links) : null },
    { id: "faq", ok: facts ? FAQ.test(`${facts.text} ${facts.links}`) || facts.types.includes("FAQPage") : null },
    { id: "schema", ok: facts ? facts.types.some((t) => ORG.test(t)) : null },
  );

  const re = nameRegex(nameForms({ company: brief.company, domain: brief.domain }));
  const own = domainOf(brief.domain);
  const rivals = [...new Set((brief.competitors ?? []).map((n) => String(n).trim()).filter((n) => n.length >= 3))].map((n) =>
    nameRegex(nameForms({ company: n })),
  );
  const mentions = [];
  for (const p of pages) {
    if (p.html == null || mentions.length >= 5) continue;
    const text = pageFacts(p.html).text;
    re.lastIndex = 0;
    const named = re.test(text) || Boolean(own && p.html.toLowerCase().includes(own));
    const others = rivals.filter((r) => ((r.lastIndex = 0), r.test(text))).length;
    if (named || others >= 1) mentions.push({ id: "source", ok: named, detail: p.domain });
  }

  return { tech, content, mentions };
}

// Platforms where a "mention on the page" cannot be read from the HTML, or where one page says little,
// and file stores that hold documents, not pages.
const SKIP = /(^|\.)(google|youtube|facebook|instagram|linkedin|tiktok|x|twitter|reddit|wikipedia|bing|openai|chatgpt|amazonaws|cloudfront|googleapis|googleusercontent|windows|azureedge|dropbox|issuu|scribd)\.[a-z.]+$/;
const FILE = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|jpe?g|png|webp)([?#]|$)/i;
// "personnel.eezy.fi" and "eezy.fi" are the same company: compare the last two labels.
const root = (d) => String(d ?? "").split(".").slice(-2).join(".");
const slug = (n) => String(n ?? "").toLowerCase().replace(/\b(oy|oyj|ab|ltd|group|finland|suomi)\b/g, "").replace(/[^a-z0-9]/g, "");

/**
 * The third-party pages the answers leaned on most: one URL per site. Own and competitors' sites are left out,
 * also when the competitor is known only by name and the name is the site's address.
 */
export function topSourcePages(answers, ownDomain, competitorDomains = [], max = 10, competitorNames = []) {
  const skip = new Set([domainOf(ownDomain), ...competitorDomains.map(domainOf)].filter(Boolean).map(root));
  const names = competitorNames.map(slug).filter((n) => n.length >= 4);
  const sites = new Map();
  answers.forEach((a, i) => {
    for (const s of a.sources ?? []) {
      if (!s.url || !/^https?:\/\//i.test(s.url) || FILE.test(s.url) || skip.has(root(s.domain)) || SKIP.test(s.domain)) continue;
      const label = root(s.domain).split(".")[0].replace(/[^a-z0-9]/g, "");
      if (names.some((n) => label === n || (label.length >= 5 && n.startsWith(label)) || label.startsWith(n))) continue;
      const site = sites.get(s.domain) ?? { domain: s.domain, answers: new Set(), urls: new Map() };
      site.answers.add(i);
      site.urls.set(s.url, (site.urls.get(s.url) ?? 0) + 1);
      sites.set(s.domain, site);
    }
  });
  return [...sites.values()]
    .sort((a, b) => b.answers.size - a.answers.size || a.domain.localeCompare(b.domain))
    .slice(0, max)
    .map((s) => ({ domain: s.domain, url: [...s.urls.entries()].sort((a, b) => b[1] - a[1])[0][0], answers: s.answers.size }));
}
