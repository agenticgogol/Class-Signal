# Codex Build Instructions

You are building "ClassSignal", a live course Q&A tracker.

Follow PRODUCT_REQUIREMENTS.md, ARCHITECTURE.md, and DATABASE_SCHEMA.sql exactly.

## Non-negotiable requirements
1. Students do not log in.
2. Students use `/questions` for all actions after server-side validation of the active class code.
3. Students submit only name, module name, email, and question; course/date metadata is set server-side.
4. Students can see public questions from the last three months, but never see any student name/email.
5. Students can upvote any question using email when voting is enabled.
6. Public board ranks questions by upvotes, then newest.
7. Students can enter an exact email to see only their own questions and published answers.
8. Admin login uses Supabase Auth.
9. Admin dashboard is protected.
10. Admin can answer in Markdown.
11. Admin can change status, priority, visibility, references, and notes.
12. Admin can export CSV.
13. Admin can configure AI provider, model, and API key from admin settings.
14. Students must never use AI models or API keys.
15. AI actions are admin-only:
    - Generate draft answer
    - Find duplicates
16. API keys must never be sent to browser/client components.
17. Use server routes for admin AI operations.
18. Use public API routes for student operations so names/emails and settings are never exposed.

## Implementation expectations
- Use clean TypeScript.
- Use App Router.
- Use server components where appropriate.
- Use client components only for forms/interactivity.
- Create reusable UI components.
- Add loading/error states.
- Add basic validation.
- Add responsive layout.
- Keep design clean and professional.

## User-facing modules
- Public Board at `/questions` (`/` and `/my-questions` redirect here)
- Admin under `/admin`
- `/admin/login`
- `/admin/dashboard`
- `/admin/settings`

## Components
- QuestionSubmitForm
- PublicQuestionBoard
- UpvoteButton
- MyQuestionsLookup
- AdminQuestionTable
- AdminQuestionEditor
- StatusBadge
- PriorityBadge
- MarkdownPreview
- AiSettingsForm
- ExportCsvButton

## Libraries
Use:
- @supabase/supabase-js
- @supabase/ssr
- react-markdown
- remark-gfm
- date-fns
- lucide-react

## Environment variables
Required:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Do not require AI provider env variables because admin configures AI from the frontend settings page.

## AI provider support
Implement at least OpenAI first.
For Anthropic/Gemini, create placeholder provider files with clear TODO messages if not implemented.

## Output
Create all required files.
After implementation, run:
- npm run lint
- npm run build

Fix all errors before finishing.
