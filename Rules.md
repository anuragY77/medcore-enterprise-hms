# Implementation Rules
## MedCore Premium Enterprise Hospital Management System

**Version:** 1.0
**Date:** August 30, 2026

---

## A. Before Starting Work

1. Read `PRD.md`, `Architecture.md`, `Phases.md`, and `Design.md` before beginning any task.
2. Check the current phase in `Phases.md` and confirm what is in scope.
3. Inspect existing code before modifying it. Never assume a file exists — read it first.
4. Check `Memory.md` (once created after coding begins) for current state, decisions, and blockers.
5. Understand the module you are working on and its relationship to other modules.
6. Confirm the canonical screen reference for the screen you are implementing.

---

## B. Scope Rules

1. Complete one task at a time. Do not implement multiple unrelated features in a single pass.
2. Do not skip phases without a dependency-based reason. If a dependency is missing, document it.
3. Do not implement features outside the current phase scope unless explicitly approved.
4. Do not refactor code you are not actively working on.
5. Keep changes focused. A single task should produce a single coherent set of changes.

---

## C. Design Rules

### Canonical Design System

DS1 "Clinical Precision" is the **only** canonical implementation design system.

| Token | Value |
|-------|-------|
| Primary | `#064E3B` (forest green) |
| Secondary | `#1E293B` (dark navy) |
| Background | `#F8F9FF` |
| Main text | `#0B1C30` |
| Card background | `#FFFFFF` |
| Headline font | Plus Jakarta Sans |
| Body font | Inter |
| Button radius | 4px |
| Card radius | 8px |
| Border color | `#E2E8F0` (subtle) |
| Muted text | `#64748B` |

### Strict Visual Rules

- **No gradients.** Use flat colors only.
- **No glassmorphism.** Use solid backgrounds with subtle borders.
- **No consumer-style redesign.** Maintain enterprise healthcare aesthetic.
- **No random visual changes.** Every visual decision must match DS1 or be explicitly approved.
- **No heavy shadows.** Use subtle, restrained shadows.
- **No neon or bright accent colors.** Use the DS1 palette only.

### Screen Reference Rules

- Use approved canonical screens as primary visual references (see `Design.md` for full list).
- Do not use duplicate/experimental/superseded Stitch screens as implementation references.
- New P0/P1 screens are approved references.
- When in doubt, check the screen hierarchy in `Design.md`.

---

## D. Stitch Rules

These rules protect the design archive. Violating them risks destroying the visual source of truth.

1. **Never** delete existing Stitch screens.
2. **Never** modify existing Stitch screens.
3. **Never** regenerate or replace existing Stitch screens.
4. **Never** create or modify Stitch design systems.
5. Existing Stitch screens are **reference material only** — they are not code.
6. Do not attempt to "sync" or "update" Stitch screens to match implementation.
7. Do not treat duplicate/experimental Stitch screen variants as implementation references.

---

## E. Code Rules

### TypeScript

1. All code must be TypeScript. No JavaScript files.
2. Avoid `any` type. Use proper types or `unknown` when necessary.
3. Use Zod schemas for external input validation and derive TypeScript types from them.

### Components

4. Prefer reusable components over one-off implementations.
5. Avoid unnecessary duplication. If a pattern appears 3+ times, extract it.
6. Keep components focused on a single responsibility.
7. Follow the composition pattern: `PageHeader` + `StatsRow` + `ContentGrid` + `Card`/`DataTable`.
8. Use shadcn/ui primitives as the foundation. Customize via Tailwind, not by rewriting.

### Code Quality

9. Follow existing patterns once established. Consistency > novelty.
10. Do not add dependencies without a clear, documented need.
11. Avoid over-engineering. Build what is needed now, not what might be needed later.
12. Do not create abstract "utils" or "helpers" until the pattern is concrete.
13. Use meaningful variable and function names.
14. Keep file sizes reasonable. Split large files when they exceed ~300 lines.

### Error Handling

15. Do not silently swallow errors. Log them or show user feedback.
16. Use toast notifications for user-facing errors.
17. Use error boundaries for application-level errors.
18. Validate all external input (API params, form data, URL params).

---

## F. Security Rules

1. **Never** hardcode secrets, API keys, or passwords in source code.
2. Use environment variables for all configuration secrets.
3. Validate all input on the server side (API routes), even if validated on the client.
4. Enforce authorization server-side. Never rely solely on client-side access control.
5. Do not expose sensitive data (passwords, tokens, internal IDs) in API responses.
6. Use fictional demo data (Sarah Jenkins, PT-10482) for all clinical examples.
7. Hash passwords with bcrypt before storage.
8. Use parameterized queries (via Drizzle ORM) to prevent SQL injection.
9. Do not log sensitive data (passwords, tokens, health information) in application logs.

---

## G. Database Rules

1. Use Drizzle migrations for all schema changes. Never modify the database directly.
2. Do not change schema destructively (dropping columns, renaming tables) without review.
3. Use database transactions where operations must be atomic.
4. Preserve relational integrity with foreign keys.
5. Add indexes on frequently queried columns (patient MRN, user email, foreign keys).
6. Use UUIDs for primary keys (Drizzle `defaultRandom()`).
7. Include `created_at` and `updated_at` timestamps on all major tables.
8. Seed database with realistic demo data for development.

---

## H. Quality Rules

1. After completing a task, run `npm run lint` and `npm run typecheck` (or `tsc --noEmit`).
2. Fix any errors introduced by the current task before moving on.
3. Do not claim tests passed unless actually run.
4. Verify the implemented screen visually matches the canonical Stitch reference.
5. Test edge cases: empty states, loading states, error states, long text, missing data.

---

## I. Documentation Rules

1. **Do not create `Memory.md` yet.** It must only be created after actual coding begins.
2. After coding begins, create `Memory.md` in `docs/`.
3. Update `Memory.md` after every meaningful completed work unit.
4. `Memory.md` must contain:
   - Current phase
   - Completed work items
   - Current task (what is being worked on right now)
   - Next task (what comes next)
   - Key decisions made
   - Blockers or issues
   - Verification status (what has been tested/checked)
5. Do not create additional documentation files beyond the five master files and `Memory.md`.
6. Do not create README files unless explicitly requested.

---

## J. Model Rules

This project must use OpenCode Zen free models only. No paid models.

### Primary Model

**`opencode/mimo-v2.5-free`** — Use for all critical work:
- Architecture decisions
- Complex React/TypeScript coding
- Backend/API development
- Database schema design
- Debugging and refactoring
- Security-sensitive logic
- Stitch MCP operations
- Testing

### Fast Repetitive UI Model

**`opencode/nemotron-3.5-lightning-free`** — Use for:
- Repetitive CRUD screens
- Form layouts following established patterns
- Table configurations
- Boilerplate component creation

### Backup Models

**`opencode/nemotron-3-ultra-free`** — Backup for architecture and coding
**`opencode/ling-3.0-flash-fin-free`** — Fast backup for simpler tasks
**`opencode/big-pickle`** — Experimental use only

### Excluded Models

**`opencode/muse-spark-1.2-contributor-free`** — Do not use. Data is used for model training, which is unsuitable for proprietary project code.

### Model Selection Rules

1. Default to `mimo-v2.5-free` unless the task is clearly simple/repetitive.
2. Switch to `nemotron-3.5-lightning-free` only for pattern-based UI work after patterns are established.
3. Never use a paid model. If a free model fails, retry or try a different free model.
4. Document any model switching decisions in `Memory.md`.

---

## K. Git Rules

1. Commit with clear, descriptive messages.
2. Do not commit secrets, `.env.local`, or node_modules.
3. Do not force-push unless explicitly approved.
4. Create feature branches for major changes (optional for single-developer workflow).
5. Review `git diff` before committing to ensure only intended changes are included.

---

*These rules are mandatory. Violating them requires reverting the change and redoing it correctly.*
