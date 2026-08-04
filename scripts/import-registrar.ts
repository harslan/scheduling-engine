/**
 * Registrar rehearsal import: the product swallows the REAL schedule.
 *
 *   DATABASE_URL=...sbs_demo... npx tsx scripts/import-registrar.ts \
 *     [feedPath] [orgSlug]
 *
 * Reads the actual section feed (read-only, in place — personnel-adjacent,
 * never copied into this repo), aggregates measured teaching per instructor
 * for Spring 2026 / SBS / In-Person — the same filter as the reference
 * demand model — and writes it into TeachingRecords under INVENTED names.
 * Real schedules, fictional identities; the mapping is never stored.
 *
 * Also tops the org's offices up to the provisional Sargent supply (64) and
 * sets reservedOffices=4 (the Law School commitment, charter 6.2) THROUGH the
 * charter service, so the change lands in the log with its reason.
 */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";
import { inventedNames, castEmail } from "../src/lib/demo-cast";
import { updateCharter } from "../src/lib/charter-service";
import { currentSemester } from "../src/lib/semester";

const FEED =
  process.argv[2] ??
  "/Users/barut/projects/sbs-course-analysis/data/sections.json";
const ORG_SLUG = process.argv[3] ?? "sawyer";

const TERM = "Spring 2026";
const SBS = new Set([
  "ACCT", "ACIB", "BLE", "BLLS", "EMBA", "ENT", "FIN", "FPP", "ISOM",
  "MBA", "MGOB", "MGT", "MKT", "SBS", "SIB", "TAX", "PAD",
]);
const VALID_DAYS = new Set(["M", "T", "W", "TH", "F", "S", "SU"]);
const TARGET_OFFICES = 64; // provisional Sargent 5 supply (image-read)

type Section = {
  AcademicPeriod: string;
  SubjectId: string;
  DeliveryMode: string;
  Section: string;
  Instructor: string[];
  MeetingDayPatterns: string[][] | null;
};

async function main() {
  const feed: Section[] = JSON.parse(fs.readFileSync(FEED, "utf8"));
  const inScope = feed.filter(
    (s) =>
      s.AcademicPeriod === TERM &&
      SBS.has(s.SubjectId) &&
      s.DeliveryMode === "In-Person",
  );

  // measured presence per instructor — mirrors the reference demand model
  const people = new Map<string, { days: Set<string>; sections: Set<string> }>();
  for (const s of inScope) {
    const names = (s.Instructor ?? []).filter((n) => n && n.trim());
    for (const pattern of s.MeetingDayPatterns ?? []) {
      for (const tok of pattern) {
        if (!VALID_DAYS.has(tok))
          throw new Error(`Unknown day token ${tok} — refusing to drop it silently`);
      }
      for (const name of names) {
        const p = people.get(name) ?? { days: new Set(), sections: new Set() };
        for (const tok of pattern) p.days.add(tok);
        p.sections.add(s.Section);
        people.set(name, p);
      }
    }
  }
  console.log(
    `feed: ${inScope.length} in-scope sections, ${people.size} instructors with meetings`,
  );

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`org ${ORG_SLUG} not found — seed first`);
  const dean = await prisma.user.findUnique({ where: { email: "dean@sawyer.demo" } });

  // deterministic mapping: sorted real names -> invented cast. Never stored.
  const realNames = [...people.keys()].sort();
  const cast = inventedNames(realNames.length);
  const semester = currentSemester();

  await prisma.teachingRecord.deleteMany({
    where: { organizationId: org.id, semester },
  });

  const DAY_ORDER = ["M", "T", "W", "TH", "F", "S", "SU"];
  let created = 0;
  for (let i = 0; i < realNames.length; i++) {
    const p = people.get(realNames[i])!;
    const castName = cast[i];
    let user = await prisma.user.findFirst({ where: { name: castName } });
    user ??= await prisma.user.create({
      data: { email: castEmail(castName), name: castName }, // no password: not a login
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: {},
      create: { organizationId: org.id, userId: user.id, role: "USER" },
    });
    await prisma.teachingRecord.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        semester,
        days: DAY_ORDER.filter((d) => p.days.has(d)).join(","),
        nSections: p.sections.size,
        source: "registrar Spring 2026 feed — full-dress rehearsal, invented identity",
      },
    });
    created++;
  }
  console.log(`teaching records written: ${created} (semester ${semester})`);

  // top offices up to the provisional Sargent supply
  const charter = await prisma.spaceCharter.findUnique({
    where: { organizationId: org.id },
  });
  const privateSlugs = new Set(
    (charter?.privateRoomSlugs ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const rooms = await prisma.room.findMany({ where: { organizationId: org.id, active: true } });
  const officeCount = rooms.filter((r) => !privateSlugs.has(r.slug)).length;
  let added = 0;
  for (let n = officeCount; n < TARGET_OFFICES; n++) {
    const num = 5301 + added;
    await prisma.room.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: String(num) } },
      update: {},
      create: {
        organizationId: org.id,
        name: `Office ${num}`,
        slug: String(num),
        iconText: String(num).slice(-2),
        sortOrder: 100 + added,
        capacity: 2,
        notes: "Enclosed, lockable. Provisional Sargent supply (image-read).",
      },
    });
    added++;
  }
  console.log(`offices: ${officeCount} existing + ${added} added = ${TARGET_OFFICES}`);

  // the Law School commitment — through the service, so it's LOGGED (10.2)
  if ((charter?.reservedOffices ?? 0) !== 4 && dean) {
    const r = await updateCharter(
      org.id,
      dean.id,
      { reservedOffices: 4 },
      "Four Sargent offices committed to the Law School this AY (charter 6.2, per the Dean's email) — set aside before any SBS allocation.",
    );
    console.log("charter: reservedOffices -> 4,", "error" in r ? r.error : "logged");
  }
  console.log("rehearsal import complete.");
}

main().finally(() => prisma.$disconnect());
