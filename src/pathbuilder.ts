/**
 * Parser for Pathbuilder 2e Export JSON format.
 *
 * Pathbuilder's "Export JSON" (or "Export to Foundry VTT (JSON)") produces a
 * document of the shape `{ success: true, build: { ...characterData } }`.
 * The `build` object stores both raw components (ability scores, proficiency
 * ranks, ancestry/class HP) AND a few precomputed values (AC). This module
 * computes the rest (totalHP, save/perception totals, initiative) and maps
 * weapons/specials/feats to our `Combatant` shape.
 *
 * The `.pbex` backup format is intentionally NOT supported: it stores
 * player choices (feat selections, ability boosts) rather than computed
 * stats, so deriving a Combatant from it would require re-implementing
 * Pathbuilder's derivation engine. The Export JSON is what every Foundry
 * importer uses for the same reason.
 *
 * Field reference cross-verified against:
 *   - doctor-duus/textbuilder2e (Python parser with HP/save formulas)
 *   - kobseryqum/foundry-pathbuilder2e-import (pathbuilder-import.js)
 *   - MrPrante/pathmuncher (fetchPathbuilder confirms {success, build} shape)
 */

import type { CombatantType, DamageModifier, MonsterAttack, MonsterAbility } from './functions'

// --- Pathbuilder type definitions (loose — only what we read) ----------

type PbAcTotal = {
  acTotal?: number
  shieldBonus?: number | null
}

type PbAttributes = {
  ancestryhp?: number
  classhp?: number
  bonushp?: number
  bonushpPerLevel?: number
  speed?: number
  speedBonus?: number
}

type PbAbilities = {
  str?: number
  dex?: number
  con?: number
  int?: number
  wis?: number
  cha?: number
}

type PbProficiencies = {
  perception?: number
  fortitude?: number
  reflex?: number
  will?: number
}

type PbWeapon = {
  name?: string
  display?: string
  die?: string
  attack?: number
  damageBonus?: number
  str?: string // striking rune: "", "striking", "greaterStriking", "majorStriking"
  damageType?: string // single letter: P, B, S
  extraDamage?: string[]
  runes?: unknown[]
  prof?: string
  pot?: number
  qty?: number
}

export type PbBuild = {
  name?: string
  level?: number
  ancestry?: string
  heritage?: string
  class?: string
  background?: string
  abilities?: PbAbilities
  attributes?: PbAttributes
  proficiencies?: PbProficiencies
  acTotal?: PbAcTotal
  resistances?: DamageModifier[]
  weapons?: PbWeapon[]
  specials?: string[]
  feats?: Array<[string, string | null, string, number, ...unknown[]]>
}

type PbExport = {
  success?: boolean
  build?: PbBuild
}

// --- Combatant-shaped output (matches the `extras` bag in functions.ts) --

export type PathbuilderCombatant = {
  name: string
  totalHP: number
  initiative: number
  type: CombatantType
  level?: number
  ac?: number
  perception?: number
  fortitude?: number
  reflex?: number
  will?: number
  speed?: number
  resistances?: DamageModifier[]
  weaknesses?: DamageModifier[]
  immunities?: string[]
  traits?: string[]
  attacks?: MonsterAttack[]
  abilities?: MonsterAbility[]
  aonUrl?: string
  notes?: string
}

// --- Helpers ------------------------------------------------------------

/** Returns the ability modifier for a PF2e ability score. */
function mod(score: number | undefined): number {
  if (score === undefined) return 0
  return Math.floor((score - 10) / 2)
}

/**
 * Computes a save/perception total from a Pathbuilder proficiency rank.
 * Ranks in the export are doubled: 0=Untrained, 2=Trained, 4=Expert,
 * 6=Master, 8=Legendary. Untrained (0) gets no level bonus per PF2e RAW.
 */
function computeTotal(rank: number | undefined, level: number, abilityMod: number): number {
  const r = rank ?? 0
  return r + (r > 0 ? level : 0) + abilityMod
}

/** Damage type single-letter → full word (P → piercing, B → bludgeoning, S → slashing). */
const DAMAGE_TYPES: Record<string, string> = {
  P: 'piercing',
  B: 'bludgeoning',
  S: 'slashing',
  F: 'fire',
  C: 'cold',
  A: 'acid',
  E: 'electricity',
  N: 'sonic',
  O: 'poison',
  M: 'mental',
  // 'force', 'negative', 'positive' have no single-letter standard in PB; fall through
}

function expandDamageType(letter: string | undefined): string | undefined {
  if (!letter) return undefined
  return DAMAGE_TYPES[letter.toUpperCase()] ?? letter.toLowerCase()
}

/** Dice count from the striking rune string. */
function strikingDice(strRune: string | undefined): number {
  switch (strRune) {
    case 'striking':
      return 2
    case 'greaterStriking':
      return 3
    case 'majorStriking':
      return 4
    default:
      return 1
  }
}

/** Common ranged-weapon name fragments for melee/ranged inference. */
const RANGED_KEYWORDS = [
  'crossbow',
  'bow',
  'pistol',
  'jezail',
  'sukgung',
  'blunderbuss',
  'hand',
  'dart',
  'sling',
  'firearm',
  'rifle',
  'musket',
]

function inferWeaponType(name: string): 'melee' | 'ranged' {
  return RANGED_KEYWORDS.some((kw) => name.toLowerCase().includes(kw)) ? 'ranged' : 'melee'
}

/** Common agile weapon name fragments (agile weapons use -4/-8 MAP). */
const AGILE_KEYWORDS = [
  'dagger',
  'shortsword',
  'rapier',
  'fist',
  'claw',
  'bite',
  'jaws',
  'sting',
  'knuckle',
  'sai',
  'kukri',
  'kama',
  'nunchaku',
  'tonfa',
]

function inferAgile(name: string): boolean {
  return AGILE_KEYWORDS.some((kw) => name.toLowerCase().includes(kw))
}

// --- Parser --------------------------------------------------------------

export class PathbuilderParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathbuilderParseError'
  }
}

/**
 * Build a damage string from weapon components.
 * Pathbuilder stores the die as "d8"/"d4" (already includes the 'd'),
 * so the format is "{dice}{die}+{bonus}" (e.g. "2d8+3"); omit bonus if zero.
 */
function buildDamageString(
  dice: number,
  die: string | undefined,
  bonus: number | undefined,
): string | undefined {
  if (!die) return undefined
  const bonusPart = bonus && bonus > 0 ? `+${bonus}` : ''
  return `${dice}${die}${bonusPart}`
}

/**
 * Parse a Pathbuilder 2e Export JSON document into a Combatant-shaped object.
 *
 * Accepts:
 *   - The `{ success, build }` wrapper from the export endpoint
 *   - A bare `build` object
 *   - A JSON string of either
 *
 * Throws `PathbuilderParseError` on malformed input.
 */
export function parsePathbuilderExport(input: unknown): PathbuilderCombatant {
  let data: unknown = input

  // If it's a string, parse it first
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      throw new PathbuilderParseError('Input is not valid JSON.')
    }
  }

  if (typeof data !== 'object' || data === null) {
    throw new PathbuilderParseError('Input is not a JSON object.')
  }

  // Unwrap { success, build } if present; otherwise treat the object as `build`
  const obj = data as PbExport
  let build: PbBuild | undefined
  if (obj.build && typeof obj.build === 'object') {
    build = obj.build
  } else if ('name' in obj || 'level' in obj || 'abilities' in obj) {
    build = obj as PbBuild
  }

  if (!build) {
    throw new PathbuilderParseError(
      'No `build` object found. Expected `{ success, build: { ... } }` or a bare `build` object.',
    )
  }

  // Name — split on first comma to clean descriptor strings
  const rawName = build.name ?? 'Unknown Character'
  const name = rawName.split(',')[0].trim() || rawName

  const level = build.level ?? 1

  // Ability scores and modifiers
  const abil = build.abilities ?? {}
  const conMod = mod(abil.con)
  const dexMod = mod(abil.dex)
  const wisMod = mod(abil.wis)

  // HP: ancestryhp + (classhp + con_mod + bonushpPerLevel) * level + bonushp
  const attrs = build.attributes ?? {}
  const ancestryHp = attrs.ancestryhp ?? 0
  const classHp = attrs.classhp ?? 0
  const bonusHp = attrs.bonushp ?? 0
  const bonusHpPerLevel = attrs.bonushpPerLevel ?? 0
  const totalHP = ancestryHp + (classHp + conMod + bonusHpPerLevel) * level + bonusHp

  // AC is precomputed in the export
  const ac = build.acTotal?.acTotal

  // Saves / perception — computed from rank + level + ability mod
  const prof = build.proficiencies ?? {}
  const perception = computeTotal(prof.perception, level, wisMod)
  const fortitude = computeTotal(prof.fortitude, level, conMod)
  const reflex = computeTotal(prof.reflex, level, dexMod)
  const will = computeTotal(prof.will, level, wisMod)

  // Speed = base + bonus
  const speed = (attrs.speed ?? 0) + (attrs.speedBonus ?? 0)

  // Defenses — PB only stores custom resistances; no weaknesses/immunities
  const resistances = build.resistances ?? []
  const weaknesses: DamageModifier[] = []
  const immunities: string[] = []

  // Traits — derive from ancestry/heritage/class/background
  const traits = [build.ancestry, build.heritage, build.class, build.background].filter(
    (t): t is string => !!t && t !== 'Not set',
  )

  // Attacks — map weapons to MonsterAttack
  const attacks: MonsterAttack[] = (build.weapons ?? []).map((w) => {
    const weaponName = w.display || w.name || 'Unnamed Weapon'
    const dice = strikingDice(w.str)
    const damageType = expandDamageType(w.damageType)
    const damageString = buildDamageString(dice, w.die, w.damageBonus)
    const agile = inferAgile(weaponName)

    // Append extra damage notes (e.g. "+2 precision") to the damage string
    let finalDamage = damageString
    if (w.extraDamage && w.extraDamage.length > 0) {
      const extraStr = w.extraDamage.filter(Boolean).join(', ')
      finalDamage = finalDamage ? `${finalDamage} + ${extraStr}` : extraStr
    }

    const bonus = w.attack ?? 0
    // MAP: -4/-8 for agile, -5/-10 for non-agile (PF2e RAW).
    // These are defaults; the combat tracker recomputes via getStrikeBonus
    // based on traits at runtime, but setting them here makes the stat
    // block display correct out of the box.
    return {
      name: weaponName,
      bonus,
      type: inferWeaponType(weaponName),
      map1: bonus - (agile ? 4 : 5),
      map2: bonus - (agile ? 8 : 10),
      ...(agile && { traits: ['agile'] }),
      ...(finalDamage && { damage: finalDamage }),
      ...(damageType && { damageType }),
    }
  })

  // Abilities — specials (plain strings) + feats (positional tuples)
  const abilities: MonsterAbility[] = []

  for (const special of build.specials ?? []) {
    if (special) {
      abilities.push({
        name: special,
        type: 'passive', // PB doesn't encode action type
        description: '', // PB exports don't include descriptions
      })
    }
  }

  for (const feat of build.feats ?? []) {
    if (Array.isArray(feat) && feat[0]) {
      const featName = feat[0]
      const featType = feat[2] as string | undefined
      const featLevel = feat[3] as number | undefined
      abilities.push({
        name: featName,
        type: 'passive',
        // Compose a minimal descriptor from the available metadata
        description: featType ? `Level ${featLevel ?? '?'} ${featType}` : '',
      })
    }
  }

  // Initiative — default to perception (PF2e uses Perception for initiative)
  const initiative = perception

  return {
    name,
    totalHP: Math.max(1, totalHP),
    initiative,
    type: 'pc',
    ...(level !== undefined && { level }),
    ...(ac !== undefined && { ac }),
    ...(perception !== undefined && { perception }),
    ...(fortitude !== undefined && { fortitude }),
    ...(reflex !== undefined && { reflex }),
    ...(will !== undefined && { will }),
    ...(speed !== undefined && speed > 0 && { speed }),
    ...(resistances.length > 0 && { resistances }),
    ...(weaknesses.length > 0 && { weaknesses }),
    ...(immunities.length > 0 && { immunities }),
    ...(traits.length > 0 && { traits }),
    ...(attacks.length > 0 && { attacks }),
    ...(abilities.length > 0 && { abilities }),
  }
}
