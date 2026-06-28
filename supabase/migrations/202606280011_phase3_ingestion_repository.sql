-- Phase 3: asynchronous, provenance-aware teaching-material repository.
create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('faq', 'theory', 'code')),
  document_key text not null unique,
  module_topic text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  version_number integer not null,
  original_filename text not null,
  mime_type text,
  byte_size bigint not null check (byte_size >= 0),
  checksum_sha256 text not null,
  storage_path text not null,
  processing_status text not null default 'queued' check (processing_status in ('queued','scanning','extracting','ready','failed','retired')),
  scan_status text not null default 'pending' check (scan_status in ('pending','basic_passed','external_passed','failed')),
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(source_id, version_number),
  unique(source_id, checksum_sha256)
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.knowledge_source_versions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','scanning','extracting','storing','completed','failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  stage_message text,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_assets (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.knowledge_source_versions(id) on delete cascade,
  original_path text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,
  created_at timestamptz not null default now(),
  unique(source_version_id, original_path)
);

alter table public.knowledge_documents add column if not exists source_version_id uuid references public.knowledge_source_versions(id) on delete set null;
alter table public.knowledge_entries add column if not exists source_version_id uuid references public.knowledge_source_versions(id) on delete set null;
alter table public.knowledge_entries add column if not exists provenance_type text check (provenance_type in ('section','page','slide','cell','line'));
alter table public.knowledge_entries add column if not exists provenance_label text;
alter table public.knowledge_entries add column if not exists provenance_start integer;
alter table public.knowledge_entries add column if not exists provenance_end integer;
alter table public.knowledge_entries add column if not exists checksum_sha256 text;
alter table public.knowledge_entries add column if not exists embedding extensions.vector(1536);

create index if not exists knowledge_entries_embedding_idx on public.knowledge_entries using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists ingestion_jobs_status_idx on public.ingestion_jobs(status, created_at);
create index if not exists knowledge_versions_source_idx on public.knowledge_source_versions(source_id, version_number desc);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_source_versions enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.knowledge_assets enable row level security;
drop policy if exists "Authenticated admins manage knowledge sources" on public.knowledge_sources;
create policy "Authenticated admins manage knowledge sources" on public.knowledge_sources for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins manage knowledge source versions" on public.knowledge_source_versions;
create policy "Authenticated admins manage knowledge source versions" on public.knowledge_source_versions for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins manage ingestion jobs" on public.ingestion_jobs;
create policy "Authenticated admins manage ingestion jobs" on public.ingestion_jobs for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins manage knowledge assets" on public.knowledge_assets;
create policy "Authenticated admins manage knowledge assets" on public.knowledge_assets for all to authenticated using (true) with check (true);

insert into storage.buckets(id, name, public, file_size_limit)
values ('knowledge-originals', 'knowledge-originals', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;
insert into storage.buckets(id, name, public, file_size_limit)
values ('knowledge-assets', 'knowledge-assets', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "Authenticated admins read knowledge originals" on storage.objects;
create policy "Authenticated admins read knowledge originals" on storage.objects for select to authenticated using (bucket_id = 'knowledge-originals');
drop policy if exists "Authenticated admins upload knowledge originals" on storage.objects;
create policy "Authenticated admins upload knowledge originals" on storage.objects for insert to authenticated with check (bucket_id = 'knowledge-originals');
drop policy if exists "Authenticated admins manage knowledge assets" on storage.objects;
create policy "Authenticated admins manage knowledge assets" on storage.objects for all to authenticated using (bucket_id = 'knowledge-assets') with check (bucket_id = 'knowledge-assets');

create or replace function public.match_knowledge_entries(query_embedding extensions.vector(1536), match_count integer default 8)
returns table(id uuid, semantic_score double precision)
language sql stable security definer set search_path = public, extensions
as $$
  select e.id, 1 - (e.embedding <=> query_embedding) as semantic_score
  from public.knowledge_entries e
  join public.knowledge_documents d on d.id = e.document_id
  where e.embedding is not null and e.is_visible = true and d.is_visible = true and d.is_current = true
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;
revoke all on function public.match_knowledge_entries(extensions.vector, integer) from public;
grant execute on function public.match_knowledge_entries(extensions.vector, integer) to authenticated, service_role;

-- Recovery: original files remain in private Storage until explicitly removed.
-- Drop match_knowledge_entries, the added knowledge_entries/document columns, then
-- knowledge_assets, ingestion_jobs, knowledge_source_versions and knowledge_sources.
