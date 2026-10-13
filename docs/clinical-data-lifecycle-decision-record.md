# Clinical Data Lifecycle — Product Decision Record (TEMPLATE)

Status: **DRAFT — awaiting product/compliance-owner approval. No retention or
deletion policy may be implemented until every question below has a recorded
decision.**

Context: Phase 32 traced every foreign-key relationship in the 25-table schema
and every code path that can delete clinical data. The application today ships
a **hard-delete** endpoint for patients (`DELETE /api/patients/[id]`,
ADMIN-only via `patients:delete`) that cascade-erases the patient's entire
clinical child set in one transaction, while the audit trail of the action
survives. No retention period, archival process, or legal basis is documented
anywhere in the repository or the PRD. Inventing an answer would risk
regulatory exposure and irreversible data loss, so the current behaviour is
recorded here and the choices are put to the owners.

How to use: for each question, pick ONE option (or write a variant), fill the
Decision / Owner / Date fields, then flip the top-level Status to APPROVED and
open an implementation phase scoped to the approved answers.

---

## Current behaviour (verified in Phase 32, evidence in repo)

### Patient record (`DELETE /api/patients/[id]`, ADMIN only)

One transaction (locks patient, releases held beds, deletes patient):

| Table | FK behaviour on patient delete |
|---|---|
| `patient_allergies` | CASCADE (erased) |
| `patient_conditions` | CASCADE (erased) |
| `patient_medications` | CASCADE (erased) |
| `consultations` | CASCADE (erased) |
| `prescriptions` | CASCADE (erased) |
| `medical_records` | CASCADE (erased) |
| `vitals` | CASCADE (erased) |
| `appointments` | CASCADE (erased) |
| `lab_tests` | CASCADE (erased) |
| `invoices` | CASCADE (erased) |
| `insurance_claims` | CASCADE (erased) |
| `emergency_cases` | CASCADE (erased) |
| `surgeries` | CASCADE (erased) |
| `beds.patient_id` | SET NULL (route pre-releases held beds to `Available`) |
| `audit_logs` | **survives** (`entity_id` has no FK; the `patient.delete` and any `bed.release` rows remain as the action history) |
| `notifications` | unaffected (no patient FK) |

Regression coverage: `tests/integration/audit-reliability.test.ts` asserts the
cascade of prescriptions/lab_tests, the bed release, and the survival of the
audit rows after deletion.

### User record (`DELETE /api/users/[id]`, ADMIN only)

- `audit_logs.actor_id` is `ON DELETE RESTRICT`: a user with any audit history
  (e.g. every user who ever logged in) cannot be deleted — the API returns
  409 "related records exist". Verified in Phase 24 S13 and handled in the route.
- `notifications.recipient_id` and `session_activity.user_id` CASCADE.
- Attribution history (audit rows naming the deleted user as actor) is
  therefore always preserved, but the users row the LEFT JOIN in
  `GET /api/audit-logs` displays as `actor: null` once a user is removed at
  the database level (bypassing the API guard).

### Audit trail

- Append-only at the application layer: no UPDATE/DELETE code path exists;
  Phase 32 moved clinical mutation audits into the same transaction as the
  mutation (see README "Audit semantics"), so success responses guarantee
  audit rows committed.
- No retention/pruning of `audit_logs` exists; the table grows unbounded.
- `audit_logs.entity_id` deliberately has no FK so history outlives entities.

### Everything else

No other DELETE endpoints exist for clinical data (appointments, prescriptions,
lab tests, invoices, beds, staff are deleted only via their parent cascade or
are read/update only). Status fields (`Active`/`Discharged`/`Completed`/…)
function as soft state, not as archival.

---

## 1. Patient-record deletion

The API exposes hard delete today, which erases prescriptions, results,
invoices and every other clinical child.

- [ ] **A. Keep hard delete** (current) — accept that ADMIN can irreversibly
  erase a patient and their full clinical history; audit rows remain.
- [ ] **B. Replace with soft delete / archive flag** — patient and children
  remain queryable; UI hides archived patients; delete becomes "archive".
  (Requires schema migration + API + UI changes.)
- [ ] **C. Restrict hard delete** — only allowed when the patient has no
  clinical children (registration errors only); otherwise reject.
- [ ] **D. Remove the endpoint** — deletion is never permitted; status changes
  only.

Decision: ____________________  Owner: ____________  Date: __________

## 2. Retention period (if any)

No retention duration is documented anywhere. If the organisation operates
under a legal/regulatory retention requirement (e.g. national health-records
law), it must be supplied by the compliance owner — this repository will not
assume one.

- [ ] **A. No fixed retention** — records kept until explicitly deleted under
  decision 1.
- [ ] **B. Fixed retention N years after last encounter** — list N: __________
  (requires an archival job + legal citation).
- [ ] **C. Owner will provide the requirement** — attach: __________________

Decision: ____________________  Owner: ____________  Date: __________

## 3. Audit-trail retention

`audit_logs` currently grows without bound and has no pruning.

- [ ] **A. Keep forever** (current) — acceptable for a single-hospital
  deployment with modest traffic; plan for table-size monitoring.
- [ ] **B. Retain N years, then archive/export and prune** — list N: __________
  (requires an export format + a pruning job; must not run without approval).
- [ ] **C. Owner will provide the requirement** — attach: __________________

Decision: ____________________  Owner: ____________  Date: __________

## 4. Billing and insurance history after patient deletion

Today invoices and insurance claims are CASCADE-erased with the patient. If
finance must retain issued-invoice history for accounting law, decision 1A is
unacceptable as-is.

- [ ] **A. Accept cascade** — billing history erased with the patient.
- [ ] **B. Retain financial rows** — invoices/claims become anonymised
  orphans or switch to SET NULL + separate retention (requires migration).

Decision: ____________________  Owner: ____________  Date: __________

## 5. Orphaned-user attribution

When a user row is removed at the database level (outside the API's RESTRICT
guard), audit rows keep the actor UUID but the `GET /api/audit-logs` join
shows `actor: null`.

- [ ] **A. Accept** — UUID remains in the row; investigators can correlate
  with external records.
- [ ] **B. Snapshot actor name/role into audit metadata at write time** —
  denormalised display survives user removal (small schema/metadata change).

Decision: ____________________  Owner: ____________  Date: __________

---

## Approval

When all five decisions above are filled in, the product/compliance owner
signs off:

Approved by: ____________________  Date: __________

Implementation may then be scoped as a new phase (schema migration + API +
UI + retention jobs per the approved answers), with the usual quality gates.
Until then the application behaviour stays exactly as it is today.
