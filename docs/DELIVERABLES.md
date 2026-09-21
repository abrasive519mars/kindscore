# Kindscore — Final deliverables

What we hand in, mapped to PRD §15 and the submission form (`submissionList.png`: one file upload ≤ 50 MB total, allowed types zip/pdf/doc/ppt/xls/png/jpg/mp3/mp4 · one "Assignment link" URL · a required "Add notes" field ≤ 2048 chars).

## A. Mandatory (PRD §15)

| #   | Deliverable                                                                             | Form                                                                               | Where it goes on the form                        |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| A1  | **Live website** — publicly accessible, on a _new_ Vercel account                       | `https://kindscore-<x>.vercel.app` (custom domain optional)                        | **Assignment link**                              |
| A2  | **User panel** — test credentials; signup / login / score entry / dashboard all working | Test subscriber account(s) pre-seeded with scores and a draw history               | Listed in README + notes                         |
| A3  | **Admin panel** — admin credentials; users, draw system, charities, winner verification | Pre-seeded admin account                                                           | Listed in README + notes                         |
| A4  | **Database** — _new_ Supabase project with proper schema                                | Migrations in repo (`supabase/migrations/`), seed script, schema diagram           | Repo + submission PDF                            |
| A5  | **Source code** — clean, structured, well-commented                                     | Public GitHub repo **and** a zip of the repo (no `node_modules`, no `.env`)        | Zip → **Upload file**; repo URL → README + notes |
| A6  | **Env vars properly configured** (§15.1)                                                | `.env.example` with every variable documented; real values only in Vercel/Supabase | Repo                                             |

## B. Submission package (what actually gets uploaded — one zip, ≤ 50 MB)

```
kindscore-submission.zip
├── kindscore-source/            # the repo, minus node_modules/.next/.env
├── Kindscore-Submission.pdf     # see B1
└── schema.png                 # DB schema diagram
```

| #   | Item                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Submission PDF** (6–10 pages)     | The evaluator-facing document: live URL, both sets of credentials, 2-minute "how to test" script following §16.1, architecture overview + diagram, DB schema, **decisions table** (every `[decision]` from `docs/GAME.md` with the reasoning), screenshots of key screens, link to repo. Evaluators judge "problem-solving: how ambiguous requirements are identified and resolved" — this is where that is _shown_, not just done. |
| B2  | ~~Demo video~~                      | **Out of scope** (user decision 2026-09-20).                                                                                                                                                                                                                                                                                                                                                                                        |
| B3  | **README.md** in repo               | Setup from zero (Supabase → Stripe → Vercel), env var table, scripts, architecture, credentials, decisions table (same as PDF), test checklist mapping to §16.1.                                                                                                                                                                                                                                                                    |
| B4  | **Notes field text** (≤ 2048 chars) | Pre-written blurb: product name + one-line pitch, live URL, repo URL, test + admin credentials, "start with Kindscore-Submission.pdf", Stripe test card number. Drafted in `docs/SUBMISSION_NOTES.md` so it's copy-paste ready.                                                                                                                                                                                                     |

## C. Not deliverables, but needed to produce them

- New Vercel account (§15.1) — created by the user; project deployed from GitHub.
- New Supabase project (§15.1) — created by the user; migrations pushed; storage bucket for proof screenshots.
- Stripe account in **test mode** — products/prices for monthly + yearly; webhook endpoint pointed at Vercel.
- GitHub repo (public) — the `DigitalHeroes` folder is not currently its own git repo; `git init` inside it first.

## D. Definition of done

Submission is ready when every line of PRD §16.1 can be demonstrated live with the seeded credentials, the zip is under 50 MB, and the PDF's "how to test" script has been run end-to-end on the deployed URL by us.
