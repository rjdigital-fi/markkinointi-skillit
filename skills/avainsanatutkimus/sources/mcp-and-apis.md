# Any MCP or API: SEO, SEM and GEO tools

The user chooses the tool. Your job is to map what the tool returns to the shared format in
`sources/overview.md`. The steps are the same for every tool.

## The mapping, step by step

1. **Find the tools.** List the tools the MCP offers and read their descriptions. Without an MCP, read the
   vendor's API documentation. Do not rely on tool names from memory or from this file: they change.
2. **Match them to the five kinds of data** (ideas, volumes and prices, AI volume, AI answers, result page).
   Tell the user which parts this tool covers and which it does not.
3. **Set the market.** Every tool has its own way to name the country and language (a database code like
   `fi`, a location name, a location code). A wrong market gives believable numbers for the wrong country.
   Check one keyword whose size the user knows before fetching everything.
4. **Fetch small first.** One seed, a small limit. Look at the fields that come back and at what the call
   used (credits, units, money). Then fetch the rest.
5. **Save the answer as a file and import it.** Do not retype numbers.

   ```
   node scripts/import.mjs --dir <folder> --file <answer.json> --source "<tool name>" --match "<regex>"
   ```

   Save the answer as the tool returned it. The rows are found wherever they sit in the JSON, and nested
   fields are read. For field names it does not recognise:
   `--map "keyword=<field>,volume=<field>,cpc=<field>"`. For prices in cents: `--cpc-scale 0.01`.
6. **Read the import output.** It prints the fields it found and did not find, and the top rows. Compare three
   rows with the tool's own answer.
7. **AI answers and result pages** go through `scripts/answers.mjs`. Save each answer as a JSON file as it
   came:

   ```
   node scripts/answers.mjs ai   --dir <folder> --file <answer.json> --prompt "<the question>" --engine "<assistant>"
   node scripts/answers.mjs serp --dir <folder> --file <serp.json> --keyword "<keyword>"
   ```

   It prints what it found. When a part is 0 although the answer has it, add that part to the file by hand.
   Copy the text. Do not summarise sources or rewrite questions.

## Notes per tool

Checked against the vendors' pages in November 2026. Only the general shape is given, on purpose. What the
connection in front of you offers is the truth.

### Semrush

- Official hosted MCP with keyword research tools (volume, click price, difficulty, related keywords), an API,
  and CSV exports from Keyword Magic Tool and Keyword Overview.
- The market is a database code per country.
- Volumes and click prices map to `volume` and `cpc`. "Competitive Density" (0 to 1) is advertiser competition
  and maps to `competition`. "Keyword Difficulty" maps to `difficulty`.
- Calls use API units. Check the unit balance tool or page before a large fetch.

### Ahrefs

- Official remote MCP (needs a paid plan) with Keywords Explorer tools: an overview with volume, click price
  and difficulty, related terms, search suggestions and volume history. Also an API and CSV exports.
- The market is a country code.
- Check the unit of the click price in the answer: some Ahrefs fields are in cents. Import with
  `--cpc-scale 0.01` when they are, and compare one keyword with the Ahrefs interface.
- Volume history gives the twelve months for `months`.

### SE Ranking

- MCP and API with tools for keyword metrics in bulk (volume, click price, competition, difficulty and a
  monthly trend), related, similar and long-tail keywords and keyword questions, plus result pages.
- The market is a lowercase database code such as `fi`.
- Competition comes as 0 to 1 and is converted by `import.mjs`. The monthly trend field is read as `months`
  when its entries carry a month and a volume. Check the import output.

### SearchApi

- Official remote MCP and an API. A search result API: Google result pages, Google AI Mode, AI Overview,
  Google Trends and more. It has no search volumes or click prices.
- Use it for parts 4 and 5: result pages with People also ask, and AI Mode or AI Overview answers with their
  sources. Google Trends gives the shape of the season, as an index, not as searches per month. Do not put
  Trends numbers into `volume`.

### HasData

- MCP and API. A scraping API: Google result pages, Google AI Mode, Google Trends and more. It has no search
  volumes or click prices.
- Use it like SearchApi, for parts 4 and 5.

### SerpApi, Serper, Bright Data and other result page APIs

- Same role as SearchApi and HasData: part 5, and part 4 where the API returns Google's AI Overview or AI
  Mode. `answers.mjs serp` reads `organic_results` or `organic`, and `related_questions`, `people_also_ask` or
  `peopleAlsoAsk`.
- For an AI Overview, run `answers.mjs ai` on the same file with `--engine "Google AI Overview"`.

### Google Ads API or a Google Ads MCP

- Keyword ideas and historical metrics, the same data as Keyword Planner. Amounts are in micros
  (`lowTopOfPageBidMicros`), months come as names. `import.mjs` converts both.
- Without ad spend on the account the volumes are ranges. The import says so.

### Microsoft Advertising

- Its Keyword Planner gives Bing volumes and a suggested bid. Name the source "Microsoft Advertising" so that
  Bing volumes are not read as Google volumes, and keep them in their own folder or report.

### Moz, Mangools, Ubersuggest, Serpstat, SISTRIX, Keywords Everywhere

- Use the keyword export (CSV), or the API or MCP when the tool has one. The usual columns are recognised.
- Two columns are easy to confuse: a paid or PPC difficulty is advertiser competition (`competition`), an
  SEO or keyword difficulty is `difficulty`. Check the import output.

### AI visibility trackers (GEO tools)

- Tools such as Peec AI, Profound, Otterly, LLM Pulse, Nightwatch, SE Ranking AI Search, Semrush AI
  visibility and Ahrefs Brand Radar track prompts over time. What they expose differs. Look for a tool or an
  export that returns, per prompt and assistant, the answer with its sources and the brands named.
- Use prompts that are already tracked, or add the research questions when the user agrees (tracked prompts
  can use the plan's quota). Save each answer and run `answers.mjs ai`.
- Aggregates (visibility share, average position) do not fit the shared files. Report them in a section of
  their own, with the tool named.

### Cloro

- API. Returns real answers from AI assistants (ChatGPT, Gemini, Perplexity, Copilot, Google AI Mode, AI
  Overview) as structured data with sources. It has no search volumes.
- Use it for part 4. Ask each question once per assistant and set `engine` in `chatgpt.json`. Keep the
  country setting the same as the rest of the research.
- When the answer includes the searches the assistant ran, save them in `searches`.

### Google Search Console and Bing Webmaster Tools

- For step 5, the site's own data. Search Console: queries with impressions, clicks and position. Bing
  Webmaster Tools: the same for Bing, and its AI Performance report shows a sample of the queries with which
  AI fetched the site's content.
- These are the user's own numbers. Keep them out of `keywords.json` (they are not market volumes) and report
  them in their own section.

### Something else

Follow the seven steps above. A tool is usable for part 2 when it gives, per keyword and per country, a
monthly volume. A click price is needed for the budget split. Without it the split cannot be made, and the
report says so.
