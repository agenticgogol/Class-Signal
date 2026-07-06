-- Classwise Agenda + Agentic Answer Assistant.

create table if not exists public.classwise_agenda (
  id uuid primary key default gen_random_uuid(),
  course_name text not null,
  class_number text not null,
  class_date date,
  concepts text,
  hands_on text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_name, class_number)
);

create table if not exists public.answer_assistant_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  triggered_by uuid,
  questions_considered integer not null default 0,
  drafts_generated integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.questions add column if not exists is_anonymous boolean not null default false;
alter table public.questions add column if not exists agenda_entry_id uuid references public.classwise_agenda(id) on delete set null;
alter table public.questions add column if not exists ai_answer_mode text check (ai_answer_mode in ('course', 'external'));

create index if not exists classwise_agenda_course_idx on public.classwise_agenda(course_name, class_number);
create index if not exists answer_assistant_runs_created_idx on public.answer_assistant_runs(created_at desc);

alter table public.classwise_agenda enable row level security;
alter table public.answer_assistant_runs enable row level security;

drop policy if exists "Authenticated admin manage classwise agenda" on public.classwise_agenda;
create policy "Authenticated admin manage classwise agenda" on public.classwise_agenda
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated admin manage answer assistant runs" on public.answer_assistant_runs;
create policy "Authenticated admin manage answer assistant runs" on public.answer_assistant_runs
  for all to authenticated using (true) with check (true);

drop trigger if exists set_classwise_agenda_updated_at on public.classwise_agenda;
create trigger set_classwise_agenda_updated_at
before update on public.classwise_agenda
for each row execute function public.set_updated_at();

-- Recovery/rollback: drop answer_assistant_runs and classwise_agenda; drop the three
-- added questions columns. No existing data is mutated by this migration.
