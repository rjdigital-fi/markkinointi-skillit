// The engine of the AI visibility check: reads AI answers, finds where a company is named or cited,
// who is named instead, and which sources the AIs lean on. Pure functions, no Node imports and no network,
// so the same file runs in a script, on a server and in a browser.

export const ENGINES = {
  chatgpt: { label: "ChatGPT" },
  gemini: { label: "Gemini" },
  aimode: { label: "Google AI Mode" },
  perplexity: { label: "Perplexity" },
  claude: { label: "Claude" },
  copilot: { label: "Copilot" },
};
export const engineLabel = (id) => ENGINES[id]?.label ?? String(id ?? "").replace(/^./, (c) => c.toUpperCase());

/** Host of a URL or a bare domain, lower case, without www. Returns "" when nothing usable is given. */
export function domainOf(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return "";
  const m = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").match(/^[a-z0-9äöå.-]+\.[a-z]{2,}/);
  return m ? m[0].replace(/\.$/, "") : "";
}

const LEGAL = /\s+(oy|oyj|ab|ky|ay|tmi|ry|osk|ltd|inc|llc|gmbh|as|aps|oü)\.?$/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LETTER = "a-zà-öø-ÿ0-9";

/** Names a company can go by: the given name, the name without its legal form, aliases and the domain. */
export function nameForms(brief) {
  const out = new Set();
  const add = (v) => {
    const s = String(v ?? "").replace(/\s+/g, " ").trim();
    if (s.length >= 2) out.add(s);
  };
  for (const n of [brief.company, ...(brief.aliases ?? [])]) {
    add(n);
    add(String(n ?? "").replace(LEGAL, ""));
  }
  const d = domainOf(brief.domain);
  if (d) add(d);
  return [...out];
}

/** One regex for all name forms. A Finnish case ending after the name still matches ("Yrityksen" needs an alias). */
export function nameRegex(forms) {
  if (!forms.length) return null;
  const alt = [...forms].sort((a, b) => b.length - a.length).map((f) => esc(f).replace(/\s+/g, "[\\s-]?")).join("|");
  return new RegExp(`(^|[^${LETTER}])(${alt})(?=(?:[:'’]?[a-zäö]{1,6})?(?:[^${LETTER}]|$))`, "giu");
}

/** Answer text as a person reads it: link targets, bare URLs and markdown marks removed. */
export function visibleText(md) {
  return String(md ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\\([.\-()!#*_[\]|])/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/[ \t]+/g, " ");
}

function collect(node, keys, out = []) {
  if (Array.isArray(node)) for (const v of node) collect(v, keys, out);
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) {
      if (keys.includes(k) && typeof v === "string") out.push(v);
      else collect(v, keys, out);
    }
  return out;
}

/**
 * Turns one raw DataForSEO result into the common answer shape.
 * engine: chatgpt | gemini (LLM Scraper), aimode (SERP AI Mode), perplexity (LLM Responses).
 */
export function parseDataforseo(engine, json) {
  const r = json?.tasks?.[0]?.result?.[0] ?? json?.result?.[0] ?? json ?? {};
  let text = "";
  let sources = [];
  let searches = [];
  let brands = [];
  if (engine === "aimode") {
    const ao = (r.items ?? []).find((i) => i.type === "ai_overview") ?? {};
    text = ao.markdown ?? "";
    sources = (ao.references ?? []).map((s) => ({ url: s.url, title: s.title ?? s.source ?? "" }));
  } else if (engine === "perplexity") {
    text = (r.items ?? []).flatMap((i) => (i.sections ?? []).map((s) => s.text ?? "")).join("\n\n");
    sources = [...new Set(collect(r.items ?? [], ["url"]))].map((url) => ({ url, title: "" }));
    searches = r.fan_out_queries ?? [];
  } else {
    text = r.markdown ?? "";
    sources = (r.sources ?? []).map((s) => ({ url: s.url, title: s.title ?? "" }));
    searches = r.fan_out_queries ?? [];
    brands = (r.brand_entities ?? []).filter((b) => !b.category || /company|brand|organi|business|product/i.test(b.category)).map((b) => b.markdown ?? b.title).filter(Boolean);
  }
  return normalizeAnswer({ engine, text, sources, searches, brands });
}

/** Fills in the fields every answer has, whatever tool it came from. */
export function normalizeAnswer(a) {
  const seen = new Set();
  const sources = [];
  for (const s of a.sources ?? []) {
    const url = typeof s === "string" ? s : s?.url ?? "";
    const domain = domainOf(typeof s === "string" ? s : s?.domain || url);
    if (!domain) continue;
    const key = url || domain;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ domain, url, title: typeof s === "string" ? "" : String(s?.title ?? "") });
  }
  return {
    question: String(a.question ?? a.prompt ?? "").trim(),
    engine: String(a.engine ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") === "googleaimode" ? "aimode" : String(a.engine ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""),
    run: Number(a.run) > 0 ? Number(a.run) : 1,
    text: String(a.text ?? a.answer ?? ""),
    sources,
    searches: [...new Set((a.searches ?? []).map((s) => String(s).trim()).filter(Boolean))],
    brands: [...new Set((a.brands ?? []).map((s) => String(s).trim()).filter(Boolean))],
    ...(a.date ? { date: a.date } : {}),
  };
}

/** Is the company named in the answer text, and is its site among the sources? A name only in a link does not count as named. */
export function detect(answer, brief) {
  const text = visibleText(answer.text);
  const re = nameRegex(nameForms(brief));
  const own = domainOf(brief.domain);
  let mentioned = false;
  let quote = "";
  let index = -1;
  if (re) {
    const m = re.exec(text);
    if (m) {
      mentioned = true;
      index = m.index + m[1].length;
      const from = Math.max(text.lastIndexOf("\n", index) + 1, index - 140);
      let to = text.indexOf("\n", index);
      let cut = false;
      if (to < 0 || to - index > 200) {
        cut = index + 200 < text.length;
        to = Math.min(text.length, index + 200);
      }
      quote = text.slice(from, to).replace(/\s+/g, " ").trim();
      if (cut) quote = quote.replace(/\s+\S*$/, "") + "…";
      // A heading or list title with only the name says nothing: take the lines after it along.
      if (quote.replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").length < m[2].length + 25) {
        const rest = text.slice(to, to + 400).split("\n").map((l) => l.replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
        let more = "";
        for (const l of rest) {
          if (more.length >= 120) break;
          more += (more ? " " : "") + l;
        }
        if (more.length > 260) more = more.slice(0, 260).replace(/\s+\S*$/, "") + "…";
        if (more) quote = `${quote.replace(/[:–—-]\s*$/, "").trim()}: ${more}`;
      }
    }
  }
  const linkDomains = [...String(answer.text ?? "").matchAll(/\]\((https?:\/\/[^)\s]+)/g)].map((m) => domainOf(m[1]));
  const sameSite = (d) => !!own && (d === own || d.endsWith("." + own));
  const citedUrls = (answer.sources ?? []).filter((s) => sameSite(s.domain)).map((s) => s.url || s.domain);
  const cited = citedUrls.length > 0 || linkDomains.some(sameSite);
  return { mentioned, cited, quote, index, citedUrls };
}

// Words that open a bold line in an answer but are not company names.
const NOT_NAMES = new Set(
  ("hinta hinnat hinnoittelu yhteenveto huomio huom vinkki vinkit suositus suositukset kokemus referenssit palvelut palvelu sijainti " +
    "vahvuudet heikkoudet edut haitat plussat miinukset kenelle sopii soveltuu erikoisuus erikoistuminen erikoisosaaminen asiakkaat " +
    "lisätiedot yhteystiedot verkkosivut verkkosivu kotisivut osoite puhelin arvostelut arviot tärkeää muista valintakriteerit " +
    "kriteerit vertailu johtopäätös lopuksi seuraavaksi miksi mitä miten missä milloin kuka paras parhaat pros cons price pricing " +
    "summary note tip best why what how overview conclusion location services strengths focus toimiala koko tyyli lähestymistapa " +
    "fokus kohderyhmä painopiste profiili kuvaus tausta tiimi hintataso laatu nopeus luotettavuus asiakaspalvelu takuu toimitus").split(" "),
);

function cleanName(raw) {
  let s = String(raw ?? "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/^\d+[.)]\s*/, "").replace(/\s*[:–—-]\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (s.length < 2 || s.length > 45) return "";
  if (s.split(" ").length > 5) return "";
  if (/[.!?]$/.test(s) && !/\.(fi|com|io|net|org|eu|ai)$/i.test(s)) return "";
  if (!/^[A-ZÅÄÖ0-9]/.test(s) && !/\.[a-z]{2,}$/.test(s)) return "";
  if (NOT_NAMES.has(s.toLowerCase()) || NOT_NAMES.has(s.toLowerCase().split(" ")[0])) return "";
  if (/^\d+([.,]\d+)?\s*(€|eur|e|%|kk|h)?$/i.test(s)) return "";
  // A Finnish compound with a loose hyphen ("Google Ads -optimointi") is a service or a topic, not a company.
  if (/\s-\p{L}/u.test(s)) return "";
  // A heading about companies in general ("Toimistojen tyypit Suomessa") is not a company.
  if (/(^|\s)(suomessa|tyypit|vaihtoehdot|yritykset|toimistot|toimijat|palveluntarjoajat|hinnat|kustannukset|hintaluokat|in finland|companies|agencies|providers|options)(\s|$)/i.test(s) && s.split(" ").length >= 2) return "";
  return s;
}

/** Names that look like companies in one answer, in reading order: the tool's own brand list, or bold and heading text. */
export function candidateNames(answer) {
  const md = String(answer.text ?? "");
  const found = [];
  const push = (raw, index) => {
    const name = cleanName(raw);
    if (name) found.push({ name, index });
  };
  // A tool can hand several names in one string ("Helen, Fortum, Vattenfall").
  for (const b of (answer.brands ?? []).flatMap((x) => String(x).split(/\s*[,;]\s+|\s+\/\s+/))) {
    const at = md.toLowerCase().indexOf(b.toLowerCase());
    push(b, at < 0 ? 1e9 : at);
  }
  if (!(answer.brands ?? []).length) {
    // One bold run can list several names ("Helen, Fortum, Vattenfall").
    for (const m of md.matchAll(/\*\*([^*\n]{2,60})\*\*/g)) for (const part of m[1].split(/\s*[,;]\s+|\s+\/\s+/)) push(part, m.index);
    for (const m of md.matchAll(/^#{2,4}\s+(?:\d+[.)]\s*)?([^\n]{2,60})$/gm)) for (const part of m[1].split(/\s+\/\s+/)) push(part, m.index);
  }
  const seen = new Set();
  return found
    .sort((a, b) => a.index - b.index)
    .filter((f) => {
      const k = keyOf(f.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((f) => f.name);
}

/** Same company under slightly different spellings gets one key. */
export function keyOf(name) {
  return String(name ?? "").toLowerCase().replace(LEGAL, "").replace(/\.(fi|com|io|net|org|eu|ai)$/, "").replace(/[^a-zà-öø-ÿ0-9]/g, "");
}

/** Letters without their marks and nothing but letters and digits: "LämpöYkkönen" and "lampoykkonen" meet. */
const fold = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Share as a whole percent, 0 when there is nothing to divide by. */
export const pct = (part, whole) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

/**
 * The whole analysis.
 * brief: { company, domain, aliases?, competitors?, notCompanies?, questions? }
 * answers: [{ question, engine, run?, text, sources?, searches?, brands? }]
 * Names in brief.competitors are always counted; names in brief.notCompanies are dropped.
 */
export function analyze(brief, rawAnswers) {
  const answers = rawAnswers.map(normalizeAnswer).filter((a) => a.text.trim() && a.question);
  const ownKeys = new Set(nameForms(brief).map(keyOf));
  const isOwn = (k) => ownKeys.has(k) || [...ownKeys].some((o) => o.length >= 4 && k.startsWith(o));
  const drop = new Set((brief.notCompanies ?? []).map(keyOf));
  const fixed = (brief.competitors ?? []).map((n) => String(n).trim()).filter(Boolean);
  const fixedRe = fixed.map((n) => ({ name: n, key: keyOf(n), re: nameRegex([n, n.replace(LEGAL, "")]) }));

  // A name that is already in a question is a product or a topic the buyer asked about (Google Ads), not a company the AI picked.
  const asked = answers.map((a) => a.question.toLowerCase()).join("\n");
  const fixedKeys = new Set(fixed.map(keyOf));

  const rows = answers.map((a) => {
    const d = detect(a, brief);
    const names = [];
    const keys = new Set();
    const add = (name) => {
      const k = keyOf(name);
      if (!k || keys.has(k) || isOwn(k) || drop.has(k)) return;
      const low = String(name).toLowerCase();
      const lead = low.split(" ").slice(0, 2).join(" ");
      if (!fixedKeys.has(k) && (asked.includes(low) || (lead.includes(" ") && asked.includes(lead)))) return;
      keys.add(k);
      names.push(name);
    };
    const text = visibleText(a.text);
    for (const f of fixedRe) {
      f.re.lastIndex = 0;
      if (f.re.test(text)) add(f.name);
    }
    for (const n of candidateNames(a)) add(n);
    return { ...a, ...d, names };
  });

  const questions = [...new Set([...(brief.questions ?? []), ...rows.map((r) => r.question)])].filter((q) => rows.some((r) => r.question === q));
  const engines = [...new Set(rows.map((r) => r.engine))].sort((a, b) => Object.keys(ENGINES).indexOf(a) - Object.keys(ENGINES).indexOf(b));
  const tally = (list) => ({
    answers: list.length,
    mentioned: list.filter((r) => r.mentioned).length,
    cited: list.filter((r) => r.cited).length,
  });
  const verdict = (t) => (t.answers === 0 ? "none" : t.mentioned === 0 ? "no" : t.mentioned * 2 > t.answers || t.answers === 1 ? "yes" : "sometimes");

  const matrix = questions.map((q) => ({
    question: q,
    cells: Object.fromEntries(
      engines.map((e) => {
        const list = rows.filter((r) => r.question === q && r.engine === e);
        const t = tally(list);
        const first = list.find((r) => r.mentioned);
        return [e, { ...t, verdict: verdict(t), quote: first?.quote ?? "", names: [...new Set(list.flatMap((r) => r.names))].slice(0, 8) }];
      }),
    ),
    ...tally(rows.filter((r) => r.question === q)),
  }));

  // Who is named instead. Each name carries its evidence: "brief" (given by the user), "brand" (the data source
  // listed it as a brand), "domain" (a cited site carries the same name) or "text" (only bold or heading text).
  // "text" names are guesses: a person or an agent confirms them before they are shown as competitors.
  const stemDomain = new Map();
  for (const d of rows.flatMap((r) => [...r.sources.map((s) => s.domain), ...[...r.text.matchAll(/\]\((https?:\/\/[^)\s]+)/g)].map((m) => domainOf(m[1]))])) {
    const stem = fold(d.split(".").slice(-2, -1)[0] ?? "");
    if (stem.length >= 3 && !stemDomain.has(stem)) stemDomain.set(stem, d.split(".").slice(-2).join("."));
  }
  // The site of a named company: its domain is the whole name or the first word or two of it ("Wuohi Digital" -> wuohi.fi).
  const domainFor = (name) => {
    const words = String(name ?? "").replace(LEGAL, "").trim().split(/\s+/);
    const whole = fold(words.join(""));
    for (const k of [whole, fold(words.slice(0, 2).join("")), fold(words[0])]) if (k.length >= 3 && stemDomain.has(k)) return stemDomain.get(k);
    for (const [stem, d] of stemDomain) {
      const [short, long] = stem.length < whole.length ? [stem, whole] : [whole, stem];
      if (short.length >= 5 && long.startsWith(short) && short.length >= 0.7 * long.length) return d;
    }
    return "";
  };
  // "Sitko Pizza" and "Sitko Pizza & Bar" are one company: a longer name folds into a shorter one of two words or more.
  const bases = [...new Set(rows.flatMap((r) => r.names).filter((n) => /\S\s+\S/.test(n.trim())).map(keyOf))].filter((k) => k.length >= 6).sort((a, b) => a.length - b.length);
  const canon = (k) => bases.find((b) => b !== k && k.startsWith(b)) ?? k;
  const comp = new Map();
  rows.forEach((r, i) => {
    const seen = new Set();
    for (const n of [...r.names].sort((a, b) => a.length - b.length)) {
      const k = canon(keyOf(n));
      if (seen.has(k)) continue;
      seen.add(k);
      const c = comp.get(k) ?? { name: n, answers: 0, engines: {}, questions: new Set(), brief: false, brand: false, rows: new Set() };
      c.rows.add(i);
      if (fixed.some((f) => keyOf(f) === k)) c.brief = true;
      if ((answers[i].brands ?? []).some((b) => String(b).split(/\s*[,;]\s+|\s+\/\s+/).some((x) => keyOf(x) === k))) c.brand = true;
      comp.set(k, c);
    }
  });
  // Two names with the same site are one company (Kubla, Kubla Marketing): the shorter name stays.
  const merged = new Map();
  for (const c of [...comp.values()].sort((a, b) => a.name.length - b.name.length)) {
    const domain = domainFor(c.name);
    const m = domain ? merged.get(domain) : null;
    if (m) {
      c.rows.forEach((i) => m.rows.add(i));
      m.brief ||= c.brief;
      m.brand ||= c.brand;
    } else merged.set(domain || `name:${c.name}`, { ...c, domain });
  }
  const competitors = [...merged.values()]
    .map((c) => {
      const list = [...c.rows].map((i) => rows[i]);
      const engines = {};
      for (const r of list) engines[r.engine] = (engines[r.engine] ?? 0) + 1;
      return { ...c, answers: list.length, engines, questions: new Set(list.map((r) => r.question)) };
    })
    .map((c) => ({ name: c.name, answers: c.answers, share: pct(c.answers, rows.length), engines: c.engines, questions: c.questions.size, domain: c.domain, evidence: c.brief ? "brief" : c.brand ? "brand" : c.domain ? "domain" : "text" }))
    .sort((a, b) => b.answers - a.answers || a.name.localeCompare(b.name));

  const own = domainOf(brief.domain);
  const src = new Map();
  for (const r of rows) {
    for (const d of new Set(r.sources.map((s) => s.domain))) {
      const s = src.get(d) ?? { domain: d, answers: 0, engines: {}, own: !!own && (d === own || d.endsWith("." + own)) };
      s.answers++;
      s.engines[r.engine] = (s.engines[r.engine] ?? 0) + 1;
      src.set(d, s);
    }
  }
  const sources = [...src.values()].map((s) => ({ ...s, share: pct(s.answers, rows.length) })).sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain));

  const total = tally(rows);
  const runs = Math.max(1, ...rows.map((r) => r.run));
  return {
    company: brief.company,
    domain: own,
    date: brief.date ?? rows.map((r) => r.date).filter(Boolean).sort().pop() ?? null,
    runs,
    engines: engines.map((e) => ({ id: e, label: engineLabel(e), ...tally(rows.filter((r) => r.engine === e)) })),
    questions: matrix,
    total: { ...total, share: pct(total.mentioned, total.answers), citedShare: pct(total.cited, total.answers) },
    competitors: competitors.filter((c) => c.evidence !== "text"),
    unconfirmed: competitors.filter((c) => c.evidence === "text" && c.answers >= 2),
    sources,
    ownPages: [...new Set(rows.flatMap((r) => r.citedUrls))],
    searches: [...new Set(rows.flatMap((r) => r.searches))],
    quotes: rows.filter((r) => r.mentioned && r.quote).map((r) => ({ engine: r.engine, question: r.question, quote: r.quote })),
  };
}

/**
 * Buyer questions from a short brief, used when nobody writes them by hand. The wording avoids Finnish case
 * endings on the given words, so any input stays readable. A person or an agent should still review them.
 * brief: { sells, area?, buyer? }
 */
export function templateQuestions(brief, lang = "fi", count = 3) {
  const sells = String(brief.sells ?? "").trim();
  const area = String(brief.area ?? "").trim();
  const buyer = String(brief.buyer ?? "").trim();
  if (!sells) return [];
  const fi = [
    `Etsin palveluntarjoajaa: ${sells}${area ? `. Alue: ${area}` : ""}. Mitä yrityksiä suosittelet?`,
    `Mitkä ovat parhaat vaihtoehdot, kun tarvitsen: ${sells}${buyer ? ` (ostaja: ${buyer})` : ""}${area ? `, ${area}` : ""}? Nimeä yritykset ja perustele.`,
    `Vertaile yrityksiä, joilta saa: ${sells}${area ? `, alue ${area}` : ""}. Kenet valitsisit ja miksi?`,
    `Kuka on luotettava toimija, kun haen: ${sells}${area ? ` (${area})` : ""}? Listaa 3–5 yritystä.`,
    `Mitä ${sells} maksaa${area ? ` (${area})` : ""} ja keneltä se kannattaa tilata?`,
  ];
  const en = [
    `I am looking for a provider of ${sells}${area ? ` in ${area}` : ""}. Which companies do you recommend?`,
    `What are the best options for ${sells}${buyer ? ` for ${buyer}` : ""}${area ? ` in ${area}` : ""}? Name the companies and explain why.`,
    `Compare companies that offer ${sells}${area ? ` in ${area}` : ""}. Which one would you choose and why?`,
    `Who is a reliable provider of ${sells}${area ? ` in ${area}` : ""}? List 3–5 companies.`,
    `What does ${sells} cost${area ? ` in ${area}` : ""} and who should I buy it from?`,
  ];
  return (lang === "en" ? en : fi).slice(0, Math.max(1, Math.min(5, count)));
}
