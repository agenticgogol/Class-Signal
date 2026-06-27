create table if not exists public.public_settings (
  id uuid primary key default gen_random_uuid(),
  active_access_code text default 'AgenticAI-2026',
  public_board_enabled boolean not null default true,
  submissions_enabled boolean not null default true,
  voting_enabled boolean not null default true,
  default_course_name text not null default 'Advanced Agentic AI',
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questions
  add column if not exists is_answer_public boolean not null default true;

create table if not exists public.question_feedback (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  participant_email text not null,
  satisfaction_status text not null default 'satisfied' check (satisfaction_status in ('satisfied', 'not_satisfied')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id, participant_email)
);

create unique index if not exists one_active_public_settings
  on public.public_settings (is_active)
  where is_active = true;

alter table public.public_settings enable row level security;
alter table public.question_feedback enable row level security;

drop policy if exists "Anyone can submit questions" on public.questions;
drop policy if exists "Anyone can read public questions" on public.questions;
drop policy if exists "Anyone can upvote" on public.question_votes;
drop policy if exists "Anyone can read vote counts" on public.question_votes;

create policy "Authenticated admin can manage public settings"
on public.public_settings
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated admin can manage feedback"
on public.question_feedback
for all
to authenticated
using (true)
with check (true);

drop trigger if exists set_public_settings_updated_at on public.public_settings;
create trigger set_public_settings_updated_at
before update on public.public_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_question_feedback_updated_at on public.question_feedback;
create trigger set_question_feedback_updated_at
before update on public.question_feedback
for each row execute function public.set_updated_at();

insert into public.public_settings (
  active_access_code,
  public_board_enabled,
  submissions_enabled,
  voting_enabled,
  default_course_name,
  timezone,
  is_active
)
select 'AgenticAI-2026', true, true, true, 'Advanced Agentic AI', 'Asia/Kolkata', true
where not exists (select 1 from public.public_settings where is_active = true);
