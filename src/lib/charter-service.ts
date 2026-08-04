import { prisma } from "./prisma";

/**
 * Charter 10.2, in the product: a dial changes ONLY with a dated, reasoned
 * entry. A quiet edit is not an amendment — this service refuses it. Every
 * change lands in CharterChange (the in-product boundary log), and
 * ratification (10.4) is itself a logged change that flips future runs from
 * SIMULATION to OFFICIAL.
 */

export type CharterPatch = {
  thresholdDays?: number;
  reservedOffices?: number;
  slackFraction?: number | null;
  adjunctsInScope?: boolean | null;
  minSf?: number;
  privateRoomSlugs?: string;
};

const FIELDS: (keyof CharterPatch)[] = [
  "thresholdDays",
  "reservedOffices",
  "slackFraction",
  "adjunctsInScope",
  "minSf",
  "privateRoomSlugs",
];

const show = (v: unknown) =>
  v === null || v === undefined ? "UNDECIDED" : String(v);

export async function updateCharter(
  organizationId: string,
  byUserId: string,
  patch: CharterPatch,
  reason: string,
) {
  const charter =
    (await prisma.spaceCharter.findUnique({ where: { organizationId } })) ??
    (await prisma.spaceCharter.create({ data: { organizationId } }));

  const diffs = FIELDS.filter(
    (f) => f in patch && show(patch[f]) !== show(charter[f]),
  );
  if (diffs.length === 0) return { success: true, changed: 0 };
  if (!reason.trim()) {
    return {
      error:
        "A reason is required — a quiet edit is not an amendment (charter 10.2).",
    };
  }

  await prisma.$transaction([
    prisma.spaceCharter.update({
      where: { organizationId },
      data: Object.fromEntries(diffs.map((f) => [f, patch[f]])),
    }),
    ...diffs.map((f) =>
      prisma.charterChange.create({
        data: {
          organizationId,
          byUserId,
          field: f,
          fromValue: show(charter[f]),
          toValue: show(patch[f]),
          reason: reason.trim(),
        },
      }),
    ),
  ]);
  return { success: true, changed: diffs.length };
}

export async function ratifyCharter(
  organizationId: string,
  byUserId: string,
  ratifiedBy: string,
  ratificationRecord: string,
) {
  if (!ratifiedBy.trim() || !ratificationRecord.trim()) {
    return {
      error:
        "Ratification needs the body that voted and a record of the vote (charter 10.4) — a commit is not a decision.",
    };
  }
  const charter = await prisma.spaceCharter.findUnique({
    where: { organizationId },
  });
  if (!charter) return { error: "No charter to ratify." };
  if (charter.ratifiedBy) return { error: "Already ratified." };

  await prisma.$transaction([
    prisma.spaceCharter.update({
      where: { organizationId },
      data: {
        ratifiedBy: ratifiedBy.trim(),
        ratifiedOn: new Date(),
        ratificationRecord: ratificationRecord.trim(),
      },
    }),
    prisma.charterChange.create({
      data: {
        organizationId,
        byUserId,
        field: "ratification",
        fromValue: "DRAFT",
        toValue: `${ratifiedBy.trim()} — ${ratificationRecord.trim()}`,
        reason: "Ratification (charter 10.4): future runs become OFFICIAL.",
      },
    }),
  ]);
  return { success: true };
}
