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
| Recurrence | `event_instances` not covered by the exclusion constraint (no room column); app-checked only | Schema change; bundle with next migration |
| Chat | `/api/chat` trusts body organizationId (cross-org in multi-tenant) | Before any second org shares the deployment |
| Email/cron | Disabled on pilot by design; production validation needed when enabled | Pilot → production cutover |
| Assurance | E2E suite in CI (playwright exists, needs DB service), load test, security review/pen test | Pilot greenlight; ~1 week |
| Governance | `schedulingCutoffDays` double meaning (min-advance vs recurrence horizon) | Product decision with the Dean's office |
| Transition | **Minimum-displacement assignment** — PILOT-BRIEF and proposed charter 10.1 promise that where the rule is indifferent about which room, the incumbent keeps theirs; the allocator's office→room mapping is currently sort-order only | Brenda's roster (who sits where today) — the feature and its data arrive together, before the first OFFICIAL run |

Full bug-audit trail: memory `project_sbs_pilot_bughunt` (2026-08-05) and commit history.
