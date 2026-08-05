/**
 * Pilot face: NEXT_PUBLIC_PILOT=1 rebrands the instance as SBS Faculty Space
 * and trims the UI to the pilot's story (declare → allocate → charter).
 * Inlined at build time, so it is safe in both server and client components.
 * Production instances leave it unset and keep the Scheduling Engine face.
 */
export const isPilot = process.env.NEXT_PUBLIC_PILOT === "1";

export const PILOT_BRAND = "SBS Faculty Space";
