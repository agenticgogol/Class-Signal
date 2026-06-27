# ClassSignal

**Every question heard. Every answer tracked.**

ClassSignal is a live classroom Q&A operations platform. Students use one access-gated public board to ask, upvote, track, and review published answers. Instructors use a protected workspace to understand classroom demand, answer questions quickly, follow up on dissatisfaction, generate AI drafts, detect duplicates, and export the record.

## Product modules

- **Public Board** (`/questions`) — access code, questions, submission, voting, published answers, personal lookup, and feedback.
- **Admin** (`/admin`) — analytics dashboard, focused answering workspace, AI tools, duplicate detection, settings, and export.

## Local development

```bash
npm install
npm run dev
```

Required environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Apply the SQL files in `supabase/migrations` to the Supabase project in filename order.

## Verification

```bash
npm run lint
npm run build
```
