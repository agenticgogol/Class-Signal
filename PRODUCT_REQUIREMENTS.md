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

### /admin/knowledge

- Manage separate FAQ, Theory and Code repositories.
- Import HTML, Python, Jupyter Notebook, Markdown and text files without executing uploaded content.
- Review, order, publish, hide, version and delete knowledge sources.
- Only visible sections from current document versions participate in public display and similarity matching.
- Queue PDF, PPTX, ZIP, HTML, Python, notebook, Markdown and text uploads for asynchronous extraction.
- Store original files and extracted assets privately with checksums and version provenance.
- Show ingestion progress, warnings and failures without partially publishing a document.
- Preserve exact page, slide, cell, code-line or section locations in public and AI citations.
- Reject executable files, unsafe archive paths, nested archives and oversized ZIP expansion.
- Use an optional external ClamAV-compatible scanner when `CLAMAV_SCAN_URL` is configured.
- Use optional OpenAI embeddings for hybrid lexical/semantic retrieval only when `OPENAI_EMBEDDING_API_KEY` is configured.

## Course Knowledge Suggestions

- New questions may receive an immediate suggestion from published FAQ, Theory or Code content.
- Suggestions show source document, section/module, confidence band and a deep link to the cited section.
- Participant can accept the suggestion or keep the question in the instructor queue.
- API key must not be exposed to students.

## Knowledge-gap Intelligence

- Cluster related non-duplicate questions using deterministic normalized-token similarity.
- Explain every recommendation through participant count, sessions, votes, unanswered questions, rejected suggestions, dissatisfaction, follow-up state and existing-source coverage.
- Recommend FAQ, Theory or Code based on the observed question cluster.
- Support open, drafting, resolved and dismissed lifecycle states.
- Allow an instructor to create a hidden draft Course Library entry from a gap.

## Smart Duplicate Consolidation

- A duplicate points to one canonical question while retaining its original author, feedback and history.
- Canonical vote totals deduplicate normalized participant email across the complete question group.
- New votes on duplicates are recorded against the canonical question.
- Duplicate participants inherit the canonical published answer and can submit feedback against their original question.
- Public duplicates identify and link to the canonical question.
- Admin merges are transactional, recorded and reversible.

## Post-class Teaching Briefs and QR Joining

- Instructors can activate a QR join link for a course, class date and optional class number.
- QR URLs contain only a random public session identifier and never contain the class access code.
- Participants joining through QR must still pass the configured access-code and identity workflow.
- Questions submitted from a verified active QR link inherit that session’s course, date and class number.
- Brief generation is deterministic and scoped to one class session.
- Every generated brief is an immutable version preserving its input metrics and source question IDs.
- Briefs include unresolved questions, confusing module, satisfaction, follow-up, Course Library recommendations and the next agenda.
- Instructors can export Markdown or print/save a brief as PDF.
- Public questions, My Questions and protected admin views refresh automatically while visible.

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
