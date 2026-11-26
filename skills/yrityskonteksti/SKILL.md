---
name: yrityskonteksti
description: Brand, target group and company context for one business, written once into three plain files that every other skill and agent reads first - who the company is and what it sells at what price, who it sells to and who it does not, how it sounds and looks. Reads the company's own website and own texts, asks the owner only what cannot be read, marks every fact as confirmed, derived or open, and builds a slide report in the company's own colours. Use when the user asks for yrityskonteksti, brändi, brändikirja, äänensävy, tone of voice, kohderyhmä, ICP, ideal customer profile, asiakasprofiili, positioning, brand guidelines for AI, company context, "teach the AI our business", or before any marketing work for a company whose context files do not exist yet.
---

# Brändi, kohderyhmä ja yrityskonteksti (brand, target group and company context)

You write down what a business is, who it sells to and how it sounds and looks, so that no later task has to ask
again. The result is three text files and one `brand.json` in one folder, and a slide report the owner can read
and approve.

The files are the product. The report is how the owner checks them.

## Rules

- Answer in the user's language. File names, headings and the report follow it (Finnish names by default,
  English names when the user works in English).
- Read first, ask second. Never ask something the website, the given texts or the project already answers.
  Draft from what you read, then ask the rest.
- Every fact carries one marker, in square brackets, on the same line:
  `[vahvistettu: lähde]` / `[confirmed: source]` is the owner's own word or decision, or a source the owner approved.
  `[päätelty: lähde]` / `[derived: source]` is what you read or concluded and nobody has confirmed yet.
  `[auki]` / `[open]` is missing. The cell stays empty.
- Never fill a gap with a guess, an industry average or what companies like this "usually" do. An open item is a
  good result: it is the next question. This matters most for prices, numbers, promises and customer quotes.
- A thing you read on the website is derived until the owner says it is still true. Websites go out of date.
- Keep the owner's real numbers, hedges and limits as they said them. "Noin 380" stays "noin 380". Do not round
  up, do not sharpen a careful claim into a bold one.
- Customer quotes are real sentences from real customers, with the source. Never write one yourself.
- Do not judge or rank competitors. Write what the customer compares the company with, in neutral words.
- LinkedIn and other social media are optional. Read them only from what the user gives you: their own data
  export, a profile saved as PDF, pasted text or direct links to single public posts. Never open a social media
  site through the user's logged-in browser, and never ask for a password or session.
- Only public pages are fetched from the website, without logging in. Nothing is sent to any other service.
- Do not copy another company's brand book, voice rules or wording into these files.
- The report is the user's to restyle. Tell them once that it already uses their own colours from `brand.json`,
  and that the footer credit can be changed or left empty there.

## Files

Work in one folder, by default `yrityskonteksti/` in the current project (one company per project). For an
agency with several clients use `yrityskonteksti/<company-slug>/`. The folder can live in a git repository, a
shared drive folder or anywhere the team can open it. Git is not required.

| File (Finnish / English) | Content |
| --- | --- |
| `yritys.md` / `company.md` | what the company sells, to whom, at what price, why customers buy, what it does not promise or do |
| `kohderyhma.md` / `audience.md` | who it does not sell to, the customer groups, the customer's own words, best and worst customers |
| `brandi.md` / `brand.md` | the brand in one sentence, voice rules with real example sentences, vocabulary, form of address, how colours, font and logo are used |
| `brand.json` | name, logo, font and colours in a form a script can read. The other skills take the look of their reports from here |
| `raw/site.json`, `raw/texts.json`, `raw/voice-stats.json` | what the scripts read. Kept so that a rerun is not needed |
| `kuvataulu.html` / `image-board.html`, `raw/images.json`, `raw/images/` | the image board: the company's own pictures with numbers, the list behind it with the owner's answers, and the picture files |
| `status.json` | what `check.mjs` counted |
| `report.html`, `report.md` | the result: slides in one HTML file, and the same as text |

Templates for the three files are in `templates/` next to this file. A finished example is in the repository
folder `examples/yrityskonteksti/`.

Scripts are in `scripts/` next to this file. They need Node 18 or newer and nothing else.

- `scripts/site.mjs` reads the front page, up to 7 key pages and the stylesheets of a website, and writes
  `raw/site.json` with the texts, the colours and fonts in use and a first guess for `brand.json`.
- `scripts/texts.mjs` reads the company's own writing from local files (text, Markdown, CSV, LinkedIn's own
  export `Shares.csv`) and writes `raw/texts.json` and `raw/voice-stats.json`: sentence length, form of address,
  emojis, exclamation marks, common openings.
- `scripts/images.mjs` collects the pictures of the pages in `raw/site.json` and of an optional local folder,
  shows near-identical pictures once, leaves icons, logos and badges off, and builds the image board. It also
  records the owner's answer.
- `scripts/check.mjs` checks the files and writes `status.json`. `--strict` exits with 1 when the format is broken.
- `scripts/report.mjs` builds `report.html` and `report.md`. It makes no network calls.
- `scripts/core.mjs` is the shared logic.

## Format of the three files

Start each file from its template. The check reads this format, so keep it:

- Frontmatter: `company`, `owner` (the person who approves the file) and `reviewed` (the date the owner last read
  and approved it, `YYYY-MM-DD`). Leave `reviewed` empty until the owner has actually read the file.
- Facts are list items or table rows. One fact per line, one marker per line, at the end of the item or in the
  last column of the row.
- Required sections (the heading may be worded freely as long as the key word stays):
  - company: in short (`lyhyesti`), offer and prices (`tarjooma`, `hinnat`), why customers buy (`miksi`), what is
    not promised or done (`ei luvata`, `ei tehdä`)
  - audience: who we do not sell to (`ei myydä`), at least one group (`ryhmä`), the customer's own words (`omat sanat`)
  - brand: voice (`ääni`), vocabulary (`sanasto`), look (`ulkoasu`)
  - English headings: In short, Offer and pricing, Why customers buy, What we do not promise or do, Who we do not
    sell to, Segment, In the customer's own words, Voice, Vocabulary, Look.
- A voice rule is a `###` heading with three list items: `Tarkoittaa:` (Means:), `Ei tarkoita:` (Does not mean:)
  and `Esimerkki:` (Example:). The example is a real sentence the company has written or said, and it carries
  the marker. A rule without a real example is not a rule yet: mark the example `[auki]`.
- Free sections need no markers and are left out of the report: `Opit` (Learnings), `Muutokset` (Changelog),
  `Kysymykset` (Questions), `Lähteet` (Sources). Add a line to `Muutokset` every time a file changes, and a row
  to `Opit` when the work shows something new about the customers.

## Step 0: what exists already

Before asking anything:

1. Look for an existing folder (`yrityskonteksti/`), and for files that already hold the same things: a brand
   book, tone of voice guide, ICP or positioning document, `CLAUDE.md`, `AGENTS.md`, `brand.json`, a pricing page.
   If the folder exists, run `check.mjs`, show what is open and continue from there. Do not start over.
2. Ask in one message for what you cannot find:
   - the website address (required, or pasted text if the site cannot be fetched)
   - who owns these files, that is, who approves them
   - optional material, each one clearly optional: own texts the owner is happy with (newsletters, posts, offers,
     emails), LinkedIn's own data export or a profile PDF, notes from won and lost deals, an existing brand
     guide, customer feedback or reviews
3. Say what you will do with it and what you will not: you read public pages only, the files stay on their
   computer, and social media is read only from the files they hand over.

## Step 1: read

```
node scripts/site.mjs --url https://example.fi --dir yrityskonteksti
node scripts/texts.mjs --dir yrityskonteksti path/to/Shares.csv path/to/newsletters.md
```

- Read `raw/site.json` yourself in full: the page texts are the main source for the first draft.
- If the site cannot be fetched, the script says so. Ask the user to paste the text of the front page, the
  service or product pages, the pricing page and the about page into `raw/site.txt`, and read that.
- If key pages are missing from what the script picked (pricing, services, about, references), fetch them
  with `--max` raised or ask for the addresses.
- `texts.mjs` is run only when the user gave texts. With fewer than about 10 texts the numbers are thin:
  say so and treat them as a hint.
- Tell the user where the LinkedIn export is, if they want to use it: LinkedIn settings, Data privacy, Get a
  copy of your data, Posts. The file is `Shares.csv`. It takes LinkedIn from minutes to a day to deliver.

## Step 2: first draft

Copy the three templates into the work folder and fill in what the material supports.

- Everything read from the site or the texts is `[päätelty: verkkosivu /sivu]` with the page or file as the source.
- Everything else is `[auki]`. Expect the first draft to be mostly derived and open. That is correct.
- Voice: pick 3 to 5 rules that the texts actually show, and take each example sentence word for word from the
  material. Use the numbers in `raw/voice-stats.json` for form of address and sentence length, with the count of
  texts as the source.
- Look: take the colours and font from `brandSuggestion` in `raw/site.json`, write `brand.json` in the work
  folder, and write the usage rules (which colour where, and where not) into the look table as open questions.
  The values come from the site, the rules come from the owner.
- Run `check.mjs`, fix what breaks the format, and build the first report so the owner sees something concrete:

```
node scripts/check.mjs --dir yrityskonteksti
node scripts/report.mjs --dir yrityskonteksti
```

## Step 3: the interview

Now ask the owner. This is where the files become worth having.

- Ask in batches of 3 to 5 questions, one file at a time, in this order: company, audience, brand.
- Start each batch by showing what you already wrote and asking only: is this still true, and what is missing.
- Give an example answer with every question so the owner sees the level of detail you need. Make it plainly an
  example from another kind of business, never a suggested answer for theirs.
- Dictated or messy answers are welcome. Say so. Sort the answer yourself and show the result.
- Save the file after every batch, with the markers updated. Do not hold answers in the conversation.
- When an answer is vague, ask once for a number, a name or a real case. If it stays vague, write it down as
  said and mark it derived.

Questions that give the most:

- **Customers before the ideal customer.** Ask for the three best customers of the past year and what they had
  in common, then the three worst or the three lost offers and why. Write the groups from those. Ask "who is
  your ideal customer" only if the cases do not show it.
- **Who you do not sell to.** Size, industry, budget, behaviour. This section comes first in the audience file.
- **The customer's own words.** What does the customer say on the first call, word for word? What do they type
  into a search or ask an AI? Take sentences from the contact forms, emails and reviews the owner gives you.
- **Prices.** What is public, what is said only in an offer, what must never be published. Mark each.
- **Proof.** For every reason to buy: what is the proof, and may it be used in public? A number without
  permission is derived, not confirmed.
- **What is not promised.** Results, schedules and guarantees the company refuses to promise.
- **Voice by choosing.** Take one real sentence from their own site and rewrite it three ways (for example
  shorter and more direct, warmer, more expert). Ask which is closest and what is wrong with the other two.
  Their answer is the rule. Repeat with two or three sentences. Do not ask them to describe their tone in
  adjectives.
- **Words.** Which words do they always use, which never, and what do customers call the thing.
- **Look.** For each colour: where is it used, where never. One accent per view or several? Is there a dark
  version? What must never be done with the logo?

- **Pictures.** Do not ask the owner to describe a picture style. Show the image board (next section) and let
  them choose.

After the interview, every answer the owner gave is `[vahvistettu: haastattelu <date>]`. Things they skipped
stay open.

## The image board

Owners cannot describe a picture style in words, but they know at once which of their own pictures look like
the company. So the picture rule is written from choices, the same way as the voice.

```
node scripts/images.mjs --dir yrityskonteksti
node scripts/images.mjs --dir yrityskonteksti --folder path/to/own/pictures
```

1. Run it after `site.mjs`. It reads the pictures of the same pages. `--folder` adds the owner's own picture
   folder (photo shoot, social media pictures) and works alone when there is no website. `--max` sets how many
   pictures the board holds (18 by default). When there are more, the script takes them in turns from each page
   and the folder, and `raw/images.json` lists the rest under `left`.
2. Look at every picture on the board yourself before the owner sees it (the files are in `raw/images/`). Then
   edit `raw/images.json`:
   - Write each `label` as a short neutral description of what is in the picture ("Työpöytäkuva, tumma tausta").
     Never a judgement, and never a guess about who the people are.
   - Set `"show": false` on pictures that are not the company's own brand pictures: another company's logo,
     product shot or screenshot, a customer's material, a payment or certificate mark, a map. The script
     removes most of these by size and name, the rest is yours.
   - If two pictures on the board are still nearly the same, hide one. If a whole kind of picture is missing
     (for example no photo of people although the site has them), move one in from `left`.
   - Rebuild with `node scripts/images.mjs --dir yrityskonteksti --board`.
3. Open the board, check it, and give the owner the file. Ask for three lists of numbers: good, not used,
   cannot say. No reasons needed.
4. Record the answer exactly as given:
   `node scripts/images.mjs --dir yrityskonteksti --good 2,5,6 --no 1,4 --unsure 3`
   The script names the pictures the owner did not mention. Ask about those separately, once. A picture nobody
   mentioned is not approved and not rejected.
5. Ask where the pictures come from, in one message: who took or made the approved pictures and may they be
   used everywhere (site, social media, ads), are any of them made with AI, and are AI-made pictures acceptable
   in the future and on what condition. Do not guess whether a picture is AI-made or a stock photo from how it
   looks. Ask.
6. Write the result under `Kuvat` / `Pictures` in the brand file:
   - one line per approved kind of picture and one per kind that is not used, each with a file under
     `raw/images/` as the example and the marker `[vahvistettu: kuvataulu <date>]`
   - the answers about origin, rights and AI-made pictures, confirmed
   - a rule proposal that says what the approved pictures share and the rejected ones lack (subject, setting,
     light, colour, cropping, people posed or at work). The rule is your reading of the choices, so it is
     `[päätelty: kuvataulun valinnat <date>]` until the owner says it is right. With fewer than about five
     answered pictures say that the rule is provisional.
7. The report shows the choices on their own slide. Small picture files are written into the report itself,
   large ones are linked from `raw/images/`.

If the site has almost no pictures of its own and the owner gives no folder, skip the board and leave the
picture lines open. Do not build a board from stock photos or from other companies' pictures.

## Step 4: check, report, approval

```
node scripts/check.mjs --dir yrityskonteksti
node scripts/report.mjs --dir yrityskonteksti
```

- `check.mjs` prints a state for each file: ready, draft (open items or not yet read by the owner), fix (the
  format is broken) or missing. Fix everything under "fix" before showing the report.
- `report.mjs` uses the company's own `brand.json`. Options: `--lang fi|en`, `--note "text for the cover"`,
  `--out <file>`.
- Open the report and look at it before handing it over.
- Ask the owner to read the three files or the report. Only when they have, set `reviewed` to that date. Never
  set it yourself on their behalf.

Then give a short summary:

1. Where the files are and how many facts are confirmed, derived and open.
2. Which sources were read and which were skipped or not given (for example "LinkedIn: not given").
3. The open questions, most important first.
4. How the files are used: every later task reads them first, a change is made in the file and noted under
   `Muutokset`, and the owner reads them again every six months (the check reminds after 180 days).

## Keeping the files alive

- When any task shows that a fact is wrong or new, correct the file, change the marker and add a line to
  `Muutokset`. Do not keep a private correction in the conversation.
- New things learned about customers go to `Opit` with the date and the source.
- When the offer, the prices or the target group change, rerun steps 3 and 4 for that file only.
- Other skills in this plugin read this folder first. If you are about to ask the user about their company,
  customers, tone or colours, check here before asking.
