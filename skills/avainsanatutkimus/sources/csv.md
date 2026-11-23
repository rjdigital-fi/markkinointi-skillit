# Export files (CSV)

For users with no MCP or API connected. Any keyword export works: Google Keyword Planner, Microsoft
Advertising, Semrush, Ahrefs, SE Ranking, Moz, Mangools, Ubersuggest, Serpstat, Keywords Everywhere or
another tool. The user exports, you import.

## What to ask the user for

Give them the seed phrases from the topic map (step 1) and ask them to:

**Google Keyword Planner** (free with a Google Ads account, no running campaign needed)

1. Google Ads, Tools, Keyword Planner, "Discover new keywords".
2. Enter the seeds (ten at a time), and set the country and language.
3. Download the keyword ideas as a CSV file. Repeat for the remaining seeds.
4. For exact volumes of a ready list (town phrases), use "Get search volume and forecasts" and download.

Without ad spend on the account, Keyword Planner shows volumes as ranges (for example 1K to 10K). The export
then has no exact numbers. Tell the user. The research can still group keywords, but a budget split from
ranges is too rough to give in euros.

**An SEO tool**: export the keyword list for the seeds with volume and click price columns, for the right
country.

## Import

```
node scripts/import.mjs --dir <folder> --file <export.csv> --source "Google Keyword Planner" --currency EUR --match "<regex>"
```

- Reads comma, semicolon and tab separated files, UTF-8 and UTF-16 (Keyword Planner's format), with or without
  title rows above the header.
- Numbers may be written `1,000`, `1 000`, `1.000,5` or `0,45`.
- Recognised columns include: Keyword, Avg. monthly searches, Search Volume, Volume, Monthly Volume, CPC,
  Suggested bid, Competition, Competition (indexed value), Competitive Density, PPC, Paid Difficulty, Keyword
  Difficulty, SEO Difficulty, Intent, Top of page bid (low range) and (high range), and month columns like
  "Searches: Jan 2026".
- Global volume, traffic potential and trend percentage columns are left out on purpose.
- Spreadsheet files (.xlsx) are not read. Ask for CSV.
- Headers in another language or from another tool: `--map "keyword=<header>,volume=<header>,cpc=<header>"`.
- Several files can be imported one after another. Rows merge by keyword.
- Set `--currency` to the currency of the export (Keyword Planner uses the account's currency), and the same in
  `groups.json`.

Read the output. It lists the columns found and not found, and the largest rows. If `volume` is not found,
open the first lines of the file, find the right header and use `--map`.

Keyword Planner gives a bid range (low and high top of page bid) and no single click price. The report uses
the midpoint of the range as the click price and shows the range in its own column.

The import is tested with sample files built in the export layout of each tool named above (`tests/run.mjs`),
not with every tool's real export. Vendors rename columns. When a file does not import cleanly, look at its
header row and map it.
