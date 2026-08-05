/** "a office" → "an office": pick the indefinite article for a term. */
export function an(term: string): string {
  return /^[aeiou]/i.test(term) ? `an ${term}` : `a ${term}`;
}
