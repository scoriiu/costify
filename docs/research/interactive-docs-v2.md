# Interactive docs — v2 rebuild notes

## Context

In April 2026 we shipped a v1 of interactive docs so the team could answer the open questions in `docs/ro/intrebari-contabil-plan-conturi.md` directly in the UI instead of editing markdown files. The v1 is deliberately minimal — last-write-wins, no threading, no notifications, no history. This file captures the limitations we knew about at ship time and the shape of a proper v2 rebuild once we've used v1 for a while.

## v1 architecture (what shipped)

- **Storage**: one `DocAnswer` table, `@@unique([docSlug, sectionId])` enforces a single global answer per section
- **API**: `GET` and `POST` on `/api/docs/answers`, auth-gated, no RBAC beyond "logged in"
- **UI**: `<AnswerBlock>` client component injected by `DocMarkdown` when a page has `interactive: true` in `DOC_NAVIGATION`
- **Save model**: debounced auto-save (1.5s idle) + save on blur
- **Section identity**: slug of the `### h3` heading text (e.g. `ce-surse-oficiale-folosim`). Renaming a heading orphans its answer.
- **Author tracking**: `authorId` stores only the last editor. Previous editors are lost.

## Known limitations

1. **Last-write-wins overwrites collaborators.** If you and Claudia are both editing the same section at the same time, whoever saves second overwrites the other. There is no merge, no conflict detection, no "someone else is editing" indicator.
2. **No history.** Once someone overwrites an answer, the previous version is gone. We cannot recover lost edits.
3. **No threading.** You cannot have a back-and-forth conversation on a question. If Claudia answers and you disagree, you either overwrite her answer or append text marking "actualizare coriiu: ...". Ugly.
4. **Orphaned answers when headings change.** `sectionId` is derived from the heading text. Rename the heading in the markdown file, the answer disappears from the UI (still in DB, no way to recover except via `sectionText` lookup which we stored but don't expose).
5. **No notifications.** Nobody knows when someone answered something. You have to visit the page to see new content.
6. **No presence.** You cannot see who else is currently viewing or editing the doc.
7. **No markdown rendering in answers.** Typing `**bold**` shows as literal stars. Only plain text.
8. **No attachments.** No images, no file uploads, no links to specific journal entries or client pages.
9. **No search inside answers.** Answers are invisible to any global search we might add later.
10. **No per-tenant scoping.** These answers are platform-level. If Costify ever has multiple accounting firms sharing the platform, all firms see the same answers. (Not an issue today — single-tenant dev.)
11. **No audit trail.** Edits don't produce `AuditEvent` records. We can't see "who changed what and when" beyond the last update timestamp.
12. **No rate limiting on the API.** Theoretical DoS vector for a logged-in user. Not a practical concern with 2 users.

## v2 — what the proper version should look like

After using v1 for a few weeks we'll have real data on what the team actually needed. The v2 notes below are hypotheses, not requirements.

### Probable data model

```
DocThread {
  id, docSlug, sectionId, sectionText, createdAt
  @@unique([docSlug, sectionId])
}

DocMessage {
  id, threadId, authorId, content, createdAt, updatedAt, deletedAt
}

DocMessageRead {
  userId, messageId, readAt
  @@unique([userId, messageId])
}
```

One thread per section. Threads have many messages. Messages are edit-tracked (updatedAt) and soft-deletable. Read receipts for the "what's new since my last visit" view.

### UI shape

- Below each section, a **threaded conversation view** instead of a single textarea. Shows all messages chronologically with author, timestamp, "edited" indicator.
- A compose box at the bottom for new messages. Reply button on each message for threaded sub-replies (keep it to 1 level deep, no Reddit madness).
- A "2 new" badge in the section header and in the sidebar next to section titles, counting unread messages per section for the current user.
- Markdown rendering in messages — `**bold**`, lists, code blocks, links. Same renderer we use for doc bodies.
- Author avatars in the margin, like GitHub issues.

### Audit and history

- Every edit produces an `AuditEvent` with `before` and `after`
- Every message is append-only. Deletions are soft (deletedAt). You can see "deleted by Claudia at X" but not the original content after deletion (or show it with an expand).

### Notifications

- Email when someone replies to a message in a thread you participated in
- In-app notification badge in the nav bar
- Weekly digest: "3 new messages in docs this week"

### Presence

- Show "Claudia is viewing this page" via a lightweight WebSocket channel or polling
- Show "Coriiu is typing" in a specific thread
- Not strictly necessary for v2 — nice to have

### Search

- Include doc messages in a global search index
- "Find all sections where Claudia mentioned 'TVA'" kind of query
- Elasticsearch / Meilisearch / Postgres full-text — TBD based on volume

### Migration from v1

- Every v1 `DocAnswer` becomes a thread with one initial message from its `authorId`
- `sectionText` is preserved as the thread title
- The `updatedAt` timestamp becomes the message's `updatedAt`
- Zero data loss

## When to do the rebuild

**Trigger signals** that tell us v1 has outlived its usefulness:

- Someone loses an edit to a last-write-wins overwrite
- We want to have a real back-and-forth on a question and realize the single-textarea model is too cramped
- Claudia asks "can I see what changed since last week"
- We reach 20+ answers across multiple docs and the UI starts feeling dense
- Another doc needs interactivity (e.g. a second `intrebari-contabil-*` page) and we realize we'd benefit from the thread model

**Anti-trigger signals** — v1 is still serving us:
- We're answering questions once and not coming back to edit them
- The team is 2 people and we informally coordinate via chat/voice before editing
- The docs we use it on are small (1–2 dozen sections total)

## Lessons learned — to be filled in after some usage

*(Update this section after a few weeks of using v1.)*

- What we actually used the feature for:
- What felt broken:
- What we never used:
- Friction points:
- Unexpected use cases:
