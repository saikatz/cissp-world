# cissp.world — Adaptive CISSP Practice Exam

A free, open-source **computerized adaptive testing (CAT)** engine for CISSP exam
preparation, hosted at [cissp.world](https://cissp.world).

> CISSP® is a registered trademark of ISC2. This project is an independent,
> unofficial study tool. It is **not** affiliated with or endorsed by ISC2 and
> contains **no real exam content**.

## Features

- **True adaptive engine** — a 1-parameter logistic (Rasch) model re-estimates your
  ability after every answer, selects the next question near your level, and ends
  the exam early once it is statistically confident, just like the real exam.
- **Three exam modes** — Short (max 50), Medium (max 100), Full (max 150 questions),
  each with realistic time limits and blueprint-weighted domain coverage.
- **Realistic experience** — testing-center UI, no going back, countdown timer,
  pass/fail score report with per-domain proficiency levels.
- **Study review** — after the exam, review missed questions with explanations.
- **Accounts** — sign in to track exam history across devices (Supabase), or use
  guest/practice mode with browser-local storage.
- **Self-growing question bank** — a daily GitHub Action ingests new questions from
  verified openly licensed sources and validates the whole bank.

## Licensing

- **Code**: [MIT](LICENSE)
- **Questions** (`data/questions.json`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) —
  original works created for this project or ingested from sources whose open
  license *and* provenance were verified by a human (see `data/sources.json`).

## Contributing questions

Open a pull request adding questions to `data/community-submissions.json` in this
format (they are merged into the bank by the daily job after PR review):

```json
{
  "domain": 4,
  "difficulty": 0.3,
  "question": "…",
  "options": ["…", "…", "…", "…"],
  "answer": 1,
  "explanation": "…"
}
```

By submitting, you confirm the question is **your original work** and you license it
under CC BY-SA 4.0. Questions copied from books, courses, or exam dumps are rejected.

## Development

Static site — no build step. Serve the folder with any web server:

```
python -m http.server 8000
```

See [SETUP.md](SETUP.md) for Supabase (accounts) and custom-domain configuration.
