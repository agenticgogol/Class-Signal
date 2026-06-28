alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_kind_check;

alter table public.knowledge_documents
  add constraint knowledge_documents_kind_check
  check (kind in ('faq', 'theory', 'code'));

