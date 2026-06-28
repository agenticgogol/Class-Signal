-- Phase 5: explainable knowledge gaps and reversible duplicate consolidation.

create table if not exists public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null unique,
  concept_label text not null,
  module_topic text,
  suggested_kind text not null default 'faq' check (suggested_kind in ('faq', 'theory', 'code')),
  status text not null default 'open' check (status in ('open', 'drafting', 'resolved', 'dismissed')),
  signal_summary jsonb not null default '{}'::jsonb,
  resolved_by_entry_id uuid references public.knowledge_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_gap_questions (
  gap_id uuid not null references public.knowledge_gaps(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gap_id, question_id)
);

create table if not exists public.question_duplicate_merges (
  id uuid primary key default gen_random_uuid(),
  duplicate_question_id uuid not null references public.questions(id) on delete cascade,
  canonical_question_id uuid not null references public.questions(id) on delete cascade,
  previous_status text not null,
  previous_duplicate_of_question_id uuid references public.questions(id) on delete set null,
  merged_by uuid,
  merged_at timestamptz not null default now(),
  undone_by uuid,
  undone_at timestamptz,
  check (duplicate_question_id <> canonical_question_id)
);

create unique index if not exists one_active_merge_per_question
  on public.question_duplicate_merges(duplicate_question_id) where undone_at is null;
create index if not exists duplicate_merges_canonical_idx
  on public.question_duplicate_merges(canonical_question_id) where undone_at is null;
create index if not exists knowledge_gap_status_idx on public.knowledge_gaps(status, updated_at desc);

alter table public.knowledge_gaps enable row level security;
alter table public.knowledge_gap_questions enable row level security;
alter table public.question_duplicate_merges enable row level security;

drop policy if exists "Authenticated admins manage knowledge gaps" on public.knowledge_gaps;
create policy "Authenticated admins manage knowledge gaps" on public.knowledge_gaps
  for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins manage gap questions" on public.knowledge_gap_questions;
create policy "Authenticated admins manage gap questions" on public.knowledge_gap_questions
  for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins manage duplicate merges" on public.question_duplicate_merges;
create policy "Authenticated admins manage duplicate merges" on public.question_duplicate_merges
  for all to authenticated using (true) with check (true);

create or replace function public.merge_duplicate_question(p_duplicate_id uuid, p_canonical_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_previous uuid;
  v_canonical uuid;
  v_merge_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_duplicate_id = p_canonical_id then raise exception 'A question cannot duplicate itself'; end if;

  select status, duplicate_of_question_id into v_status, v_previous
  from public.questions where id = p_duplicate_id for update;
  if not found then raise exception 'Duplicate question not found'; end if;

  select coalesce(duplicate_of_question_id, id) into v_canonical
  from public.questions where id = p_canonical_id for update;
  if not found then raise exception 'Canonical question not found'; end if;
  if v_canonical = p_duplicate_id then raise exception 'Circular duplicate relationship'; end if;

  update public.question_duplicate_merges
    set undone_at = now(), undone_by = auth.uid()
    where duplicate_question_id = p_duplicate_id and undone_at is null;

  insert into public.question_duplicate_merges(
    duplicate_question_id, canonical_question_id, previous_status,
    previous_duplicate_of_question_id, merged_by
  ) values (p_duplicate_id, v_canonical, v_status, v_previous, auth.uid())
  returning id into v_merge_id;

  update public.questions
    set duplicate_of_question_id = v_canonical, status = 'Duplicate', updated_at = now()
    where id = p_duplicate_id;
  return v_merge_id;
end;
$$;

create or replace function public.undo_duplicate_merge(p_duplicate_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_merge public.question_duplicate_merges%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_merge from public.question_duplicate_merges
    where duplicate_question_id = p_duplicate_id and undone_at is null
    order by merged_at desc limit 1 for update;
  if not found then raise exception 'Active merge not found'; end if;

  update public.questions set
    status = v_merge.previous_status,
    duplicate_of_question_id = v_merge.previous_duplicate_of_question_id,
    updated_at = now()
  where id = p_duplicate_id;
  update public.question_duplicate_merges set undone_at = now(), undone_by = auth.uid()
    where id = v_merge.id;
end;
$$;

grant execute on function public.merge_duplicate_question(uuid, uuid) to authenticated;
grant execute on function public.undo_duplicate_merge(uuid) to authenticated;

-- Recovery/rollback notes:
-- 1. Undo active merges with select public.undo_duplicate_merge(duplicate_question_id)
--    while authenticated, or restore each question from question_duplicate_merges.
-- 2. Drop the two functions, then question_duplicate_merges,
--    knowledge_gap_questions and knowledge_gaps in that dependency order.
