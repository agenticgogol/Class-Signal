create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_email text not null,
  course_name text not null,
  class_date date,
  class_number text,
  module_topic text,
  question_text text not null,
  normalized_question_text text,
  status text not null default 'New',
  priority text not null default 'Medium',
  answer_markdown text,
  reference_links text,
  admin_notes text,
  ai_draft_answer text,
  is_answer_public boolean not null default true,
  is_public boolean not null default true,
  duplicate_of_question_id uuid references public.questions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  voter_email text not null,
  created_at timestamptz not null default now(),
  unique(question_id, voter_email)
);

create table if not exists public.question_similarity (
  id uuid primary key default gen_random_uuid(),
  source_question_id uuid not null references public.questions(id) on delete cascade,
  similar_question_id uuid not null references public.questions(id) on delete cascade,
  similarity_score numeric not null,
  method text not null default 'admin_ai',
  similarity_reason text,
  created_at timestamptz not null default now(),
  unique(source_question_id, similar_question_id),
  check(source_question_id <> similar_question_id),
  check(similarity_score >= 0 and similarity_score <= 1)
);

create table if not exists public.admin_ai_settings (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  model_name text,
  encrypted_api_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.questions enable row level security;
alter table public.question_votes enable row level security;
alter table public.question_similarity enable row level security;
alter table public.admin_ai_settings enable row level security;
alter table public.public_settings enable row level security;
alter table public.question_feedback enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_ai_settings_updated_at on public.admin_ai_settings;
create trigger set_admin_ai_settings_updated_at
before update on public.admin_ai_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_public_settings_updated_at on public.public_settings;
create trigger set_public_settings_updated_at
before update on public.public_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_question_feedback_updated_at on public.question_feedback;
create trigger set_question_feedback_updated_at
before update on public.question_feedback
for each row execute function public.set_updated_at();

-- Student/public policies

-- Student access is served only through server routes after class-code validation.

-- Admin policies

create policy "Authenticated admin can read all questions"
on public.questions
for select
to authenticated
using (true);

create policy "Authenticated admin can update questions"
on public.questions
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated admin can delete questions"
on public.questions
for delete
to authenticated
using (true);

create policy "Authenticated admin can manage votes"
on public.question_votes
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated admin can manage similarity"
on public.question_similarity
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated admin can manage AI settings"
on public.admin_ai_settings
for all
to authenticated
using (true)
with check (true);

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
