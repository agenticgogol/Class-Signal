create table if not exists public.question_feedback (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  participant_email text not null,
  satisfaction_status text not null default 'satisfied'
    check (satisfaction_status in ('satisfied', 'not_satisfied')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id, participant_email)
);

alter table public.question_feedback
  add column if not exists satisfaction_status text,
  add column if not exists reason text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'question_feedback'
      and column_name = 'rating'
  ) then
    execute $sql$
      update public.question_feedback
      set satisfaction_status = case
        when rating = 'not_helpful' then 'not_satisfied'
        else 'satisfied'
      end
      where satisfaction_status is null
    $sql$;
  end if;
end $$;

update public.question_feedback
set satisfaction_status = 'satisfied'
where satisfaction_status is null;

alter table public.question_feedback
  alter column satisfaction_status set default 'satisfied',
  alter column satisfaction_status set not null;

alter table public.question_feedback
  drop constraint if exists question_feedback_rating_check,
  drop constraint if exists question_feedback_satisfaction_status_check;

alter table public.question_feedback
  add constraint question_feedback_satisfaction_status_check
  check (satisfaction_status in ('satisfied', 'not_satisfied'));

alter table public.question_feedback
  drop column if exists rating;

alter table public.question_feedback enable row level security;

drop policy if exists "Authenticated admin can manage feedback" on public.question_feedback;
create policy "Authenticated admin can manage feedback"
on public.question_feedback
for all
to authenticated
using (true)
with check (true);

drop trigger if exists set_question_feedback_updated_at on public.question_feedback;
create trigger set_question_feedback_updated_at
before update on public.question_feedback
for each row execute function public.set_updated_at();
