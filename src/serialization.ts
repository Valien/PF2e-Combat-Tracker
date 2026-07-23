import { Combatant, Condition, getDefaultCombatants } from './functions.ts'
import { useStorage } from '@vueuse/core'

// Schema version for the persisted combat state.
// Bump when the shape of Combatant/Condition changes; add a forward-migrator
// to `migrations` below. Existing users with stale localStorage will silently
// upgrade on next load instead of dropping fields.
//
// v1: baseline (pre-rich-fields). Combatant had only name/HP/init/conditions/
//     visibility/tempHP/maxTempHP. Condition had only name/value/color.
// v2: Combatant gains type/level/ac/saves/speed/resistances/weaknesses/
//     immunities/traits/family/source/attacks/abilities/aonUrl/notes.
//     Condition gains duration/expiresOn/persistentDamage/description.
//     All new fields default to undefined/empty so v1 state rehydrates without
//     loss and gains sensible defaults on first access.
// v3: Combatant gains actionsUsed/reactionUsed (per-turn action tracking for
//     the DM quick-tally buttons). Defaults to 0/false so v1/v2 state
//     rehydrates with full actions available on the next turn.
export const CURRENT_SCHEMA_VERSION = 3

// Storage key holding the version number of the persisted combat state.
export const SCHEMA_VERSION_KEY = 'schemaVersion'

type MigrationFn = (raw: any) => any

// Each migrator receives the raw persisted combatant object (post-v(n-1))
// and returns the upgraded shape as a v(n) object. Conditions on the
// combatant are also migrated here (not in a separate pass).
const migrations: Record<number, MigrationFn> = {
  2: (raw) => {
    // v1 -> v2: add new Combatant fields with safe defaults,
    // and add new Condition fields to each condition entry.
    const upgradeCondition = (condition: any) => ({
      ...condition,
      duration: condition.duration ?? null,
      expiresOn: condition.expiresOn ?? 'end',
    })
    return {
      ...raw,
      type: raw.type ?? 'pc',
      ...(raw.level === undefined ? {} : { level: raw.level }),
      ...(raw.ac === undefined ? {} : { ac: raw.ac }),
      ...(raw.perception === undefined ? {} : { perception: raw.perception }),
      ...(raw.fortitude === undefined ? {} : { fortitude: raw.fortitude }),
      ...(raw.reflex === undefined ? {} : { reflex: raw.reflex }),
      ...(raw.will === undefined ? {} : { will: raw.will }),
      ...(raw.speed === undefined ? {} : { speed: raw.speed }),
      ...(raw.resistances === undefined ? {} : { resistances: raw.resistances }),
      ...(raw.weaknesses === undefined ? {} : { weaknesses: raw.weaknesses }),
      ...(raw.immunities === undefined ? {} : { immunities: raw.immunities }),
      ...(raw.traits === undefined ? {} : { traits: raw.traits }),
      ...(raw.family === undefined ? {} : { family: raw.family }),
      ...(raw.source === undefined ? {} : { source: raw.source }),
      ...(raw.attacks === undefined ? {} : { attacks: raw.attacks }),
      ...(raw.abilities === undefined ? {} : { abilities: raw.abilities }),
      ...(raw.aonUrl === undefined ? {} : { aonUrl: raw.aonUrl }),
      ...(raw.notes === undefined ? {} : { notes: raw.notes }),
      conditions: (raw.conditions || []).map(upgradeCondition),
    }
  },
  3: (raw) => {
    // v2 -> v3: add action/reaction tracking fields with safe defaults.
    // Conditions are unaffected by this migration (no Condition schema change).
    return {
      ...raw,
      actionsUsed: raw.actionsUsed ?? 0,
      reactionUsed: raw.reactionUsed ?? false,
    }
  },
}

/**
 * Apply forward-migrations in order from the stored version up to CURRENT.
 * Each migrator receives the raw persisted value (object or array) and
 * returns the upgraded shape.
 */
export function migrateCombatants(storedVersion: number, raw: any): any {
  let value = raw
  for (let v = storedVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const migrator = migrations[v]
    if (migrator) {
      value = Array.isArray(value) ? value.map(migrator) : migrator(value)
    }
  }
  return value
}

/**
 * Rehydrate a plain object (from localStorage string or Firebase snapshot)
 * back into a real Combatant class instance with full method support.
 * Unpacks the v2 `extras` shape from the flat persisted object.
 */
export function deserializeCombatant(combatant: any): Combatant {
  return new Combatant(
    combatant.name,
    combatant.totalHP,
    combatant.initiative,
    combatant.currentHP,
    (combatant.conditions || []).map(
      (condition: any) =>
        new Condition(condition.name, condition.value, condition.duration ?? null, {
          expiresOn: condition.expiresOn,
          persistentDamage: condition.persistentDamage,
          description: condition.description,
        }),
    ),
    combatant.visibility,
    combatant.tempHP || 0,
    combatant.maxTempHP || 0,
    {
      type: combatant.type,
      level: combatant.level,
      ac: combatant.ac,
      perception: combatant.perception,
      fortitude: combatant.fortitude,
      reflex: combatant.reflex,
      will: combatant.will,
      speed: combatant.speed,
      resistances: combatant.resistances,
      weaknesses: combatant.weaknesses,
      immunities: combatant.immunities,
      traits: combatant.traits,
      family: combatant.family,
      source: combatant.source,
      attacks: combatant.attacks,
      abilities: combatant.abilities,
      aonUrl: combatant.aonUrl,
      notes: combatant.notes,
      actionsUsed: combatant.actionsUsed,
      reactionUsed: combatant.reactionUsed,
    },
  )
}

/**
 * Rehydrate an array of plain combatant objects into class instances.
 * Falls back to default combatants if the input is missing/empty.
 *
 * Defensively handles string elements: an older version of saveParty
 * double-stringified each combatant before writing the roster, producing
 * an array of JSON strings on parse. If we encounter a string element we
 * JSON.parse it first so legacy rosters still load instead of surfacing
 * a card full of `undefined`.
 */
export function deserializeCombatantArray(raw: any): Combatant[] {
  if (!raw) return getDefaultCombatants()
  const parsed = Array.isArray(raw) ? raw : JSON.parse(raw)
  return parsed.map((item: any) =>
    typeof item === 'string' ? deserializeCombatant(JSON.parse(item)) : deserializeCombatant(item),
  )
}

/**
 * VueUse `useStorage` serializer for the combatants array.
 * Reads: parse JSON, run migrations, deserialize into Combatant instances.
 * Writes: plain JSON (class instances serialize via JSON.stringify by default).
 */
export function createCombatantStorageSerializer(storedVersion: number) {
  return {
    read: (v: string): Combatant[] => {
      if (!v) return getDefaultCombatants()
      const raw = JSON.parse(v)
      const migrated = migrateCombatants(storedVersion, raw)
      return migrated.map(deserializeCombatant)
    },
    write: (v: Combatant[]): string => JSON.stringify(v),
  }
}

/**
 * Firebase sync serializer. Firebase returns plain arrays directly (no JSON
 * string), and accepts plain objects on write.
 */
export const combatantFirebaseSerializer = {
  read: (v: any): Combatant[] => {
    if (!v) return getDefaultCombatants()
    const parsed = Array.isArray(v) ? v : JSON.parse(v)
    return parsed.map(deserializeCombatant)
  },
  write: (v: Combatant[]): any => v,
}

/**
 * Read the persisted schema version, defaulting to 1 if never set
 * (so existing v1 users get the v1->v2 migration on first load).
 */
export function readStoredSchemaVersion(): number {
  const stored = useStorage<number>(SCHEMA_VERSION_KEY, 1)
  return stored.value
}

/**
 * Persist the current schema version to localStorage.
 */
export function writeCurrentSchemaVersion(): void {
  const stored = useStorage<number>(SCHEMA_VERSION_KEY, 1)
  stored.value = CURRENT_SCHEMA_VERSION
}
