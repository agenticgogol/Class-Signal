alter table public.knowledge_documents
  add column if not exists document_key text,
  add column if not exists version_number integer not null default 1,
  add column if not exists is_current boolean not null default true,
  add column if not exists supersedes_document_id uuid references public.knowledge_documents(id) on delete set null;

alter table public.knowledge_entries
  add column if not exists sequence_number integer not null default 0;

update public.knowledge_documents
set document_key = regexp_replace(lower(coalesce(source_filename, title, id::text)), '[^a-z0-9]+', '-', 'g') || ':' || kind
where document_key is null or document_key = '';

with versions as (
  select id,
         row_number() over (partition by document_key order by created_at asc, id asc)::integer as version_number,
         row_number() over (partition by document_key order by created_at desc, id desc) as newest_rank
  from public.knowledge_documents
)
update public.knowledge_documents as document
set version_number = versions.version_number,
    is_current = versions.newest_rank = 1,
    is_visible = case when versions.newest_rank = 1 then document.is_visible else false end
from versions
where document.id = versions.id;

with ordered_entries as (
  select id, (row_number() over (partition by document_id order by created_at asc, id asc) - 1)::integer as sequence_number
  from public.knowledge_entries
)
update public.knowledge_entries as entry
set sequence_number = ordered_entries.sequence_number
from ordered_entries
where entry.id = ordered_entries.id;

alter table public.knowledge_documents alter column document_key set not null;

create unique index if not exists one_current_knowledge_document
on public.knowledge_documents(document_key)
where is_current = true;

create index if not exists knowledge_entries_sequence_idx
on public.knowledge_entries(document_id, sequence_number);
