# DataForSEO

Covers all five kinds of data. Pay as you go. Tested with this skill in November 2026.

Two ways to use it. Both give the same data.

## A. The script (API key in the environment)

The user sets their own API login and password (DataForSEO dashboard, API access) in the environment:

```
export DATAFORSEO_LOGIN="..."
export DATAFORSEO_PASSWORD="..."
```

Never ask the user to paste them into the chat, and never print them. Check that they work (a free call):

```
node scripts/dataforseo.mjs check
```

Then, with `--dir <folder>` on every call. The market is set with `--location` (a country name in English as
DataForSEO lists it, or a location code) and `--language` (a code). The defaults are Finland and fi.

```
# step 2: ideas with volumes, prices and months. Up to 20 seeds per call, more seeds make more calls.
node scripts/dataforseo.mjs ideas --dir <folder> --seeds "seed one;seed two;seed three" --match "<regex>"

# step 2: exact numbers for your own list, for example town phrases
node scripts/dataforseo.mjs volumes --dir <folder> --keywords "service town1;service town2"

# step 4: AI search volume for the largest keywords
node scripts/dataforseo.mjs ai-volume --dir <folder> --top 300

# step 4: real ChatGPT answers. prompts.json is a JSON array of questions
node scripts/dataforseo.mjs chatgpt --dir <folder> --prompts <folder>/prompts.json

# steps 3 and 4: the Google result page on mobile, with People also ask
node scripts/dataforseo.mjs serp --dir <folder> --keyword "main buying keyword"
```

Each command prints what it cost and saves the raw answer in `<folder>/raw/`. A rerun with the same input
reads the saved answer and costs nothing. Use `--fresh` to fetch again.

What the test run of this skill cost (one topic, Finland, November 2026): ideas for six seeds 0.09 USD, AI
volume for 300 keywords 0.04 USD, two ChatGPT answers 0.008 USD, one result page 0.0023 USD. Prices change.
The current ones are on dataforseo.com. Tell the user the cost the script prints, not these numbers.

Notes on the data:

- Volumes, click prices and bids come from Google Ads data. Prices are always in US dollars: the
  request takes no currency. Set `"currency": "USD"` in `groups.json` and run `rate.mjs` so the report shows euros.
- `--match` keeps only keywords that fit the regex. Use the stem of the topic, for example `aurinko`.
- AI search volume is DataForSEO's own estimate and does not exist for every language and country. When the
  call returns nothing, leave the column out.

## B. The DataForSEO MCP

When a DataForSEO MCP is connected, call the same endpoints through it and save each answer as a JSON file.
Then import:

```
node scripts/import.mjs --dir <folder> --file <answer.json> --source "DataForSEO MCP"
```

Endpoints (POST, the body is an array with one task):

| Data | Path | Task body |
| --- | --- | --- |
| ideas, volumes, prices | `/v3/keywords_data/google_ads/keywords_for_keywords/live` | `keywords` (max 20), `location_name` or `location_code`, `language_code`, `sort_by: "search_volume"` |
| exact volumes | `/v3/keywords_data/google_ads/search_volume/live` | `keywords` (max 1000), location, language |
| AI volume | `/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live` | `keywords`, location, language |
| ChatGPT answer | `/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced` | `keyword` (the question), location, language |
| result page | `/v3/serp/google/organic/live/advanced` | `keyword`, location, language, `device: "mobile"`, `people_also_ask_click_depth: 2` |

`import.mjs` reads the keyword answers as they are (`search_volume`, `cpc`, `low_top_of_page_bid`,
`monthly_searches`). For ChatGPT answers and result pages, save the answer as JSON and run
`scripts/answers.mjs` (see `sources/overview.md`). It reads the searches from `fan_out_queries`, the sources
from `sources` and the brands from `brand_entities`.
