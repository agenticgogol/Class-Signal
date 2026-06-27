alter table public.question_similarity
  add column if not exists similarity_reason text;
