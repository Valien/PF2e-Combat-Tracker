/**
 * PF2e Remaster encounter XP table.
 *
 * XP per defeated monster depends on the monster's level relative to the
 * party level (Δ = monsterLevel − partyLevel). The table is symmetric: a
 * monster 4+ levels below the party is worth the floor (10 XP), and one 4+
 * levels above is worth the ceiling (160 XP).
 *
 * Source: Pathfinder 2e Remaster Gamemastery Guide, "Encounter Budget" /
 * "Awarding XP" tables (formerly Core Rulebook pg. 489).
 */
const XP_TABLE: Array<{ delta: number; xp: number }> = [
  { delta: -4, xp: 10 },
  { delta: -3, xp: 15 },
  { delta: -2, xp: 20 },
  { delta: -1, xp: 30 },
  { delta: 0, xp: 40 },
  { delta: 1, xp: 60 },
  { delta: 2, xp: 80 },
  { delta: 3, xp: 120 },
  { delta: 4, xp: 160 },
]

/**
 * Returns the XP awarded for defeating a single monster.
 * Caps at the floor (10 XP) for monsters 4+ levels below the party, and at
 * the ceiling (160 XP) for monsters 4+ levels above.
 *
 * @param monsterLevel - The defeated monster's level (optional; if absent,
 *   the monster is treated as a nameless mook worth 0 XP).
 * @param partyLevel - The party's average level (1 by default per useSettings).
 */
export function computeMonsterXP(monsterLevel?: number, partyLevel: number = 1): number {
  if (monsterLevel === undefined || monsterLevel === null) return 0
  const delta = monsterLevel - partyLevel
  // Clamp to the table's range by finding the nearest delta entry.
  if (delta <= -4) return 10
  if (delta >= 4) return 160
  const entry = XP_TABLE.find((e) => e.delta === delta)
  return entry?.xp ?? 0
}
