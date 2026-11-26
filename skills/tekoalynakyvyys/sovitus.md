# Sovitus omaan tilanteeseen (fit to this company)

The skills are made for Finnish service companies. Service companies still differ a lot: a local installer
with one town, a chain with twenty locations, a B2B firm with a long sales cycle, or an agency doing the work
for its clients. Before the brief, find out which one is in front of you, from what you already know, and fit
the work to it.

If the company is not a service company at all (an online shop, a software product, a media site), say so in
one line, do the work as well as the method allows, and name the parts that do not fit it.

This file is the same in every skill of this plugin. What each skill changes is in its own `SKILL.md`.

## 1. Read what you already have

Do not ask first. The agent the user works with usually knows the company already. Look at:

- `yrityskonteksti/tilanne.md` (or `situation.md`). If it exists, read it, check that it still fits what you see,
  and go to step 4.
- The other files in `yrityskonteksti/`, if the folder exists.
- Your own standing context: `CLAUDE.md`, `AGENTS.md` and the files they point to, your memory, project
  instructions, earlier notes about the company.
- The project: README, strategy, brand, ICP or positioning documents, a content plan, the site's own code and
  content if this is the site's repository, client folders.
- Connected tools, by name only: an ad platform, a shop, a CRM, a booking system, analytics, an SEO tool. They
  tell how the company sells and what it already measures. Never read or print key values.
- Earlier results of these skills in the project.

If there is nothing to read (an empty folder, a new conversation), there is no profile to show yet. Ask three
things: what do you sell and to whom, where, and are you doing this for your own company or for a client. Put
them in the same message as the questions of the skill's own brief, and leave out any brief question that asks
the same thing. Write the profile from the answers (step 2), and tell what you fitted in your next message
instead of step 3.

## 2. Write the profile

Write `yrityskonteksti/tilanne.md` (English: `situation.md`), short, one fact per line. Every line carries the
same markers as the other context files: `[vahvistettu: ...]` only for what the user has said or approved,
`[päätelty: <where you read it>]` for what you read, `[auki]` for what you do not know. Never fill a line by guessing.

- The folder is `yrityskonteksti/` at the root of the project, also when the skill keeps its own results in
  another folder. For client work see section 5.
- Write the file in the user's language. Put the date you wrote it on the first line.
- What you read in `CLAUDE.md`, memory or a document is `[päätelty]` until the user confirms it in this
  conversation, also when the user wrote that document.
- A line can hold a known part and an open part: mark each part with its own marker.
- A `yrityskonteksti/` folder that holds only this file is not yet the company context. The skills still treat
  `yritys.md`, `kohderyhma.md` and `brandi.md` as missing.

| Line | Typical values |
| --- | --- |
| Who uses the skill | owner, in-house marketer, agency or freelancer working for a client |
| Whose company the work is about | this company, or a named client |
| What kind of business | local service in one area, chain with several locations, nationwide consumer service, B2B service with a long sales cycle, agency, or not a service company |
| How a sale happens | contact request, quote, booking, phone call, visit, tender |
| Market | country, language or languages, towns |
| Buyers | consumer or business, and who decides (one person, several roles) |
| Paid advertising | runs now, planned, not used |
| Tools in use | the company's own channels and data sources. Tools connected to this session go on their own line, named as such; listing them is not a choice of data source, the brief asks that |
| What the work is for | the decision the user wants to make with the result |

## 3. Show it and ask once

Tell the user in a few lines, in their language: this is how I understood your situation, this is where I read
it, and this is what I change in the work because of it. Ask them to correct what is wrong. What they confirm
becomes `[vahvistettu: <date>]`.

One message, no interview: the same message carries the questions of the skill's own brief that are still
open, so the user answers once. Do not ask what you already read. When the fit needs a choice from the user
(which towns, which client, which buyer role), ask it here, and you may suggest an answer from what you read,
named as a suggestion.

A request for one job ("do a keyword research on X") is not a request to skip this. Keep the profile to a few
lines and go on. Skip it only when the user says they do not want it: then do the job, fit it as well as the
derived facts allow, and say which assumptions you made.

## 4. Fit the work

Change these to fit the profile:

- the questions you ask and the examples you give with them
- the words: use what this trade calls its customers, jobs and offers
- which parts of the result matter most, and which are left out because they do not apply
- the order of work, when one part is clearly the reason the user came

Do not change these:

- every number comes from the data, and nothing is invented to fill a gap
- the markers confirmed, derived and open
- the cost is told before a paid call
- the file formats the scripts read

## 5. Agencies and other work for clients

- One folder per client: `yrityskonteksti/<client-slug>/`, with that client's own `tilanne.md` and context
  files. Results go under the same slug in each skill's own folder. The agency's own context is not the
  client's: never carry facts from one to the other.
- Ask which client the work is for, if it is not clear.
- The owner of a client's files is a person at the client, unless the user says otherwise.
- The report's look: the client's `brand.json` by default. If the agency wants its own name on the report, set
  it in the `brand.json` of that work folder.

## 6. Say what you fitted

In the final summary, add one short paragraph: what kind of company you took this to be, what you changed or
left out because of it, and what the user should correct in `tilanne.md` if it is wrong.
