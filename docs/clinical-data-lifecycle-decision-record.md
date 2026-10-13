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
  Phase 32/33 moved clinical and financial mutation audits into the same
  transaction as the mutation (see README "Audit semantics"), so success
  responses guarantee audit rows committed, and audit failure rolls the
  mutation back.
- No retention/pruning of `audit_logs` exists; the table grows unbounded.
- `audit_logs.entity_id` deliberately has no FK so history outlives entities.
- **Not** append-only at the database layer: no trigger or permission
  prevents an UPDATE/DELETE run directly against the table (see decision 6
  for the proposal).

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

## 6. Database-level audit immutability (append-only enforcement)

Phase 33 verified the application layer never updates or deletes audit rows
(no endpoint, no code path), but that is not a DBA-level guarantee: any
connection with the application role can still run
`UPDATE audit_logs …` / `DELETE FROM audit_logs …` directly. A database
trigger can close that gap. **The trigger is documented here and deliberately
NOT deployed**, for two owner-dependent reasons:

1. Test and maintenance cleanup legitimately deletes synthetic audit rows
   (four integration test files delete their own `actor_id` rows). A hard
   block requires a maintenance escape hatch whose privilege model the owner
   must approve.
2. Audit-trail retention (decision 3) is unapproved. Deploying a hard block
   before a retention answer exists would later require a privileged
   bypass or a second migration to undo it.

Proposal (to deploy only after decisions 3 and 6 are approved):

```sql
-- Migration sketch — NOT applied. Review with decision-3 answer in hand.
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('medcore.audit_maintenance', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW; -- UPDATE path only reachable in maintenance mode
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only (% not permitted)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
```

Operational consequences if deployed:

- Application traffic is unaffected (only INSERTs audit rows).
- Direct `UPDATE`/`DELETE` against `audit_logs` fails with
  `restrict_violation` unless the session first runs
  `SET LOCAL medcore.audit_maintenance = 'on'` inside a transaction owned by
  a role the owner designates for maintenance/retention work.
- Integration-test cleanup must adopt the same `SET LOCAL` pattern before
  deleting synthetic rows (four files: `audit-reliability`,
  `clinical-workflows`, `concurrency-invariants`, `session-endpoint-guard`).
- The application role cannot self-grant the bypass beyond the GUC switch;
  restricting who can connect and run `SET` is a DBA control outside this
  repository.

Rollback plan (if a deployed trigger must be removed):

```sql
DROP TRIGGER IF EXISTS audit_logs_no_mutation ON audit_logs;
DROP FUNCTION IF EXISTS audit_logs_block_mutation();
```

Verification command (after any future deployment):

```sql
-- Must fail with restrict_violation:
BEGIN; DELETE FROM audit_logs WHERE false; COMMIT;  -- delete path blocked even for zero rows when the trigger raises BEFORE the scan? (use an existing row in a sandbox DB instead)
-- Practical check on a sandbox database with one synthetic row:
BEGIN;
DELETE FROM audit_logs WHERE id = '<synthetic-row-uuid>';  -- expect exception
ROLLBACK;
BEGIN;
SET LOCAL medcore.audit_maintenance = 'on';
DELETE FROM audit_logs WHERE id = '<synthetic-row-uuid>';  -- expect success
COMMIT;
```

Decision (deploy trigger now / after retention / never):
________________________________  Owner: ____________  Date: __________

---

## Approval

When all six decisions above are filled in, the product/compliance owner
signs off:

Approved by: ____________________  Date: __________

Implementation may then be scoped as a new phase (schema migration + API +
UI + retention jobs per the approved answers), with the usual quality gates.
Until then the application behaviour stays exactly as it is today.
