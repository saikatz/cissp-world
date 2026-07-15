# Setup guide for cissp.world

Two one-time steps need to be done by the site owner: creating the free Supabase
project (for real user accounts) and pointing the `cissp.world` DNS at GitHub Pages.
Until Supabase is configured, the site still works fully in guest/practice mode.

---

## 1. Supabase (user accounts + exam history) — ~5 minutes

1. Go to <https://supabase.com>, sign up (free tier is plenty), and click
   **New project**. Name it `cissp-world`, choose a region near your users,
   and set a strong database password (you won't need it day-to-day).
2. When the project finishes provisioning, open **SQL Editor → New query**,
   paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql),
   and click **Run**.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** (like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ…`)
4. Edit [`js/config.js`](js/config.js) in this repo and paste them:
   ```js
   SUPABASE_URL: "https://abcdefgh.supabase.co",
   SUPABASE_ANON_KEY: "eyJ…",
   ```
   Commit and push. (The anon key is designed to be public — data safety comes
   from the Row Level Security policies created by the schema script.)
5. Optional but recommended: in Supabase **Authentication → Providers → Email**,
   decide whether to require email confirmation. Turning confirmation **off**
   makes registration instant; leaving it **on** is more spam-resistant.

## 2. Custom domain: cissp.world — ~10 minutes + DNS propagation

1. In the GitHub repo: **Settings → Pages**. Source should be
   `Deploy from a branch`, branch `main`, folder `/ (root)`.
2. In the **Custom domain** box enter `cissp.world` and save. GitHub will
   automatically commit a `CNAME` file to the repo. (Do this only after — or
   together with — the DNS step below, since the github.io URL starts
   redirecting to cissp.world as soon as the custom domain is set.)
3. At your domain registrar, create these DNS records:

   | Type  | Host | Value |
   |-------|------|-------|
   | A     | @    | 185.199.108.153 |
   | A     | @    | 185.199.109.153 |
   | A     | @    | 185.199.110.153 |
   | A     | @    | 185.199.111.153 |
   | CNAME | www  | saikatz.github.io |

4. Back in GitHub Pages settings, wait for the DNS check to pass, then tick
   **Enforce HTTPS** (the certificate can take up to an hour to issue).

## 3. Daily question updates — nothing to do

The GitHub Action in `.github/workflows/daily-questions.yml` runs every day at
06:17 UTC. It fetches questions only from sources in `data/sources.json` that a
human has marked license- and provenance-verified, dedupes and validates them,
and commits any additions — which automatically redeploys the site. You can run
it manually anytime from the repo's **Actions** tab.
