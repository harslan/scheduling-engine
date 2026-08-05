-- The double-booking race, closed at the only layer that can close it.
--
-- Every booking path is check-then-write: two simultaneous submissions for
-- the same room/time both pass detectConflicts and both persist. This
-- exclusion constraint makes the second INSERT/UPDATE fail atomically.
-- App code catches constraint name "no_double_booking" and returns the
-- normal conflict message.
--
-- Scope: single (non-recurring) APPROVED events with a room. Recurring
-- instances live in event_instances (no room column) and remain app-checked.
-- tsrange is half-open [), so back-to-back bookings (end == next start)
-- do not conflict.
--
-- Applied to the pilot DB 2026-08-05. Idempotent.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_double_booking'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT no_double_booking
      EXCLUDE USING gist (
        "roomId" WITH =,
        tsrange("startDateTime", "endDateTime") WITH &&
      )
      WHERE (
        status = 'APPROVED'
        AND deleted = false
        AND "roomId" IS NOT NULL
        AND "startDateTime" IS NOT NULL
        AND "endDateTime" IS NOT NULL
      );
  END IF;
END $$;
