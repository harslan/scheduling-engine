# Enterprise readiness — the honest ledger

The pilot is deliberately pilot-grade: fictitious identities, simulation-only
runs, a handful of invited users. This ledger tracks the distance from there
to running real offices for real faculty. Every line is either DONE (with the
commit/evidence) or OPEN (with its trigger — most items should be *caused* by
the pilot succeeding, not by momentum).

## Done

| Area | What | Evidence |
|---|---|---|
| Concurrency | Double-booking impossible at the DB layer: `no_double_booking` exclusion constraint (btree_gist, tsrange) on APPROVED roomed events; friendly 409/message in submit + quick-book | `prisma/sql/001-no-double-booking.sql`, applied to pilot DB |
| Concurrency | Swap accept is atomic: single-winner flip + assignment application commit in one transaction | `src/lib/swap-service.ts` |
| Concurrency | Whole-calendar hold rewrites serialized per org via `pg_advisory_xact_lock` | `src/lib/space-run.ts` |
| Integrity | Stale-run swaps expire on re-run and refuse consent; charter dials validated (slack [0,1], reserved ≤ rooms, named reserved rooms must exist) | swap-service, charter action |
| Integrity | Reserved rooms protected by name, not count (charter 6.2 literal) | `reservedRoomSlugs` |
| Time | One convention: org wall-clock in, true UTC instants stored, org tz rendered; DST-tested | `src/lib/orgtime.ts` + tests |
| AuthZ | All admin actions role-gated (audited); approver-notify helpers no longer network-invokable | audit 2026-08-05 |
| AuthZ | `/api/chat` verifies caller membership in the body-supplied org (404 on non-member); tools pinned to the server-verified org/user instead of model-supplied ids; non-admins booked under their own identity | `src/app/api/chat/route.ts`, `src/__tests__/chat-route.test.ts` |
| Auth surface | Pilot deny-by-default lockdown; anonymous → login/401 everywhere | `src/proxy.ts` |
| Headers | HSTS, nosniff, frame-deny, referrer policy, permissions policy | `next.config.ts` |
| Monitoring hook | `/api/health` (public, status-only) for uptime probes | `src/app/api/health/route.ts` |
| Backups | Repeatable logical backup script; first backup taken 2026-08-05 | `scripts/backup-db.sh` |
| CI | Typecheck + 200 unit tests on every push/PR | `.github/workflows/ci.yml` |
| Tests | 200 unit tests incl. allocation parity vs Python reference, orgtime DST | `src/__tests__/` |

## Open — with triggers

| Area | What | Trigger / owner |
|---|---|---|
| Identity | Suffolk SSO (SAML/Entra), per-person accounts, MFA, session revocation | Pilot greenlight; Suffolk IT engagement (roadmap Phase 3) |
| Identity | Passwords currently shared via file for 3 demo accounts | Dies the day SSO lands |
| Monitoring | Uptime probe on `/api/health`; error tracking (e.g. Sentry); alerting | Needs an account decision; ~half a day |
| Backups | Scheduled (not manual) backups + restore drill; consider Supabase Pro PITR | Before any real (non-fictitious) data |
| Infra | Free-tier Supabase + hobby Vercel; no staging environment | Before real data; paid tiers + a staging project |
| Recurrence | Recurring occurrences (`event_instances`) have no DB-level double-booking backstop; **fully app-checked** on every write path (`getExistingInstances` gathers one-off events *and* instances across parent/child rooms; `checkConflictsForInstance` compares against all). Residual gap is only the check-then-write **race** for simultaneous submissions where ≥1 is recurring — nil at pilot scale. Not a one-liner to fix: an `EXCLUDE` constraint is single-table, but the conflict spans `events` + `event_instances`. Two real options — (a) per-room `pg_advisory_xact_lock` around the recurring write to serialize the race cheaply (mirrors `space-run.ts`), or (b) a unified occurrence table for a true DB guarantee (large refactor). Denormalizing `roomId` onto instances is a trap: still can't cover instance-vs-one-off, adds sync-bug surface across ~5 write paths. | Schema/locking change; bundle with next migration. Do NOT hasty-patch pre-pilot — the race can't occur at pilot scale and a partial fix risks a worse bug. |
| Email/cron | Disabled on pilot by design; production validation needed when enabled | Pilot → production cutover |
| Assurance | E2E suite in CI (playwright exists, needs DB service), load test, security review/pen test | Pilot greenlight; ~1 week |
| Governance | `schedulingCutoffDays` double meaning (min-advance vs recurrence horizon) | Product decision with the Dean's office |
| Transition | **Minimum-displacement assignment** — PILOT-BRIEF and proposed charter 10.1 promise that where the rule is indifferent about which room, the incumbent keeps theirs; the allocator's office→room mapping is currently sort-order only | Brenda's roster (who sits where today) — the feature and its data arrive together, before the first OFFICIAL run |

Full bug-audit trail: memory `project_sbs_pilot_bughunt` (2026-08-05) and commit history.
