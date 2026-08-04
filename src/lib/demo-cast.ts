/**
 * The invented cast — shared fiction across every SBS artifact (the unified
 * demo, the Sawyer seed, and the registrar rehearsal import). Checked in
 * sbs-space against the real roster: zero surname overlap ("Vance" collided
 * with a real instructor, "Aslan" shadowed a real surname — both replaced).
 * Real schedules wear these names; the mapping to real people is never stored.
 */

const SURNAMES = [
  "Osei", "Whitlock", "Achebe", "Eze", "Halloran", "Nakamura", "Sandoval",
  "Adeyemi", "Novak", "Ilori", "Aksoy", "Lindgren", "Delgado", "Nwosu",
  "Verhoeven", "Rasmussen", "Lindqvist", "Rossi", "Bouchard", "Moreau", "Ricci",
  "Sorensen", "Castellano", "Bauer", "Aldana", "Ferreira", "Brenner",
  "Chandra", "Petrova", "Haddad", "Silva", "Nakagawa", "Fitzgerald",
  "Yildiz", "Marchetti", "Mbeki", "Tanaka", "Kowalski", "Varga", "Bergstrom",
  "Duarte", "Ramos", "Solberg", "Okonjo", "Almqvist", "Banerjee", "Carver",
  "Dimitrov", "Eriksen", "Fontaine", "Grigoryan", "Hassan", "Ibarra",
  "Jansson", "Kaur", "Laurent", "Mensah", "Nilsen", "Obi", "Pavlov",
  "Quintero", "Rahal", "Sato", "Tesfaye", "Ueda", "Vasquez", "Wren", "Xu",
  "Yamada", "Zielinski", "Abara", "Bellini", "Cormier", "Dubois", "Egede",
  "Farrell", "Galanis", "Horvat", "Ivanova", "Jovanovic", "Keita", "Lombard",
  "Marek", "Ndiaye", "Oliveira", "Priya", "Quon", "Reyes", "Stavros",
  "Toure", "Ulloa", "Vogel", "Weber", "Xiang", "Yoon", "Zamora", "Antonsen",
  "Bakker", "Csordas", "Diallo", "Endo", "Fialho", "Gruber", "Hoxha",
  "Iqbal", "Jensen", "Kimura", "Lorenzo", "Mahdi", "Noor", "Ostrowski",
  "Pellegrini", "Qureshi", "Rinaldi", "Suzuki", "Tamm", "Uzoma", "Vidal",
  "Wallin", "Xie", "Ybarra", "Zhukov",
];
const INITIALS = "KJPDAEWQTNOCIMRBFLVSGYHZU";

export function inventedNames(n: number): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  let i = 0;
  while (out.length < n) {
    const s = SURNAMES[i % SURNAMES.length];
    const ini = INITIALS[(Math.floor(i / SURNAMES.length) + i) % INITIALS.length];
    const name = `${ini}. ${s}`;
    if (!used.has(name)) {
      used.add(name);
      out.push(name);
    }
    i++;
  }
  return out;
}

export const castEmail = (name: string) =>
  name.toLowerCase().replace(/[^a-z]/g, "") + "@sawyer.demo";
