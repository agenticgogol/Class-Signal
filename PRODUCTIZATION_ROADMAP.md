# ClassSignal Productization Roadmap

## Purpose

This document converts the product wishlist into an implementation plan. It is intentionally sequenced by dependency and commercial risk, not only by feature visibility. Low-cost customer-facing improvements can ship first for isolated pilots, but multi-tenant security is a release gate before multiple customers share one production environment.

## Product promise

ClassSignal should own this workflow:

> A participant asks a question, receives immediate grounded help when possible, escalates unresolved confusion to the instructor, and turns the final answer into reusable course knowledge and teaching insight.

## Current foundation

The application already has useful foundations:

- Public question board with class access code
- Question submission, voting, statuses and published answers
- Participant “My Questions” lookup and satisfaction feedback
- Focused instructor answer workspace and follow-up queue
- Local duplicate detection with optional Anthropic reranking
- AI draft generation
- FAQ/Theory HTML ingestion, visibility controls and version history
- Immediate local knowledge suggestion with participant approval/rejection
- Admin analytics and knowledge-gap starter view

Important current limitations:

- The application is single-tenant.
- Every authenticated Supabase account is effectively an administrator.
- AI keys are stored as plain text despite the database column being named `encrypted_api_key`.
- Participant identity is based on an unverified email address.
- Rate limiting is not implemented.
- Knowledge retrieval uses basic token overlap rather than source-aware semantic retrieval.
- Duplicate questions are labeled but their votes and lifecycle are not consolidated.
- There is no automated post-class brief.

---

## Phase 1 — Low effort and low operating cost: product polish and knowledge taxonomy

**Status:** Implemented in the current codebase. Database migration `202606280007_code_knowledge_type.sql` must be applied.

**Goal:** Improve the demonstration and content-management experience without changing the core tenancy model.

**Estimated engineering effort:** 3–7 working days  
**Infrastructure cost:** negligible  
**Safe target:** isolated customer pilots

### 1. Brand and navigation polish

- Increase the ClassSignal logo mark and improve small-screen sizing.
- Keep the brand component reusable so customer branding can be added later.
- Preserve the two primary product modules: Public Board and Admin.

### 2. Separate FAQ, Theory and Code knowledge types

Extend the knowledge taxonomy from `faq | theory` to:

- `faq`
- `theory`
- `code`

All three types must have identical capabilities:

- Upload and import
- Navigation/section detection
- Module ordering
- Draft/hidden/published visibility
- Version history
- Replacement and deletion
- Similarity retrieval
- Public display
- Citation in suggested answers

Recommended public presentation:

- One “Course Library” tab
- Three sub-tabs: FAQ, Theory and Code
- Consistent search, module filter and collapsed content cards

### 3. Low-cost code ingestion

Support formats that do not require complex binary parsing:

- `.py`: UTF-8 source text, filename, symbols and top-level comments/docstrings
- `.ipynb`: parse notebook JSON; retain Markdown and code cells; discard outputs by default
- Plain `.txt` and `.md` as optional additions

Security constraints:

- Never execute uploaded code or notebook cells.
- Enforce file-size and total-account storage limits.
- Escape code for display.
- Record filename, checksum, upload time and uploader.

### 4. Improve existing instant knowledge suggestions

The existing suggestion flow should display:

- “Pulled from FAQ”, “Pulled from Theory” or “Pulled from Code”
- Source document title
- Module/section title
- A link that opens the cited source section
- Local similarity/confidence band: High, Medium or Low
- “This answered my question”
- “I still need the instructor”

Do not show raw numerical confidence to students initially; use a human-readable band.

### Phase 1 acceptance criteria

- The three knowledge types can be independently uploaded, hidden and published.
- `.py` and `.ipynb` files render without execution.
- Every suggested answer has a visible source citation.
- Existing HTML FAQ/Theory behavior remains compatible.
- Mobile and dark-mode layouts pass visual review.

---

## Phase 2 — Commercial release gate: tenancy, roles and security

**Goal:** Make one shared deployment safe for multiple paying customers.

**Estimated engineering effort:** 3–6 weeks  
**Infrastructure cost:** low to medium  
**Release rule:** complete before self-service multi-customer SaaS

### 1. Multi-tenant customer isolation

Introduce these entities:

```text
organizations
organization_members
courses
class_sessions
participants
participant_sessions
```

Add `organization_id` to every customer-owned record, including:

- Questions and votes
- Feedback and similarity results
- Public settings and access codes
- AI settings
- Knowledge documents, versions and entries
- Analytics and teaching briefs

Add `course_id` and `class_session_id` where appropriate.

Every query, unique index and destructive operation must be tenant-scoped. “Reset public board” must affect only the selected course/session.

### 2. Instructor and administrator roles

Recommended roles:

- `owner`: billing, organization settings, members and all content
- `admin`: courses, members, settings and content
- `instructor`: questions, answers, knowledge and analytics for assigned courses
- `teaching_assistant`: moderation and answering without billing/security access
- `viewer`: read-only analytics

Replace all RLS policies equivalent to `to authenticated using (true)` with organization-membership checks.

Add:

- Invitation-only membership
- Course assignments
- Role-change audit events
- Protection against removing the final owner

### 3. Encrypted AI credentials

Preferred approaches, in order:

1. Managed secrets/Vault integration
2. Envelope encryption using a managed KMS
3. Server-side AES-256-GCM with a separately managed master key and key rotation

Requirements:

- Never store raw provider keys in application-readable table columns.
- Only server-side AI routes may decrypt/read a key.
- Bind secrets to `organization_id`.
- Record creator, last rotation time and last four characters.
- Support key replacement and deletion.
- Never write keys to logs, analytics or errors.

### 4. Rate limiting and abuse protection

Protect at minimum:

- Access-code validation
- Question submission
- Upvotes
- My Questions lookup
- Feedback submission
- Admin login
- File upload/import
- AI generation
- Duplicate detection
- Public-board reset

Recommended implementation:

- Distributed rate limiter such as Redis/KV for production
- Key by tenant + IP hash + participant/session identifier
- Separate burst and sustained limits
- CAPTCHA after repeated failed access-code attempts
- Per-organization AI usage budgets and hard limits
- File upload quotas

### 5. Verified participant identity or secure participant tokens

Default low-friction design:

1. Participant enters access code and email.
2. Server creates an opaque random participant session.
3. Only a hash of the token is stored.
4. Browser receives a secure, `HttpOnly`, `SameSite=Lax` cookie.
5. My Questions, voting and feedback use the participant session rather than trusting a submitted email.

Optional higher-assurance mode:

- Email OTP
- LMS identity
- Organization SSO

The instructor chooses the assurance level per course.

### 6. Audit trail

Record security-sensitive actions:

- Question deletion/archive/reset
- Answer publication and visibility changes
- Role and membership changes
- Knowledge publication/version replacement
- AI key changes
- Duplicate merges
- Data exports

### Migration approach

- Add nullable tenant columns first.
- Create a default organization/course for existing data.
- Backfill all existing records.
- Add foreign keys and `NOT NULL` constraints.
- Replace RLS policies.
- Run automated cross-tenant isolation tests.
- Only then enable multi-organization signup.

### Phase 2 acceptance criteria

- A user in Organization A cannot read, modify or infer Organization B data through UI, API or direct Supabase access.
- Every admin route enforces both authentication and role authorization.
- AI keys are encrypted and inaccessible to the browser.
- Participant email spoofing no longer grants access to another participant’s questions.
- Rate-limit behavior is tested and produces friendly errors.

---

## Phase 3 — Medium effort: robust document ingestion repository

**Status:** Implemented for the current single-tenant model. Apply migration `202606280011_phase3_ingestion_repository.sql`. OCR and isolated legacy `.ppt` conversion remain optional external workers.

**Goal:** Accept common teaching-material formats with provenance and safe processing.

**Estimated engineering effort:** 2–4 weeks  
**Infrastructure cost:** low to medium, depending on storage and extraction workers

### Supported formats

- PDF
- PowerPoint `.pptx`
- Optional legacy PowerPoint conversion only through an isolated conversion worker
- `.py`
- `.ipynb`
- HTML
- Markdown/text
- ZIP bundles containing supported files and referenced assets

### Ingestion architecture

Use an asynchronous pipeline:

```text
Upload → validate → virus scan → store original → extract → preview → admin selects sections → publish → index
```

Recommended tables:

```text
knowledge_sources
knowledge_source_versions
knowledge_sections
knowledge_assets
ingestion_jobs
```

Every section should retain:

- Organization/course ownership
- Knowledge type
- Original filename and version
- Page, slide, notebook-cell or code-line provenance
- Section sequence
- Extracted text
- Sanitized display content
- Checksum
- Visibility
- Processing status and error

### Format-specific behavior

#### PDF

- Extract text by page.
- Preserve page number for citations.
- Detect headings where possible.
- Use OCR only as a paid/optional capability for scanned documents.

#### Slide deck

- Extract slide title, text, speaker notes and safe images.
- Keep slide number for citations.
- Render a slide preview where feasible.

#### ZIP

- Prevent path traversal and zip bombs.
- Enforce compressed and expanded size limits.
- Reject executables and unsupported nested archives.
- Resolve relative HTML image references to stored assets.

#### Code and notebooks

- Never execute content.
- Index Markdown, comments, docstrings, function/class names and code separately.
- Allow the instructor to exclude cells/files containing secrets.

### Phase 3 acceptance criteria

- Processing happens outside the request/response timeout.
- Failed files do not partially publish.
- Admin sees extraction progress, warnings and a preview.
- Every public excerpt and AI citation links to an exact page/slide/cell/section.
- Re-upload creates a new source version and retires the old index.

---

## Phase 4 — Medium-to-high effort: grounded instructor copilot

**Goal:** Generate instructor drafts from approved course material, not generic model memory.

**Estimated engineering effort:** 2–4 weeks  
**Operating cost:** medium and usage-dependent

### Retrieval

- Add embeddings and vector search, preferably tenant-scoped `pgvector`.
- Retrieve only current, published sections from the selected course.
- Combine lexical matching with semantic retrieval.
- Apply module and source-type filters.
- Keep retrieved source identifiers and scores.

### Draft generation

The prompt must require:

- Answer as the instructor.
- Use supplied sources as the primary evidence.
- Cite section/page/slide/cell references.
- Separate sourced statements from instructor interpretation.
- State uncertainty when sources are insufficient.
- Never invent URLs or citations.

Admin output should show:

- Draft answer
- Supporting source cards
- Confidence band
- Unsupported-claim warning
- Copy to answer
- Edit and publish
- “No adequate source found” state

### Confidence

Confidence must not be the model’s unsupported self-rating. Derive it from:

- Retrieval coverage
- Agreement between lexical and semantic results
- Source recency/current-version status
- Citation coverage of generated claims

### Phase 4 acceptance criteria

- No unpublished or cross-tenant source can enter a prompt.
- Every grounded draft includes valid stored citations.
- Low-evidence questions clearly fall back to instructor review.
- AI cost and token usage are recorded per organization.
- Provider failure never blocks manual answering.

---

## Phase 5 — High-value intelligence: knowledge gaps and smart duplicate consolidation

**Goal:** Turn classroom activity into reusable knowledge and less instructor work.

**Estimated engineering effort:** 3–5 weeks  
**Operating cost:** medium

### 1. Knowledge-gap intelligence

Automatically identify:

- Concepts students repeatedly misunderstand
- Questions with no adequate knowledge match
- Questions whose suggested knowledge answer was rejected
- Suggested FAQ/Theory/Code additions
- Modules producing the most dissatisfaction

Recommended signals:

- Repeated semantic question clusters
- Upvote totals
- Rejected instant answers
- `not_satisfied` feedback
- Follow-up status
- Time unanswered
- Low retrieval confidence
- Frequency across class sessions

Each gap should display:

- Concept/cluster label
- Representative questions
- Number of participants and sessions affected
- Existing weak/related sources
- Suggested knowledge type
- “Create draft FAQ/Theory/Code entry” action
- Resolved/unresolved lifecycle

### 2. Smart duplicate consolidation

Move beyond setting `status = Duplicate`.

Introduce a canonical-question relationship:

- Canonical question owns the answer and public status.
- Duplicate question retains authorship and history.
- Votes are aggregated without double-counting the same participant.
- Feedback remains tied to the participant’s original question.
- Public duplicates link to the canonical question.
- Students see: “This question is being tracked with an existing question.”

Admin merge flow:

1. Show semantic candidates, scores and reasons.
2. Preview vote/participant impact.
3. Confirm merge.
4. Recalculate canonical vote count.
5. Notify affected participant sessions.
6. Allow undo through an audit-backed merge record.

### Phase 5 acceptance criteria

- Vote consolidation cannot inflate counts.
- Duplicate participants inherit canonical answer visibility.
- Knowledge gaps update when questions are answered or knowledge is published.
- Every recommendation is explainable through visible source questions/signals.

---

## Phase 6 — Medium effort: post-class teaching brief and five-minute demo loop

**Status:** Implemented for the current single-tenant model. Apply migration `202606280010_phase6_teaching_briefs.sql`. Email delivery remains Phase 7 infrastructure.

**Goal:** Deliver the product’s clearest recurring value after every session.

**Estimated engineering effort:** 1–3 weeks after Phases 4–5  
**Operating cost:** low for deterministic briefs; medium for optional AI narrative

### Post-class teaching brief

Generate one immutable brief per class session containing:

- Top unresolved questions
- Most confusing module
- Satisfaction signal
- Follow-up list
- Recommended FAQ/Theory/Code updates
- Suggested agenda for the next class

Use deterministic analytics first. AI may turn those facts into a narrative, but must not invent metrics.

Recommended delivery:

- Dashboard card after class closes
- Email digest to assigned instructors
- Export to Markdown/PDF
- Regenerate only when explicitly requested
- Preserve the input metrics used to generate each brief

### QR-code joining

- Generate a QR code for each active class session.
- QR points to a short join URL containing a non-secret session identifier.
- Participant still completes the configured identity/access step.
- Never embed the raw reusable access code in the QR URL.

### Target demonstration flow

The final demo should complete in under five minutes:

1. Student joins using a session QR code.
2. Student asks a question.
3. ClassSignal returns a cited Theory answer immediately.
4. Student selects “I still need the instructor.”
5. The question enters the instructor follow-up queue.
6. Instructor generates a grounded draft with citations and confidence.
7. Instructor edits and publishes it.
8. Student confirms satisfaction through the secure participant session.
9. Dashboard marks the knowledge gap resolved and updates the post-class brief.

### Phase 6 acceptance criteria

- The complete flow works without manually refreshing pages.
- Every state transition is visible to both participant and instructor.
- The brief uses session-scoped metrics and links back to source questions.
- QR links cannot be used to bypass identity or access policy.

---

## Phase 7 — High effort and higher cost: operational scale and institutional readiness

**Goal:** Support larger organizations and procurement requirements.

Potential scope:

- Real-time updates using Supabase Realtime or a controlled event channel
- Instructor/TA assignment and collaboration
- Email notifications and digests
- LMS integrations
- SSO/SAML and SCIM
- Data retention controls and customer deletion/export
- Custom branding and domains
- Accessibility audit targeting WCAG 2.2 AA
- Billing, subscriptions, quotas and entitlements
- Error monitoring, tracing and service-level dashboards
- Automated backups and restore drills
- Security review and penetration testing
- Data-processing agreement and institutional documentation

This phase should be driven by signed customer demand rather than built speculatively.

---

## Cross-cutting engineering requirements

Every phase must include:

- SQL migration with rollback/recovery notes
- Tenant-aware RLS tests once Phase 2 begins
- Unit tests for parsing, matching and validation
- API integration tests for authorization and failure paths
- Playwright tests for the public and admin critical paths
- Structured server logs without PII or secrets
- Loading, empty, success and failure states
- Mobile and dark-mode visual verification
- Feature flag for risky functionality
- Usage and cost metrics
- Documentation updates

## Suggested implementation order

```text
Phase 1 quick wins
    ↓
Phase 2 multi-tenant security release gate
    ↓
Phase 3 ingestion repository
    ↓
Phase 4 grounded copilot
    ↓
Phase 5 gap intelligence + duplicate consolidation
    ↓
Phase 6 teaching brief + polished demo loop
    ↓
Phase 7 institutional features based on demand
```

Do not implement Phase 4 or 5 globally before tenant isolation. Retrieval, AI settings and analytics must be tenant-scoped from their first production release.

## Pilot and launch milestones

### Milestone A — Managed pilot

- Phase 1 complete
- One isolated deployment/database per customer
- Manual onboarding
- Usage observed with 3–5 instructors

### Milestone B — Private multi-tenant beta

- Phase 2 complete
- Automated tests and staging environment
- 5–15 invited organizations
- Usage limits and support process

### Milestone C — Differentiated paid product

- Phases 3–6 complete
- Proven five-minute demo loop
- Grounded answers with citations
- Measurable instructor time saved
- Knowledge-gap resolution tracked across sessions

## Product success metrics

Measure outcomes rather than only activity:

- Percentage of questions receiving immediate knowledge suggestions
- Suggestion acceptance rate
- Median time to instructor answer
- Unanswered backlog at class close
- Satisfaction rate after published answers
- Repeat-question rate across sessions
- Knowledge gaps created versus resolved
- Instructor minutes saved per session
- Percentage of AI drafts published after editing
- Cost per answered question
- Weekly active instructors and returning courses
