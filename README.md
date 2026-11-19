# cissp.world - Adaptive CISSP Practice Exam

A free **computerized adaptive testing (CAT)** engine for CISSP exam preparation,
hosted at [cissp.world](https://cissp.world).

> CISSP is a registered trademark of ISC2. This project is an independent,
> unofficial study tool. It is **not** affiliated with or endorsed by ISC2 and
> contains **no real exam content**.

## Features

- **True adaptive engine** - a 1-parameter logistic (Rasch) model re-estimates your
  ability after every answer, selects the next question near your level, and ends
  the exam early once it is statistically confident, just like the real exam.
- **Three exam modes** - Short (max 50), Medium (max 100), Full (max 150 questions),
  each with realistic time limits and blueprint-weighted domain coverage.
- **Realistic experience** - testing-center UI, no going back, countdown timer,
  pass/fail score report with per-domain proficiency levels.
- **Study review** - after the exam, review missed questions with explanations.
- **Accounts** - sign in to track exam history across devices (Supabase), or use
  guest/practice mode with browser-local storage.
- **660 original questions** across all 8 domains, weighted to the official exam
  outline, with explanations for every answer.

## Licensing

- **Code**: [MIT](LICENSE)
- **Questions** (`data/questions.json`): **Copyright (c) 2026 cissp.world.
  All rights reserved.** The question bank is **not** open source. It may not be
  copied, redistributed, republished, sold, bundled into another product or dataset,
  or used to train machine learning models, in whole or in part. It is provided
  solely for personal study use on cissp.world.

## Contributions

This project does not accept question submissions. Pull requests that add or modify
`data/questions.json` will be closed.

## Development

Static site, no build step. Serve the folder with any web server:

```
python -m http.server 8000
```

See [SETUP.md](SETUP.md) for Supabase (accounts) and custom-domain configuration.
