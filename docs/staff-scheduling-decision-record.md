# Staff Scheduling — Product Decision Record (TEMPLATE)

Status: **DRAFT — awaiting product-owner approval. Nothing may be built until every
question below has a recorded decision.**

Context: PRD module 10 lists "Doctor availability, leave management, shifts" as a
one-line entry with no entity model, no UI, no permission keys, and no role owner.
The staff module today is a directory (list/profile) plus departments — deliberately
no scheduling surfaces exist. Phase 29/30 confirmed there is no scheduling table in
the 25-table schema and no scheduling key in the 42-key permission matrix. Inventing
any of the answers below would risk rework, authz debt, and booking-integration
conflicts, so they are recorded here for decision instead.

How to use: for each question, pick ONE option (or write a variant), fill the
Decision / Owner / Date fields, then flip the top-level Status to APPROVED and open
an implementation phase scoped to the approved answers.

---

## 1. Entity model

What does "a shift" mean in the data model?

- [ ] **A. Recurring availability** — weekly patterns per doctor (e.g. Mon 09:00–17:00),
  exceptions layered on top.
- [ ] **B. Dated shift instances** — concrete rows per date (e.g. Dr. Patel,
  2026-10-12, 08:00–16:00, OT-2), allocated from a template or by hand.
- [ ] **C. Leave requests only** — absence-driven model; available time is "everything
  not on leave".
- [ ] **D. Combination** — recurring availability + dated overrides + leave as a
  separate state (most complete, most expensive).

Decision: ____________________  Owner: ____________  Date: __________

## 2. Editing ownership

- [ ] **A. Administrator-managed** — only ADMIN (or a new SCHEDULER role) creates and
  edits shifts/availability; staff read-only.
- [ ] **B. Staff self-service** — doctors propose/request; admin approves or edits.
- [ ] **C. Hybrid** — admin owns shifts; staff own leave requests.

Decision: ____________________  Owner: ____________  Date: __________

## 3. Leave approval workflow

- [ ] **A. None** — leave is recorded, first-come-first-served, no approval step.
- [ ] **B. Single approver** — one designated role approves/rejects.
- [ ] **C. Two-step** — department head then HR/admin.

Decision: ____________________  Owner: ____________  Date: __________

## 4. Overlap and conflict rules

- [ ] **A. Hard block** — the database rejects any overlapping shift/leave for the
  same person (transactional, like the bed double-admission guard).
- [ ] **B. Soft warning** — overlaps allowed with an explicit confirmation.
- [ ] **C. No rules** — display-only; conflicts resolved offline.

Decision: ____________________  Owner: ____________  Date: __________

## 5. Booking integration

PRD line 137 says appointments are "scheduling with physician availability", but
appointment creation today does NOT consult any availability source.

- [ ] **A. Booking must consult availability** — appointment creation rejects slots
  outside approved availability/on leave (behavior change to the appointment
  workflow; needs API + UI updates + tests).
- [ ] **B. Availability is advisory** — shown in the picker, not enforced.
- [ ] **C. No integration** — scheduling is independent of appointments.

Decision: ____________________  Owner: ____________  Date: __________

## 6. Roles and permission keys

The current matrix has 42 keys and no scheduling owner.

- [ ] **A. Reuse ADMIN only** — no new keys; scheduling pages gated on existing
  admin permissions.
- [ ] **B. New role SCHEDULER** — dedicated role + new keys
  (`scheduling:read`, `scheduling:write`, `leave:approve`, …).
- [ ] **C. Split** — staff read own schedule (`schedule:self:read`); admin writes.

Decision: ____________________  Owner: ____________  Date: __________

## 7. Retention and reporting

- [ ] **A. Operational only** — current shifts + pending requests; no history kept
  beyond the active period.
- [ ] **B. Audit-style retention** — historical shifts/leave retained in the audit
  timeline; standard audit retention applies.
- [ ] **C. Reporting requirements exist** — list them: ______________________

Decision: ____________________  Owner: ____________  Date: __________

---

## Approval

When all seven decisions above are filled in, the product owner signs off:

Approved by: ____________________  Date: __________

Implementation may then be scoped as a new phase (schema migration + permission
matrix extension + UI + booking integration per decision 5A), with the usual
quality gates. Until then the application behavior stays exactly as it is today.
