/**
 * Visibility levels for combatants in the player view
 * - None: Hidden from players, skipped during turn advancement
 * - Half: Name and initiative visible, HP hidden
 * - Full: All information visible including HP
 */
enum Visibility {
  None = 0,
  Half = 1,
  Full = 2,
}

/**
 * Combatant type. PCs are usually hand-entered by the DM; monsters come from
 * the bestiary JSONs and carry richer stat-block data. NPCs are DM-created
 * creatures without a bestiary entry.
 */
type CombatantType = 'pc' | 'monster' | 'npc'

/**
 * Per-damage-type modifier (resistance, weakness, or immunity).
 * For immunities, `value` is ignored — only `type` matters.
 */
type DamageModifier = {
  type: string
  value: number
}

/**
 * A monster Strike (melee or ranged attack).
 * `bonus` is the main attack modifier; `map1`/`map2` are the multiple attack
 * penalty values for the 2nd and 3rd Strike (e.g. +12/+7 for a +17 strike).
 */
type MonsterAttack = {
  name: string
  type: 'melee' | 'ranged'
  bonus: number
  map1?: number
  map2?: number
  damage?: string
  damageType?: string
  traits?: string[]
}

/**
 * A non-strike monster ability (reaction, action, free action, passive).
 * `description` is the full text block as scraped from Archives of Nethys.
 */
type MonsterAbility = {
  name: string
  type: 'action' | 'reaction' | 'free' | 'passive'
  actions?: number
  description: string
  traits?: string[]
}

/**
 * Persistent damage entry (e.g. "1d4 fire" from a flaming weapon).
 * Applies at the start of the affected creature's turn.
 */
type PersistentDamage = {
  diceCount: number
  diceSize: number
  damageType: string
}

/**
 * Represents a status condition affecting a combatant.
 * Automatically generates a unique color based on the condition name.
 *
 * Duration semantics (added in schema v2):
 *   - `duration` rounds, null = until removed manually
 *   - `expiresOn` = 'end' ticks at end of the affected creature's turn
 *   - `expiresOn` = 'start' ticks at start of the affected creature's turn
 *     (used by some PF2e effects that explicitly say "start of your turn")
 *   - `persistentDamage` triggers a roll prompt at start of the affected
 *     creature's turn
 *   - `description` is cached from the conditions table at apply time so the
 *     player view can render tooltips without recomputing on every render
 */
class Condition {
  value: number
  color: string
  public name: string
  public duration: number | null
  public expiresOn: 'start' | 'end'
  public persistentDamage?: PersistentDamage
  public description?: string

  constructor(
    name: string,
    value: number = 1,
    duration: number | null = null,
    extras: {
      expiresOn?: 'start' | 'end'
      persistentDamage?: PersistentDamage
      description?: string
    } = {},
  ) {
    this.name = name
    this.value = value
    this.duration = duration
    this.expiresOn = extras.expiresOn ?? 'end'
    this.persistentDamage = extras.persistentDamage
    this.description = extras.description
    this.color = this._stringToColor(this.name)
  }

  /**
   * Generates a consistent hex color from a string using hash-based algorithm
   * Uses the first word of the condition name to ensure consistency
   * @param str - The condition name to convert to a color
   * @returns Hex color string (e.g., "#a3c4f2")
   */
  _stringToColor(str: string) {
    str = str.split(' ')[0]
    let hash = 0
    str.split('').forEach((char) => {
      hash = char.charCodeAt(0) + ((hash << 5) - hash)
    })
    let color = '#'
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff
      color += value.toString(16).padStart(2, '0')
    }
    return color
  }
}

/**
 * Represents a combatant in the initiative tracker.
 * Manages HP (including temporary HP), conditions, visibility, and the
 * stat-block data needed for inline stat-block display and encounter budget.
 *
 * All stat-block fields (level, ac, perception, saves, resistances, etc.)
 * are optional so existing persisted combatants migrate cleanly when the
 * schema bumps. PCs typically carry ac/perception/saves; monsters carry
 * the full stat block.
 */
class Combatant {
  name: string
  currentHP: number
  totalHP: number
  tempHP: number
  maxTempHP: number
  initiative: number
  conditions: Array<Condition>
  visibility: number

  // --- Schema v2 fields (all optional, default to undefined/empty) ---
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
  family?: string
  source?: string
  attacks?: MonsterAttack[]
  abilities?: MonsterAbility[]
  aonUrl?: string
  notes?: string

  // --- Schema v3 fields (action/reaction tracking for DM quick-tally) ---
  // PF2e RAW: each creature gets 3 actions + 1 reaction per turn, regained
  // at the start of its own turn. `actionsUsed` clamps at the standard 3;
  // some effects (Haste, Quickened) grant extra — those callers can pass a
  // higher max to `useAction`. `reactionUsed` is a simple boolean toggle.
  actionsUsed: number
  reactionUsed: boolean

  constructor(
    name: string,
    totalHP: number,
    initiative: number,
    currentHP: number = totalHP,
    conditions: Array<Condition> = [],
    visibility: number = Visibility.Half,
    tempHP: number = 0,
    maxTempHP: number = 0,
    extras: {
      type?: CombatantType
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
      family?: string
      source?: string
      attacks?: MonsterAttack[]
      abilities?: MonsterAbility[]
      aonUrl?: string
      notes?: string
      actionsUsed?: number
      reactionUsed?: boolean
    } = {},
  ) {
    this.name = name
    this.currentHP = currentHP
    this.totalHP = totalHP
    this.tempHP = tempHP
    this.maxTempHP = maxTempHP
    this.initiative = initiative
    this.conditions = conditions
    this.visibility = visibility

    // Schema v2 fields
    this.type = extras.type ?? 'pc'
    this.level = extras.level
    this.ac = extras.ac
    this.perception = extras.perception
    this.fortitude = extras.fortitude
    this.reflex = extras.reflex
    this.will = extras.will
    this.speed = extras.speed
    this.resistances = extras.resistances
    this.weaknesses = extras.weaknesses
    this.immunities = extras.immunities
    this.traits = extras.traits
    this.family = extras.family
    this.source = extras.source
    this.attacks = extras.attacks
    this.abilities = extras.abilities
    this.aonUrl = extras.aonUrl
    this.notes = extras.notes

    // Schema v3 fields
    this.actionsUsed = extras.actionsUsed ?? 0
    this.reactionUsed = extras.reactionUsed ?? false
  }

  /**
   * Applies typed damage to the combatant, automatically accounting for
   * resistances, weaknesses, and immunities per PF2e RAW.
   * Immunities: deal 0 damage.
   * Weakness: add the weakness value to the incoming damage.
   * Resistance: subtract the resistance value from the incoming damage.
   * Both can apply (weakness first per PF2e). Final damage is clamped at 0.
   * Healing (positive amount) bypasses all modifiers.
   * @param amount - Incoming damage (positive) or healing (negative)
   * @param type - Damage type (e.g. 'fire', 'slashing') or 'untyped'
   * @returns The final damage applied and whether res/weak/immune triggered
   */
  public applyTypedDamage(
    amount: number,
    type: string = 'untyped',
  ): { finalAmount: number; resisted: number; weakness: number; immune: boolean } {
    if (amount <= 0) {
      // Negative or zero amount = healing. `changeHP` treats positive as heal,
      // so we negate before forwarding. Healing bypasses res/weak/immune.
      this.changeHP(-amount)
      return { finalAmount: Math.abs(amount), resisted: 0, weakness: 0, immune: false }
    }

    if (this.immunities?.includes(type)) {
      return { finalAmount: 0, resisted: 0, weakness: 0, immune: true }
    }

    const res = this.resistances?.find((r) => r.type === type)?.value ?? 0
    const weak = this.weaknesses?.find((w) => w.type === type)?.value ?? 0
    const final = Math.max(0, amount + weak - res)
    this.changeHP(-final)
    return { finalAmount: final, resisted: res, weakness: weak, immune: false }
  }

  /**
   * Modifies combatant's HP following Pathfinder 2e rules
   * Positive amounts heal (capped at totalHP)
   * Negative amounts deal damage (temp HP absorbs first, then regular HP)
   * Automatically resets maxTempHP tracking when temp HP reaches 0
   * @param amount - HP change (positive for healing, negative for damage)
   */
  public changeHP(amount: number = 1) {
    if (amount > 0) {
      // Healing adds to current HP (stops at max)
      this.currentHP += amount
      if (this.currentHP > this.totalHP) {
        this.currentHP = this.totalHP
      }
    } else {
      // Damage: first consume temp HP, then regular HP
      const damage = Math.abs(amount)
      if (this.tempHP > 0) {
        if (this.tempHP >= damage) {
          // Temp HP absorbs all damage
          this.tempHP -= damage
        } else {
          // Temp HP absorbs some, rest goes to regular HP
          const remainingDamage = damage - this.tempHP
          this.tempHP = 0
          this.currentHP -= remainingDamage
          if (this.currentHP < 0) {
            this.currentHP = 0
          }
        }
      } else {
        // No temp HP, damage goes directly to regular HP
        this.currentHP -= damage
        if (this.currentHP < 0) {
          this.currentHP = 0
        }
      }

      // If temp HP reaches 0, reset maxTempHP tracking
      if (this.tempHP <= 0) {
        this.maxTempHP = 0
      }
    }
  }

  /**
   * Adds temporary HP to the combatant following Pathfinder 2e RAW.
   * PF2e rule: temporary HP does not stack. When gaining new temp HP, use
   * the higher of the existing value or the new amount (do not add them).
   * Tracks maxTempHP for display purposes.
   * @param amount - Amount of temporary HP to add (default: 1)
   */
  public addTempHP(amount: number = 1) {
    // PF2e RAW: take the higher of existing temp HP or new amount.
    // Pre-Remaster behavior incorrectly stacked; this fixes that divergence.
    if (amount > this.tempHP) {
      this.tempHP = amount
      this.maxTempHP = amount
    }
  }

  /**
   * Heals the combatant to full HP and clears all temporary HP.
   * Common "reset to full" shortcut for the DM.
   */
  public healToMax() {
    this.currentHP = this.totalHP
    this.tempHP = 0
    this.maxTempHP = 0
  }

  /**
   * Sets the combatant's maximum HP to the given value.
   * @param value - The new maximum HP
   */
  public setMaxHP(value: number) {
    this.totalHP = value
    this.currentHP = value
  }

  /**
   * Sets the combatant's initiative score.
   * @param value - The new initiative value
   */
  public setInitiative(value: number) {
    this.initiative = value
  }

  /**
   * Changes the visibility level of the combatant
   * Left-click cycles: None → Half → Full → None
   * Right-click sets to Full
   * @param setVisible - If true, sets to Full visibility (from right-click)
   */
  public changeVisibility(setVisible: boolean = false) {
    if (setVisible) {
      this.visibility = Visibility.Full
      return
    }
    this.visibility = (this.visibility + 1) % 3
  }

  /**
   * Standard PF2e action count per turn (3 actions + 1 reaction).
   * Effects like Haste can grant a 4th action; callers pass a higher max.
   */
  public static readonly MAX_ACTIONS_PER_TURN = 3

  /**
   * Marks one action as spent this turn.
   * Clamps at `max` (default 3 per PF2e RAW) so a stray click can't un-spend
   * a 4th action — the DM must explicitly unuse.
   * @param max - Maximum actions allowed this turn (default: 3)
   */
  public useAction(max: number = Combatant.MAX_ACTIONS_PER_TURN) {
    if (this.actionsUsed < max) this.actionsUsed++
  }

  /**
   * Un-spends one action (corrects a mis-click).
   * Clamps at 0; never goes negative.
   */
  public unuseAction() {
    if (this.actionsUsed > 0) this.actionsUsed--
  }

  /**
   * Toggles the per-turn reaction flag.
   * Reactions in PF2e are single-use per round; `resetActions()` clears it.
   */
  public toggleReaction() {
    this.reactionUsed = !this.reactionUsed
  }

  /**
   * Clears action/reaction tracking. Called when the creature regains
   * actions at the start of its own turn (typically via `nextTurn`/`prevTurn`
   * in `InitiativeManager`), and on `endCombat` / `reset`.
   */
  public resetActions() {
    this.actionsUsed = 0
    this.reactionUsed = false
  }

  /**
   * Decrements all conditions on this combatant by 1 (typical end-of-turn bookkeeping).
   * Removes any that drop to 0 or below.
   */
  public decrementAllConditions() {
    this.conditions.forEach((c) => {
      c.value--
    })
    this.conditions = this.conditions.filter((c) => c.value > 0)
  }

  /**
   * Adjusts a specific condition's value by name.
   * Removes the condition if its value reaches 0 or below.
   * If multiple conditions share the same name, all matching are adjusted.
   * @param condition - The condition to adjust (matched by name)
   * @param isIncrement - true to increment, false to decrement (default: false)
   */
  public changeConditionValue(condition: Condition, isIncrement: boolean = false) {
    this.conditions.forEach((c) => {
      if (c.name === condition.name) {
        if (isIncrement) {
          c.value++
        } else {
          c.value--
        }
      }
    })
    this.conditions = this.conditions.filter((c) => c.value > 0)
  }

  /**
   * Adds a new condition to this combatant
   * @param name - Name of the condition
   * @param value - Initial value/stage of the condition (default: 1)
   * @param duration - Rounds until expiry, or null for until-removed (default: null)
   * @param extras - Optional persistent damage, expiry timing, and cached description
   */
  public newCondition(
    name: string,
    value: number = 1,
    duration: number | null = null,
    extras: {
      expiresOn?: 'start' | 'end'
      persistentDamage?: PersistentDamage
      description?: string
    } = {},
  ) {
    this.conditions.push(new Condition(name, value, duration, extras))
  }
}

/**
 * Default combatants for Pathfinder 2e
 * Uses iconic characters from the Core Rulebook
 */
const defaultPathfinderCombatants: Array<Combatant> = [
  new Combatant('Amiri', 22, 4, 22, [], Visibility.Full, 0, 0), // Iconic Barbarian
  new Combatant('Lini', 18, 3, 18, [], Visibility.Full, 0, 0), // Iconic Druid
  new Combatant('Ezren', 16, 2, 16, [], Visibility.Full, 0, 0), // Iconic Wizard
  new Combatant('Kyra', 16, 1, 16, [], Visibility.Full, 0, 0), // Iconic Cleric
]

/**
 * Get default combatants for a new combat
 * Creates fresh copies of combatants to avoid shared references
 * @returns Array of default combatants
 */
function getDefaultCombatants(): Array<Combatant> {
  // Create fresh copies of combatants to avoid shared references
  return defaultPathfinderCombatants.map(
    (c) => new Combatant(c.name, c.totalHP, c.initiative, c.currentHP, [], c.visibility, 0, 0),
  )
}

/**
 * Determines if a hex color should be considered "dark"
 * Used to decide whether to use light or dark text on colored condition badges
 * Uses weighted RGB formula (ITU-R BT.601)
 * @param bgColor - Hex color string with or without # prefix
 * @returns true if the color is dark (luminance <= 100)
 */
function colorIsDark(bgColor: string): boolean {
  const color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor
  const r = parseInt(color.substring(0, 2), 16) // hexToR
  const g = parseInt(color.substring(2, 4), 16) // hexToG
  const b = parseInt(color.substring(4, 6), 16) // hexToB
  return r * 0.299 + g * 0.587 + b * 0.114 <= 100
}

export {
  colorIsDark,
  Visibility,
  Condition,
  Combatant,
  getDefaultCombatants,
  type CombatantType,
  type DamageModifier,
  type MonsterAttack,
  type MonsterAbility,
  type PersistentDamage,
}
