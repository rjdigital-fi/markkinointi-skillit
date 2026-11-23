# Data sources: what the research needs and who gives it

The skill is not tied to one vendor. It needs five kinds of data. Any tool that gives one of them can be used
for that part, and parts can come from different tools.

| # | Data | Used in | Needed? |
| --- | --- | --- | --- |
| 1 | Keyword ideas from seed phrases | step 2 | yes |
| 2 | Monthly search volume, click price, competition, twelve-month trend | steps 2, 3, 6 | yes |
| 3 | AI search volume estimate per keyword | step 4 | optional |
| 4 | Real AI answers (ChatGPT, Gemini, Perplexity, AI Overview, AI Mode) with the searches run and sources | step 4 | optional |
| 5 | Google result page: result types, People also ask, top results | steps 3, 4 | optional |

## Which source covers what

The table is a starting point, checked against the vendors' own pages in November 2026. Products change. Before
you rely on a row, look at the tools the connected MCP really offers, or at the vendor's API documentation.

The skill is built to work with the common SEO, SEM and GEO tools, grouped here by what they are for. "Tested"
says how far each was checked: a real run, or sample files built in the tool's layout (`tests/run.mjs`).

**SEO tools: keyword databases**

| Source | 1 ideas | 2 volumes and prices | 3 AI volume | 4 AI answers | 5 result page | How | Tested with this skill |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DataForSEO | yes | yes (Google Ads data) | yes | yes | yes | `scripts/dataforseo.mjs` or its MCP | real run, all five |
| Semrush | yes | yes | check the tools | check the tools | yes | official MCP, API or CSV export | sample files: export and API layout |
| Ahrefs | yes | yes | no | check the tools | yes | official MCP, API or CSV export | sample files: export and API layout |
| SE Ranking | yes | yes | no | check the tools | yes | MCP, API or CSV export | sample files: export and MCP layout |
| Moz, Mangools, Ubersuggest, Serpstat, SISTRIX, Keywords Everywhere | yes | yes | no | check the tools | check the tools | CSV export, or an API or MCP when the tool has one | sample files: export layout (not SISTRIX) |

**SEM tools: the ad platforms' own planners**

| Source | 1 ideas | 2 volumes and prices | 3 AI volume | 4 AI answers | 5 result page | How | Tested with this skill |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Google Keyword Planner | yes | yes (bid range, no single CPC) | no | no | no | CSV export | sample file |
| Google Ads API or a Google Ads MCP | yes | yes (bid range, in micros) | no | no | no | keyword idea and historical metrics answers as JSON | sample file |
| Microsoft Advertising Keyword Planner | yes | yes (Bing volumes, suggested bid) | no | no | no | CSV export | sample file |

**GEO tools and result page APIs**

| Source | 1 ideas | 2 volumes and prices | 3 AI volume | 4 AI answers | 5 result page | How | Tested with this skill |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SearchApi, SerpApi, HasData, Serper, Bright Data | no | no (Google Trends for the trend, where offered) | no | check the tools (Google AI Mode, AI Overview) | yes | MCP or API, then `scripts/answers.mjs` | sample files: SerpApi-style and Serper layout |
| Cloro | no | no | no | yes (ChatGPT, Gemini, Perplexity, Copilot, AI Mode, AI Overview) | no | API, then `scripts/answers.mjs` | sample file |
| AI visibility trackers (Peec AI, Profound, Otterly, LLM Pulse, Nightwatch, SE Ranking AI Search, Semrush AI visibility, Ahrefs Brand Radar and others) | no | no | check the tools | check the tools: answers to tracked prompts, with sources and brands | no | MCP, API or export, then `scripts/answers.mjs` | sample file in a generic layout |
| Any other tool | map it | map it | map it | map it | map it | `sources/mcp-and-apis.md` | no |

"Check the tools" means the vendor has such a product, but whether it is reachable through the connection in
front of you depends on the plan and the version. Look, do not assume.

A sample file proves that the tool's known column and field names are read. It does not prove the tool's
current export: vendors rename columns. That is why both scripts print what they found, and why you read that
output every time.

A common mix: volumes from the SEO tool the user already pays for (Semrush, Ahrefs, SE Ranking), AI answers
from Cloro, SearchApi or HasData.

## The site's own data (optional)

Separate from the five kinds above: the user's own site in Google Search Console or Bing Webmaster Tools.
It answers a different question, where the site already shows up, and it is used only in step 5.

| Source | What it gives | How | Tested with this skill |
| --- | --- | --- | --- |
| Google Search Console | the site's queries in Google: clicks, impressions, average position, page | MCP, API or CSV export, then `scripts/import.mjs --site` | sample files: export, API and MCP layout |
| Bing Webmaster Tools | the same for Bing | API or CSV export, then `scripts/import.mjs --site` | sample files: export and API layout |

These numbers go to `site.json`, never to `keywords.json`: impressions of one site are not market search
volumes.

## How to choose with the user

1. List what is connected in this session and what each covers, in the user's language, as a short table.
2. Prefer what the user already pays for. Do not push a new tool when the connected ones cover parts 1 and 2.
3. Say what a missing part costs the research. Without 3 to 5 the report has no AI and result page sections.
   The keyword tables and the budget split need only 1 and 2.
4. With nothing connected, the free route is a Google Keyword Planner export (`sources/csv.md`).

## The shared format

Whatever the source, the data ends up in these files. `scripts/report.mjs` reads only these.

### keywords.json

An array, one object per keyword. Only `keyword` is required. Leave out what the source does not give.

```json
{
  "keyword": "aurinkopaneelit hinta",
  "volume": 480,
  "cpc": 1.49,
  "bid_low": 0.52,
  "bid_high": 2.31,
  "competition": "HIGH",
  "difficulty": 34,
  "ai_volume": 12,
  "months": [{ "month": "2026-10", "volume": 390 }],
  "source": "Semrush",
  "currency": "USD"
}
```

- `volume`: average monthly searches in the chosen country.
- `cpc`: price of a click in the source's currency. When a source gives only a bid range, fill `bid_low` and
  `bid_high`. The report then uses their midpoint.
- `competition`: advertiser competition as `LOW`, `MEDIUM` or `HIGH`. `import.mjs` converts 0 to 1 and 0 to 100
  indexes. This is not SEO difficulty. That goes into `difficulty`.
- `months`: the latest twelve months, oldest first.
- `source`: the tool the row came from, as it should read in the report.

Do not write this file by hand. Save the source's answer as CSV or JSON, exactly as it came, and run:

```
node scripts/import.mjs --dir <folder> --file <answer.json|export.csv> --source "<tool name>" --match "<regex>"
```

`import.mjs` recognises the column and field names of the tools above, in any letter case and as
`search_volume`, `searchVolume` or `Search Volume`. It finds the keyword rows wherever they sit in a JSON
answer, reads nested fields, converts micros to currency units, reads month names and skips volume ranges. It
prints which fields it found and which it did not, and merges by keyword.

- Other names: `--map "keyword=<name>,volume=<name>,cpc=<name>"`.
- Prices in cents (some Ahrefs API fields): `--cpc-scale 0.01`.
- Spreadsheet files (.xlsx) are not read. Export CSV.

Always read its output: a `not found: volume` line means the mapping is wrong, not that the data is missing.

### chatgpt.json

An array, one object per question. The name is historical: answers from any assistant go here. Name the
assistant in `engine`.

```json
{
  "prompt": "Mistä kannattaa pyytää tarjous aurinkopaneelien asennuksesta?",
  "engine": "ChatGPT",
  "searches": ["aurinkopaneelien asennus tarjous vertailu 2026"],
  "sources": [{ "domain": "example.fi", "url": "https://example.fi/sivu", "title": "..." }],
  "brands": ["Example Oy"],
  "answer": "the answer as text or markdown"
}
```

`searches` (the queries the assistant sent to a search engine, often called fan-out queries) and `sources`
are the valuable parts. Not every tool returns the searches. The list stays empty then.

Do not write this file by hand either. Save the tool's answer as JSON, one file per question, and run:

```
node scripts/answers.mjs ai --dir <folder> --file <answer.json> --prompt "<the question>" --engine "ChatGPT"
```

It finds the answer text, the cited sources, the searches and the brands by field name, wherever they sit in
the JSON, and prints how many of each it found. A 0 where the tool's answer clearly has that part means the
tool names it differently: add that part to `chatgpt.json` by hand, copied, not summarised.

### serp-<keyword>.json

```json
{
  "keyword": "aurinkopaneelit hinta",
  "result_types": ["ai_overview", "organic", "people_also_ask"],
  "people_also_ask": ["Paljonko aurinkopaneelien asennus maksaa?"],
  "organic": [{ "rank": 1, "domain": "example.fi", "title": "...", "url": "https://example.fi/" }]
}
```

```
node scripts/answers.mjs serp --dir <folder> --file <serp.json> --keyword "<keyword>"
```

Reads the organic results, the People also ask questions and the result types from the result page JSON of
DataForSEO, SerpApi, SearchApi, HasData, Serper and tools with the same layout.

Use the mobile result page when the tool lets you choose. Most searches are made on phones.

### site.json (optional)

```json
[{ "query": "aurinkopaneelit hinta", "clicks": 12, "impressions": 340, "position": 8.4,
   "page": "https://example.fi/hinta", "source": "Search Console", "period": "1.8.-31.10.2026" }]
```

```
node scripts/import.mjs --site --dir <folder> --file <Queries.csv|answer.json> --source "Search Console" --period "<dates>" --match "<regex>"
```

One row per query and source. Rows of the same query (one per page or per day) are added together: clicks and
impressions are summed, the position is weighted by impressions, and the page is the one with the most
impressions. A new import replaces the earlier rows of the same `--source`.

Reads the Search Console export (Queries.csv), Search Console API rows (`keys`, `clicks`, `impressions`,
`position`), MCP answers with `query` and `page` fields, and the Bing Webmaster Tools export and API
(`Query`, `Impressions`, `Clicks`, `AvgImpressionPosition`). Headers in another language: `--map
"keyword=<header>,clicks=<header>,impressions=<header>,position=<header>,page=<header>"`.
