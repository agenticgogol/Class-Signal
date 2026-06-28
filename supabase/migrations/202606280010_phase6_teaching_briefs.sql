-- Phase 6: immutable post-class briefs and non-secret QR join sessions.

create table if not exists public.class_join_sessions (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null default gen_random_uuid() unique,
  session_key text not null unique,
  course_name text not null,
  class_date date not null,
  class_number text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.teaching_briefs (
  id uuid primary key default gen_random_uuid(),
  session_key text not null,
  course_name text not null,
  class_date date not null,
  class_number text,
  version_number integer not null default 1,
  input_metrics jsonb not null,
  content_markdown text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(session_key, version_number)
);

create index if not exists teaching_briefs_session_idx on public.teaching_briefs(session_key, version_number desc);
create index if not exists class_join_sessions_active_idx on public.class_join_sessions(is_active, class_date desc);

alter table public.class_join_sessions enable row level security;
alter table public.teaching_briefs enable row level security;

drop policy if exists "Authenticated admins manage class join sessions" on public.class_join_sessions;
create policy "Authenticated admins manage class join sessions" on public.class_join_sessions
  for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins manage teaching briefs" on public.teaching_briefs;
create policy "Authenticated admins manage teaching briefs" on public.teaching_briefs
  for all to authenticated using (true) with check (true);

-- Recovery/rollback: export teaching_briefs first because snapshots are immutable.
-- Then drop teaching_briefs and class_join_sessions; neither table mutates source questions.

