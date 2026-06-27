# Architecture

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Auth for admin login
- Supabase RLS
- Vercel deployment

## Key Principle
Student-facing pages must never expose:
- student_email of other users
- student_name of other users
- admin_notes
- AI settings
- API keys

## Routes

### Public
- `/` redirects to `/questions`
- `/questions` access-gated board, submission, voting, and exact-email lookup
- `/my-questions` redirects to `/questions`

### Admin
- `/admin/login`
- `/admin/dashboard`
- `/admin/settings`

### API routes
- `POST /api/questions` submit question
- `POST /api/questions/access` validate class access without exposing the configured code
- `GET /api/questions/public` public questions without names/emails
- `POST /api/questions/upvote` upvote question
- `POST /api/questions/mine` questions by exact email
- `POST /api/questions/feedback` participant feedback on published answers
- `PATCH /api/admin/questions/[id]` update question
- `GET /api/admin/questions/export` CSV export
- `POST /api/admin/questions/[id]/generate-draft` admin-only AI draft
- `POST /api/admin/questions/[id]/find-duplicates` admin-only duplicate detection
- `GET /api/admin/settings/ai` admin-only
- `POST /api/admin/settings/ai` admin-only
- `GET/POST /api/admin/settings/public` admin-only public board settings

## AI Provider Design
Create a provider abstraction:
- `lib/ai/types.ts`
- `lib/ai/openai.ts`
- `lib/ai/anthropic.ts`
- `lib/ai/gemini.ts`
- `lib/ai/index.ts`

Admin selects:
- provider_name
- model_name
- api_key

Students cannot trigger AI.

## Duplicate Detection
Admin clicks "Find duplicates".
System compares selected question with other questions.
MVP can use:
- simple token overlap / cosine-like similarity
- optional AI call if provider configured

Store results in `question_similarity`.

## AI Draft Answer
Admin clicks "Generate draft answer".
System sends question and context to selected provider.
Stores result in `ai_draft_answer`.
Admin can edit and copy into `answer_markdown`.

## Security
- Every student API validates the active class code server-side.
- Direct anonymous table policies are removed; public operations use server routes.
- Use Supabase anon key only for safe public operations.
- Use service role key only in server-side API routes.
- Never expose service role key in frontend.
- Never expose AI key in frontend.
- Middleware protects `/admin`.
