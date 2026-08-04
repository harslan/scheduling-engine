# SBS Faculty Space — the product

The enterprise build: this codebase (the **body** — auth, rooms, recurring
bookings, conflict detection, approvals, email, calendar, kiosk, multi-tenant,
Vercel) merged with the `sbs-space` allocation engine (the **brain** — measured
claims, stable matching, three tiers), the unified demo's design (the **face**),
and the charter machinery (the **law** — ratifiable config, drift check,
boundary log).

**Operating principle: freeze the invariant, make the contested part data.**
Faculty and Dean feedback lands as charter amendments and config changes — never
rewrites. The engine refuses to run a rule that drifted from the ratified text.

## Phases

0. **Brain into body** (now): `src/lib/allocation.ts` — deferred acceptance,
   blocking-pair verification, three-tier allocation — mirroring the Python
   reference (`sbs-space/src/allocate.py`) with the same tests. The Python
   engine stays the reference implementation; parity is checked, not assumed.
1. **The semester loop**: declaration UI (schedule pre-filled, partner pick,
   the what-if that visibly changes nothing — clause 2.2), allocation run as an
   admin action producing office-holds as recurring events, the reveal page
   with the clause-numbered reason trace, swap-by-unanimous-consent on the
   approval queue.
2. **Real inputs**: Suffolk SSO; the reconciled room schedule (possibly via the
   existing Infor Reserve integration); the release-records connection —
   which the allocation gate requires before any real run.
3. **Pilot**: fresh isolated deployment (never the INCAE production instance),
   one or two departments, Fall.

## Hard rules carried over from the charter work

- A **draft** charter (null ratification anchor) validates simulations only.
- While release records are unconnected, **no real allocation runs at all**.
- Hard floors change only through `sbs-space/BOUNDARY-LOG.md`.
- Occupancy is measured by room, never by person; personnel-adjacent data
  stays out of git.
- Demo/pilot data uses the shared invented cast (checked against the real
  roster for zero surname overlap).
