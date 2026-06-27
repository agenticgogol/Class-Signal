# ClassSignal — Product Requirements

## Goal

Build a live teaching Q&A operations tool where students submit questions without interrupting class, other students can see and upvote questions, and the instructor can answer, classify, prioritize, de-duplicate, and export questions.

## User Types

### Student
- No login required.
- Enters the active class access code before any student action.
- Submits a question using name, email, module name, and question.
- Can view all public questions from everyone.
- Can upvote any question.
- Can enter email to see their own submitted questions and instructor answers.
- Cannot see names/emails of other students.
- Cannot access AI settings or AI actions.

### Admin / Instructor
- Logs in using Supabase email/password auth.
- Can view all questions including student name and email.
- Can update answer, references, notes, status, priority, duplicate mapping, and visibility.
- Can export CSV.
- Can trigger duplicate detection manually.
- Can trigger AI draft answer generation manually.
- Can configure AI provider, model, and API key from protected admin settings.

## Public Board Module

### /
Redirects to `/questions`.

### /questions
The complete student experience:
- Requires the active class access code for reads, submissions, votes, and email lookup.
- Shows public questions from the last three months by default.
- Hide student name and email.
- Rank by upvote count descending, then newest.
- Show question, course, class date, class number, module topic, status, upvote count.
- Allow student to upvote using email.
- Opens the four-field question form from “Ask a Question”.
- Includes exact-email “My Questions” lookup and participant feedback for published answers.

### /my-questions
Redirects to `/questions`.

## Admin Pages

### /admin/login
Admin login page.

### /admin/dashboard
Protected dashboard:
- All questions.
- Filters: course, class date, class number, module topic, status, priority.
- Search.
- Sort by newest/upvotes/status.
- Edit answer_markdown, reference_links, admin_notes, status, priority, visibility.
- Export CSV.
- Button: Find duplicates.
- Button: Generate draft answer.

### /admin/settings
Protected settings:
- Active class access code and public capability toggles.
- Default course name and timezone.
- AI provider name.
- Model name.
- API key.
- Save/update active AI configuration.
- API key must not be exposed to students.

## Statuses
- New
- Answered
- Explained verbally
- Will discuss later
- Out of scope
- Duplicate
- Needs follow-up

## Priorities
- Low
- Medium
- High
- Discuss live

## AI Requirements
- Students must never trigger AI usage.
- Students must never see or provide API keys.
- Admin chooses provider/model/API key.
- Admin manually clicks Generate draft answer.
- Admin manually clicks Find duplicates.
- AI routes must be protected server-side routes.
- If no API key is configured, show a helpful admin-only message.

## Deployment
- Next.js + Supabase + Vercel.
- Keep within free tiers as much as possible.
