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

0. **Brain into body** — ✅ done. `src/lib/allocation.ts` mirrors the Python
   reference; parity verified on real data (61 vs 60, tier-for-tier).
1. **The semester loop** — ✅ done. Declaration (2.2 as interface), the run
   (SIMULATION until ratified), the reveal with clause-numbered reasons,
   swap-by-unanimous-consent (race-safe: approval rows + single-winner
   transition), the charter admin with required reasons and a change log,
   the Dean's insights page, and the full-dress rehearsal: the real Spring
   feed imported under invented names (`scripts/import-registrar.ts`).
2. **In front of humans** — ← now. `PILOT-BRIEF.md` to the Dean; the
   fifteen-minute walkthrough; the comment window with the packet
   (`sbs-space/charter/comment-packet/`). The next feature commits should be
   *caused by feedback*, not by us.
3. **Real inputs**: Suffolk SSO; the reconciled room schedule (possibly via
   the existing Infor Reserve integration); release records — the run refuses
   official status without them.
4. **Pilot**: fresh isolated deployment (never the INCAE production instance),
   shadow mode — pilot the system, not the move — one or two departments, Fall.

## Hard rules carried over from the charter work

- A **draft** charter (null ratification anchor) validates simulations only.
- While release records are unconnected, **no real allocation runs at all**.
- Hard floors change only through `sbs-space/BOUNDARY-LOG.md`.
- Occupancy is measured by room, never by person; personnel-adjacent data
  stays out of git.
- Demo/pilot data uses the shared invented cast (checked against the real
  roster for zero surname overlap).
