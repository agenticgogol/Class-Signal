create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('faq', 'theory')),
  source_filename text,
  module_topic text,
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questions
  add column if not exists answer_source text not null default 'instructor'
  check (answer_source in ('instructor', 'knowledge'));

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  section_key text,
  title text not null,
  module_topic text,
  content_html text not null,
  content_text text not null,
  normalized_text text not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_knowledge_suggestions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  entry_id uuid not null references public.knowledge_entries(id) on delete cascade,
  similarity_score numeric not null check (similarity_score >= 0 and similarity_score <= 1),
  suggestion_status text not null default 'pending' check (suggestion_status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id, entry_id)
);

create index if not exists knowledge_entries_document_id_idx on public.knowledge_entries(document_id);
create index if not exists knowledge_entries_visibility_idx on public.knowledge_entries(is_visible);
create index if not exists question_knowledge_suggestions_question_id_idx on public.question_knowledge_suggestions(question_id);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.question_knowledge_suggestions enable row level security;

drop policy if exists "Authenticated admin can manage knowledge documents" on public.knowledge_documents;
create policy "Authenticated admin can manage knowledge documents"
on public.knowledge_documents for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated admin can manage knowledge entries" on public.knowledge_entries;
create policy "Authenticated admin can manage knowledge entries"
on public.knowledge_entries for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated admin can manage knowledge suggestions" on public.question_knowledge_suggestions;
create policy "Authenticated admin can manage knowledge suggestions"
on public.question_knowledge_suggestions for all to authenticated using (true) with check (true);

drop trigger if exists set_knowledge_documents_updated_at on public.knowledge_documents;
create trigger set_knowledge_documents_updated_at before update on public.knowledge_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_knowledge_entries_updated_at on public.knowledge_entries;
create trigger set_knowledge_entries_updated_at before update on public.knowledge_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_question_knowledge_suggestions_updated_at on public.question_knowledge_suggestions;
create trigger set_question_knowledge_suggestions_updated_at before update on public.question_knowledge_suggestions
for each row execute function public.set_updated_at();
