/** Single source for "which semester are we declaring/allocating for". */
export function currentSemester(): string {
  const now = new Date();
  const m = now.getMonth(); // 0-based
  if (m >= 7) return `Fall ${now.getFullYear()}`;
  if (m <= 4) return `Spring ${now.getFullYear()}`;
  return `Summer ${now.getFullYear()}`;
}
