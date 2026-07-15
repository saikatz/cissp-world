-- ============================================================
-- cissp.world — Supabase schema
-- Run this once in your Supabase project: SQL Editor → New query
-- ============================================================

-- Exam results (one row per completed exam)
create table if not exists public.exams (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  mode        text not null check (mode in ('short', 'medium', 'full')),
  questions   int  not null,
  correct     int  not null,
  theta       numeric not null,
  se          numeric not null,
  passed      boolean not null,
  end_reason  text,
  domains     jsonb,
  taken_at    timestamptz not null default now()
);

-- Individual responses (for future question difficulty calibration)
create table if not exists public.responses (
  id          bigint generated always as identity primary key,
  exam_id     bigint not null references public.exams (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  correct     boolean not null,
  time_ms     int,
  created_at  timestamptz not null default now()
);

create index if not exists responses_question_idx on public.responses (question_id);
create index if not exists exams_user_idx on public.exams (user_id, taken_at desc);

-- Row Level Security: users can only see and write their own data
alter table public.exams enable row level security;
alter table public.responses enable row level security;

create policy "own exams select" on public.exams
  for select using (auth.uid() = user_id);
create policy "own exams insert" on public.exams
  for insert with check (auth.uid() = user_id);

create policy "own responses select" on public.responses
  for select using (auth.uid() = user_id);
create policy "own responses insert" on public.responses
  for insert with check (auth.uid() = user_id);

-- Aggregated per-question performance, safe to expose read-only.
-- Used to recalibrate question difficulty over time as real answer
-- data accumulates (harder questions -> lower success rate).
create or replace view public.question_stats
with (security_invoker = off) as
  select question_id,
         count(*)::int                 as attempts,
         count(*) filter (where correct)::int as corrects
  from public.responses
  group by question_id;

grant select on public.question_stats to anon, authenticated;
