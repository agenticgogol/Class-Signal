alter table public.questions
  add column if not exists answer_html text;

update public.questions as question
set answer_html = accepted.content_html,
    answer_source = 'knowledge'
from (
  select distinct on (suggestion.question_id)
    suggestion.question_id,
    entry.content_html
  from public.question_knowledge_suggestions as suggestion
  join public.knowledge_entries as entry on entry.id = suggestion.entry_id
  where suggestion.suggestion_status = 'accepted'
  order by suggestion.question_id, suggestion.updated_at desc
) as accepted
where question.id = accepted.question_id
  and (question.answer_html is null or btrim(question.answer_html) = '');

