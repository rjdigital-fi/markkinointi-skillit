---
name: tekoalynakyvyys
description: AI visibility check with real answers, step by step - asks the questions a buyer would ask from ChatGPT, Gemini, Google AI Mode and Perplexity, and reports whether the company is named, which companies are named instead, which sites the answers lean on and what the AI said. The user picks the data source - DataForSEO (ready-made script), or any connected AI visibility tool, MCP, API or export (Cloro, Peec AI, Profound, Otterly, SerpApi, SearchApi, HasData, ...). Use when the user asks for tekoälynäkyvyys, tekoälynäkyvyyden kartoitus, AI visibility, GEO or AEO audit, LLM visibility, "does ChatGPT mention us", "mainitseeko ChatGPT meidät", AI share of voice, or which sources AI cites for a topic.
---

# Tekoälynäkyvyys (AI visibility check)

You find out whether AI assistants name one company when a buyer asks for a recommendation, and hand back a
report: a question by AI table, the companies named instead, the sites the answers lean on, and what was said.

A quick three-question version of the same check runs as a free tool at https://rjdigital.fi/tekoalynakyvyys-testi.
This skill is the full version: as many questions as needed, each asked several times.

## Rules

- Answer in the user's language. The report language follows it (`--lang fi` or `--lang en`).
- Every number comes from saved answers. Never guess what an AI "would probably say", and never fill a missing
  answer from your own knowledge. If an AI gave no answer, the cell stays empty and you say so.
- Questions go to the AIs without the company's name. A question with the name in it measures nothing.
- The result is a snapshot. The same question gets a different answer on another day. Say this in your summary,
  and do not read meaning into small differences: with a few dozen answers, a change under about 10 percentage
  points is noise.
- Keep the question set fixed between runs. A new question set is a new baseline, not a trend.
- A cited URL alone is not a mention. "Named" means the company's name is in the answer text. "Cited" means its
  site is among the sources. Report the two separately.
- Paid calls: tell the user what the run will cost before the first paid call and what it cost at the end.
  Fetch once and reuse the saved files.
- Never print, log or commit API keys. Read them from the environment or let the MCP connection hold them.
- Do not judge or rank the companies in the answers. Report what the answers show.
- The report is the user's to restyle. Tell them once that the look (name, colours, font, logo) lives in
  `brand.json`, and offer to set it to their own brand.

## Files

Work in one folder per check, by default `tekoalynakyvyys/<company-slug>/` in the current project.

| File | Content |
| --- | --- |
| `brief.json` | company, domain, name variants, questions, AIs, runs, confirmed competitors, names that are not companies |
| `answers.json` | every answer: question, engine, run, text, sources, the searches the AI ran, brands |
| `raw/` | raw responses of the DataForSEO script, so a rerun costs nothing |
| `result.json` | the analysis |
| `report.html`, `report.md` | the result: slides in one HTML file, and the same as text |
| `brand.json` | optional: the look of the report for this folder |

Scripts are in `scripts/` next to this file. They need Node 18 or newer and nothing else.

- `scripts/dataforseo.mjs` asks the questions through DataForSEO: `estimate` prints the cost, `fetch` saves the answers.
- `scripts/answers.mjs` brings one answer from any other tool into `answers.json`.
- `scripts/analyze.mjs` reads `brief.json` and `answers.json`, writes `result.json` and prints a summary.
- `scripts/report.mjs` builds `report.html` and `report.md`. It makes no network calls.
- `scripts/core.mjs` is the shared logic: name detection, counting, question templates.

## Step 0: the brief and the data source

Ask only what you cannot see from the conversation or the project:

1. Company name and website. Other names people use for it (short name, old name, product name).
2. What it sells, to whom, and where. Local business: which towns.
3. Market: country and language of the buyers.

Then choose the data source with the user:

1. Look at what is connected: MCP tools in this session (DataForSEO, Cloro, an AI visibility tracker, a result
   page API), API keys in the environment (names only, never values), export files in the folder.
2. Tell the user what you found and ask which to use. What matters is that the answers come from the real
   apps with web search on, with sources. A plain model API without search answers from memory and is a
   weaker stand-in: say so if that is all there is.
3. DataForSEO covers everything with the ready-made script. Per answer about $0.004 (Perplexity about $0.007).
   Other tools: fetch each answer with the tool and bring it in with `answers.mjs`.

## Step 1: the questions

Write 8 to 15 questions the way a buyer would type them to an AI: whole sentences, in the buyer's language,
with the town when the business is local. Cover the buying path:

- about a third finding a provider: "Which company installs ... in ...? Recommend a few."
- about a third comparing: "Compare ... providers in ... Who would you pick and why?"
- the rest price and problem questions that end in a choice: "What does ... cost and who should I order it from?"

No company names in the questions. Show the list to the user and let them edit it: they know how their
customers talk. `templateQuestions()` in `core.mjs` gives a starting set if you need one.

Write `brief.json`:

```json
{
  "company": "Example Oy",
  "domain": "example.fi",
  "aliases": ["Example"],
  "sells": "what they sell",
  "area": "Tampere",
  "buyer": "who buys",
  "market": { "location_code": 2246, "language_code": "fi", "country": "FI" },
  "engines": ["chatgpt", "gemini", "aimode"],
  "runs": 2,
  "questions": ["..."],
  "competitors": [],
  "notCompanies": []
}
```

`runs` is how many times each question is asked from each AI. Use 2 or 3: one run cannot tell "always named"
from "named this once". Engines: `chatgpt`, `gemini`, `aimode`, `perplexity`.

## Step 2: fetch the answers

With DataForSEO (credentials in `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`):

```
node scripts/dataforseo.mjs estimate --dir <folder>
node scripts/dataforseo.mjs fetch --dir <folder>
```

Tell the user the estimate and wait for a yes before `fetch`. One answer can take a couple of minutes. The
script prints which answers failed: run `fetch` again, and only the missing ones are asked.

With any other tool, save each answer as it came (JSON, or plain text as .txt or .md) and run:

```
node scripts/answers.mjs --file answer.json --question "the question" --engine chatgpt --run 1 --dir <folder>
```

Read the printed summary every time. A 0 for sources means the tool names that field differently: add the
sources to `answers.json` by hand.

## Step 3: analyze, then read

```
node scripts/analyze.mjs --dir <folder>
```

The script finds the company by name and by domain, and collects other names from the answers. Each name has
its evidence: given in the brief, listed as a brand by the data source, matching a cited domain, or only
bold or heading text. The last kind is a guess and lands in `unconfirmed` in `result.json`.

Now do the part a script cannot do. Read the answers:

1. Sort every `unconfirmed` name: a real competing company goes to `competitors` in `brief.json`, anything
   else (a product type, a brand of equipment, a marketplace, a town) goes to `notCompanies`. Check the
   confirmed list the same way and move what does not belong.
2. Check a few "named" and "not named" cells against the text. If the company is named under a variant you
   did not list, add it to `aliases`.
3. Run `analyze.mjs` again. Repeat until `unconfirmed` is empty or holds only names you cannot place, and
   tell the user about those.

Note for yourself what kind of mentions these are: recommended first, one in a list, or only mentioned in
passing. Note which sites carry the answers: the company's own, competitors', comparison sites, forums.

## Step 4: the report

```
node scripts/report.mjs --dir <folder> --lang fi
```

Options: `--note "..."` adds a line to the cover (use it for the data source and date), `--brand "NAME"`
overrides the name for one run, `--out` changes the file name.

The look comes from `brand.json`: first the one in the work folder, else the one in the skill folder. To
restyle, copy the skill's `brand.json` to the work folder and change the name, colours, font (`font` and the
web font address `fontUrl`) and logo, then run `report.mjs` again. Offer this to the user. If they give a
website, read its colours and font from there and confirm before you save.

The report shows the site icon of each company, source and AI. The icons load from Google's favicon service
when the report is opened, so the reader's browser contacts Google. `"icons": false` in `brand.json` or
`--icons off` leaves them out and shows first letters. `"icons": "ai"` or `--icons ai` keeps only the icons of
the AIs: use it when the companies are made up.

Then tell the user, in a few sentences:

- in how many answers the company was named and in how many its site was cited, per AI
- who is named most, and which sites the answers lean on
- which questions are the weakest
- that this is a snapshot, how many times each question was asked, and what the run cost
- that the same questions can be asked again later for comparison, and that the question set must stay the same

Do not turn the report into a list of quick fixes. What to do about the result depends on the business and is
a separate piece of work.
