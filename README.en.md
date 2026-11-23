# RJ Digital skills

Free skills for Claude Code and other AI agents that read skills. A skill is a set of instructions an agent follows to do a job step by step.

Suomeksi: [README.md](README.md)

## Avainsanatutkimus (keyword research)

Runs a keyword research for one topic with real data and returns a report you can act on: which pages to build and where an ad budget should go. It works in any language and market. The agent answers in your language, and the report is written in Finnish or English.

The report holds:

- a topic map of the branches of the topic
- keywords in groups with search volume, click price, competition and search intent
- twelve months of seasonality for the main keyword
- a suggested budget split between the groups
- what AI assistants answer to a buyer's questions, which searches they run and which sources they use
- what the Google result page shows: AI Overview, People also ask and the top results

The method is the one in the guide [Avainsanatutkimus](https://rjdigital.fi/oppaat/avainsanatutkimus) (in Finnish). Example output: [examples/aurinkopaneelit/report.md](examples/aurinkopaneelit/report.md).

### Bring your own data source

The skill is not tied to one tool. The agent looks at what you have connected, tells you what each source covers and asks which to use. Sources can be mixed, for example volumes from Semrush and AI answers from Cloro.

| Source | What it gives | How to connect |
| --- | --- | --- |
| SEO tools: Semrush, Ahrefs, SE Ranking, Moz, Mangools, Ubersuggest, Serpstat, SISTRIX, Keywords Everywhere | keywords, volumes, click prices | the tool's MCP, API or a CSV export |
| DataForSEO | every part of the report | API login or MCP, a ready script is included |
| Ad platforms: Google Keyword Planner, Google Ads API, Microsoft Advertising | keywords, volumes, bid range or suggested bid | CSV export, API or MCP |
| Result page APIs: SearchApi, SerpApi, HasData, Serper, Bright Data | Google result pages and Google's AI answers | MCP or API |
| AI visibility tools: Cloro, Peec AI, Profound, Otterly, LLM Pulse, Nightwatch and others | answers from AI assistants with sources and the brands named | MCP, API or an export |
| Anything else | whatever the tool returns | the agent reads the tool's description and maps the fields |

Only keywords and volumes are required. Parts no source covers are left out of the report, and the agent says so.

What has been tested: DataForSEO end to end with a real run in November 2026. The import for the other tools is tested with sample files built from each tool's column and field names. The tests are included: `node tests/run.mjs`. Not every tool has been run with a real account, and tools change their exports, so the import always prints which fields it found and which it did not. Excel files are not read: export CSV. Please open an [issue](https://github.com/rjdigital-fi/skills/issues) if something does not work.

### Install

In Claude Code:

```
/plugin marketplace add rjdigital-fi/skills
/plugin install rjdigital@rjdigital-fi
```

Or without the plugin: copy the folder `skills/avainsanatutkimus` into your `~/.claude/skills/`.

The scripts need Node.js 18 or newer and nothing else.

### Use

```
Do a keyword research for solar panels. We install panels on houses in Tampere and Turku. The budget is 1,000 euros a month.
```

Or call it directly: `/rjdigital:avainsanatutkimus`.

The result is saved in `avainsanatutkimus/<topic>/`: `report.md` and `keywords.csv`.

### Good to know

- Search volumes are estimates by the source. Tools give different numbers for the same keyword, so compare numbers within one source.
- Paid sources use credits or money. The agent gives an estimate before the first call and the real cost at the end. The calls for the example report cost about 0.15 US dollars in DataForSEO.
- API keys stay in environment variables or in the MCP connection. They are not written into the chat or into files.
- The budget split is a starting point from volume, click price and intent. Real campaign data replaces it after the first weeks.

## Author

Joonas Rotko, [RJ Digital](https://rjdigital.fi).

## License

MIT.
