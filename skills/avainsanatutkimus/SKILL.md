---
name: avainsanatutkimus
description: Keyword research with real data, step by step - topic map, search volumes and click prices, keyword grouping by intent, the questions people ask AI, a budget split, and optionally where the user's own site already shows up (Google Search Console, Bing Webmaster Tools). The user picks the data source - any connected MCP or API (Semrush, Ahrefs, SE Ranking, DataForSEO, SearchApi, HasData, Cloro, ...) or a CSV export. Use when the user asks for keyword research, avainsanatutkimus, hakusanatutkimus, hakusanat, search volumes, hakumäärät, a keyword list for SEO or Google Ads, or which pages to build for a topic.
---

# Avainsanatutkimus (keyword research)

You run a keyword research for one topic in one market and hand back a report the user can act on: which
keyword groups exist, how much each is searched, what a click costs, which page and channel each group needs,
what people ask AI about the topic, and how to split a budget.

The method is described for people in the guide https://rjdigital.fi/oppaat/avainsanatutkimus. This file is
the same method for an agent.

## Rules

- Answer in the user's language. The report language follows it (`--lang fi` or `--lang en`).
- Every number in the report comes from the data source. Never estimate or invent a volume, a price or a
  trend. If the source does not give something, leave it out and say so.
- Say where the data came from and when it was fetched. Search volumes are estimates by the source, and
  different sources give different numbers for the same keyword. Do not mix volumes from two sources in one
  table without saying so.
- Paid calls: tell the user roughly what a step will use (credits or money) before the first paid call, and
  report what was used at the end. Fetch once and reuse the saved files.
- Never print, log or commit API keys. Read them from the environment or let the MCP connection hold them.
- Do not judge or rank the companies that show up in the data. Report what the data shows.

## Files

Work in one folder per research, by default `avainsanatutkimus/<topic-slug>/` in the current project.

| File | Content |
| --- | --- |
| `keywords.json` | every keyword found, in the shared format (see `sources/overview.md`) |
| `groups.json` | your grouping, intents, weights, pages and channels |
| `chatgpt.json` | AI answers: the question, the searches the AI ran, sources, brands named |
| `serp-<keyword>.json` | Google result page: result types, People also ask, top results |
| `site.json` | optional: the site's own queries from Search Console or Bing Webmaster Tools, with clicks, impressions, position and page |
| `report.md`, `keywords.csv` | the result |

Scripts are in `scripts/` next to this file. They need Node 18 or newer and nothing else.

- `scripts/import.mjs` puts keyword rows from any source into `keywords.json` (CSV, TSV or JSON, as exported
  or as the MCP or API returned it). With `--site` it puts the site's own Search Console or Bing Webmaster
  Tools rows into `site.json` instead.
- `scripts/answers.mjs` puts an AI answer or a Google result page from any source into `chatgpt.json` or
  `serp-<keyword>.json`.
- `scripts/report.mjs` builds `report.md` and `keywords.csv`. It makes no network calls.
- `scripts/dataforseo.mjs` is a ready-made fetcher for one source, DataForSEO. Other sources go through their
  own MCP or API and the two importers.

## Step 0: the brief and the data source

Ask only what you cannot see from the conversation or the project:

1. The topic (product or service) and what the business sells: installs, sells online, sells to businesses.
2. The market: country and language. Local business: which towns.
3. A monthly ad budget, if a budget split is wanted.

Then choose the data source with the user. Read `sources/overview.md` first. It lists the five kinds of data
this research uses and which sources give which. In short:

1. Look at what is already connected: MCP tools in this session (an SEO tool such as Semrush, Ahrefs, SE Ranking
   or DataForSEO, an ad platform such as Google Ads, a result page API such as SearchApi, SerpApi or HasData,
   a GEO tool such as Cloro or an AI visibility tracker, or any other keyword, SERP or AI answer tool), API keys in the environment
   (names only, never values), and export files in the folder.
2. Tell the user what you found and which parts of the research each one covers. Ask which to use. One
   source for everything is fine, and so is a mix, for example volumes from Semrush and AI answers from Cloro.
3. If nothing is connected, offer the choices: connect an MCP, set an API key, or export a CSV from Google
   Keyword Planner (free with a Google Ads account) or their SEO tool. `sources/csv.md` tells the user how.
4. Ask whether the site's own search data can be used: Google Search Console or Bing Webmaster Tools, through
   an MCP, an API or a CSV export. It is optional. With it the report shows where the site already shows up
   (step 5). Ask now, so the user can make the export while you work on steps 1 to 4.
5. Write the choice at the top of your notes for this research and name it in the report.

Parts that no chosen source covers are skipped. Say which, and what would be needed to add them.

## Step 1: topic map

Before fetching anything, list the angles of the topic. Typical branches: price, buying and quotes, service or
installation, maintenance, brands, comparison and choice, use and problems, use case (for whom, where), town,
accessories, neighbouring products. Add what is specific to this business. Each branch gets 2 to 5 seed phrases
in the market's language, in the forms people really type.

Show the map to the user briefly. They know their business: ask what is missing and what they do not sell.

## Step 2: fetch keywords, volumes and prices

Use the seeds to fetch keyword ideas with monthly volume, click price, competition and the monthly trend.
Follow the guide of the chosen source in `sources/`:

- DataForSEO: `sources/dataforseo.md`
- Any other SEO, SEM or GEO tool through its MCP or API (Semrush, Ahrefs, SE Ranking, Google Ads, SearchApi,
  SerpApi, HasData, Cloro, AI visibility trackers and others): `sources/mcp-and-apis.md`
- Export files: `sources/csv.md`

Everything lands in `keywords.json` through `scripts/import.mjs` (or `dataforseo.mjs`, which writes the same
format). Filter out rows that are not about the topic with `--match "<regex>"`. Sources return neighbouring
topics too.

Towns: idea tools rarely return town phrases. Build them yourself (service + town, for the towns the business
serves) and fetch exact volumes for that list.

Then read the list. Check that the big keywords of every branch of the map are there. A branch with no data
means a missing seed more often than no searches: add seeds and fetch again.

## Step 3: group and decide intent

Write `groups.json`. Pick 30 to 80 keywords that matter and put them in 6 to 12 groups. A group is a set of
searches that one page can answer.

```json
{
  "topic": "aurinkopaneelit",
  "main": "aurinkopaneeli",
  "market": "Suomi, suomi",
  "currency": "USD",
  "lang": "fi",
  "groups": [
    { "name": "Hinta", "intent": "Osto", "weight": 0.5, "business": 1,
      "page": "Hintasivu", "channel": "Google Ads ja SEO",
      "keywords": ["aurinkopaneeli hinta|aurinkopaneelit hinta", "aurinkopaneelien hinta"] }
  ]
}
```

- `keywords`: exact strings from `keywords.json`. `"a|b"` joins close variants (singular and plural, inflected
  forms, word order). Google usually reports the same volume for such variants because it counts them
  together, so only the first form's volume is counted. Two rows with the same volume and the same price are
  almost always one search. Never add them up.
- `intent`: a label in the user's language. Use four: buying (Osto), local buying (Paikallinen osto),
  comparing (Vertailu), looking for information (Tiedonhaku). Decide from the words and, when unsure, from the
  result page: shops and service pages mean buying, lists and reviews mean comparing, guides mean information.
- `weight`: the intent's share in the budget split. Buying 1, local buying 1, comparing 0.5, information 0.
  Price searches are buying searches but get 0.5, because the searcher is still comparing prices and has not
  chosen a provider. Brand searches get 0.5.
- `business`: 1 by default. Lower it for what the business sells little of or earns little from, 0 for what it
  does not sell. Ask the user. Do not guess margins.
- `page`: the page type that answers the group (service page, price page, town page, comparison, guide).
- `channel`: where the group is worth working on: Google Ads, SEO, local SEO, AI visibility, or several.
- `currency`: the currency of the prices in the source. Check it. Do not convert.
- `main`: the keyword whose twelve months are shown as the seasonality table.

## Step 4: what people ask AI

If a chosen source covers it:

1. AI search volume for the keywords, when the source has such an estimate. It goes into `ai_volume`.
2. Real AI answers. Write 4 to 8 questions a buyer would ask an assistant about this topic, in full sentences
   in the market's language (which one to buy, what it costs, who installs it in a town, is it worth it). Fetch
   the answers and save for each: the searches the AI ran, the sources it used, the brands it named. The
   searches the AI runs are keyword data: they show how an assistant rewrites a question.
3. The Google result page for 1 to 3 main buying keywords: result types (AI Overview, local pack, shopping)
   and the People also ask questions.

Save each answer as JSON and import it with `scripts/answers.mjs`. Format of `chatgpt.json` and
`serp-*.json`: `sources/overview.md`.

## Step 5: the site's own data (optional)

Only with the Search Console or Bing Webmaster Tools data asked for in step 0. Without it, skip this step, say
so, and do not guess the site's rankings.

1. Get the site's queries with clicks, impressions and average position, and the page when the source gives
   it. Use the last three months and the market's country. How, per source: `sources/mcp-and-apis.md`
   (MCP or API) or `sources/csv.md` (export).
2. Import them into their own file:

   ```
   node scripts/import.mjs --site --dir <folder> --file <Queries.csv|answer.json> --source "Search Console" --period "<dates>" --match "<regex>"
   ```

   Use the same `--match` as in step 2, so only this topic's queries come in. Read the output: it lists the
   columns found and the largest rows. Bing data is imported the same way with its own `--source`, and both
   can be in the file.
3. These are the site's own numbers. They never go into `keywords.json`, and impressions are never used as a
   search volume. They stay in the user's folder: do not send them to any outside service.

`report.mjs` adds the section when `site.json` exists: per group how many of its keywords the site shows up
for, impressions, clicks, average position and the page that gets them; the grouped keywords at positions 5 to
15; the groups with no visibility; and the site's other queries that are in no group.

Read it before you write the summary:

- Queries are matched to the grouped keywords by exact text. If few match, look at the list of other queries.
  A query there that belongs to the topic is a gap in the research: fetch its volume from the market source and
  add it to a group.
- A group with no visibility does not prove the page is missing. Look at the site (its pages or sitemap)
  before you say a page needs to be built. A page can exist and not rank.
- Positions are averages over the period, all devices and all result types. Give them as such.
- Keywords at positions 5 to 15 with buying intent are the nearest gains: the page exists and Google already
  shows it.

## Step 6: the report

```
node scripts/report.mjs --dir <folder> --budget <monthly budget> --lang fi
```

`report.md` holds the topic map (a Mermaid mind map), the keyword tables by group, the seasonality of the main
keyword, the budget split, the AI answers, the result page notes, the site's own visibility (when `site.json` exists)
and the largest ungrouped keywords. Read the
ungrouped list: a large keyword left there is either off-topic or a gap in your groups. Fix `groups.json` and
build again. The script lists keywords in `groups.json` that are missing from the data: fix every one.

Then tell the user, in a few short paragraphs and in their language:

1. What was found: the number of keywords, the biggest groups, the season.
2. What to do first: the 3 to 5 groups where buying intent, volume and a missing or weak page meet. With the
   site's own data, name the groups where the site is not visible and the keywords at positions 5 to 15.
   Without it, say that the pages were not checked against search data.
3. The budget split and what it rests on. It is a starting point from volume and click price. Real campaign
   data replaces it after the first weeks.
4. The source and date of the data, what was skipped, and what the fetching cost.

Do not promise rankings, traffic or sales.
