import { describe, it, expect } from 'vitest'
import { Combatant, Condition, Visibility, colorIsDark } from './functions'
import {
  migrateCombatants,
  deserializeCombatant,
  deserializeCombatantArray,
  CURRENT_SCHEMA_VERSION,
} from './serialization'
import { computeMonsterXP } from './xp'

describe('Condition', () => {
  it('should create a condition with default value of 1', () => {
    const condition = new Condition('Frightened')
    expect(condition.name).toBe('Frightened')
    expect(condition.value).toBe(1)
  })

  it('should create a condition with custom value', () => {
    const condition = new Condition('Dying', 2)
    expect(condition.name).toBe('Dying')
    expect(condition.value).toBe(2)
  })

  it('should generate consistent colors for the same condition name', () => {
    const condition1 = new Condition('Frightened')
    const condition2 = new Condition('Frightened')
    expect(condition1.color).toBe(condition2.color)
  })

  it('should use only first word for color generation', () => {
    const condition1 = new Condition('Frightened 2')
    const condition2 = new Condition('Frightened 3')
    expect(condition1.color).toBe(condition2.color)
  })
})

describe('Combatant - HP Management', () => {
  it('should initialize with correct HP values', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    expect(combatant.currentHP).toBe(25)
    expect(combatant.totalHP).toBe(25)
    expect(combatant.tempHP).toBe(0)
    expect(combatant.maxTempHP).toBe(0)
  })

  it('should heal correctly without exceeding max HP', () => {
    const combatant = new Combatant('Fighter', 25, 10, 15)
    combatant.changeHP(5)
    expect(combatant.currentHP).toBe(20)

    combatant.changeHP(10)
    expect(combatant.currentHP).toBe(25) // capped at max
  })

  it('should damage regular HP correctly', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.changeHP(-5)
    expect(combatant.currentHP).toBe(20)

    combatant.changeHP(-25)
    expect(combatant.currentHP).toBe(0) // doesn't go below 0
  })

  it('should consume temp HP before regular HP', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.addTempHP(10)
    expect(combatant.tempHP).toBe(10)
    expect(combatant.maxTempHP).toBe(10)

    combatant.changeHP(-5)
    expect(combatant.tempHP).toBe(5)
    expect(combatant.currentHP).toBe(25) // regular HP untouched
  })

  it('should overflow damage from temp HP to regular HP', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.addTempHP(5)

    combatant.changeHP(-10)
    expect(combatant.tempHP).toBe(0)
    expect(combatant.maxTempHP).toBe(0) // reset when temp HP reaches 0
    expect(combatant.currentHP).toBe(20) // 5 absorbed by temp, 5 from regular
  })

  it('should use the higher of existing or new temp HP (PF2e RAW: no stacking)', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.addTempHP(5)
    expect(combatant.tempHP).toBe(5)
    expect(combatant.maxTempHP).toBe(5)

    // Adding less than current: keep existing higher value
    combatant.addTempHP(3)
    expect(combatant.tempHP).toBe(5)
    expect(combatant.maxTempHP).toBe(5)

    // Adding more than current: replace with new higher value
    combatant.addTempHP(10)
    expect(combatant.tempHP).toBe(10)
    expect(combatant.maxTempHP).toBe(10)
  })
})

describe('Combatant - Visibility', () => {
  it('should initialize with Half visibility by default', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    expect(combatant.visibility).toBe(Visibility.Half)
  })

  it('should cycle None → Half → Full → None on left click', () => {
    const combatant = new Combatant('Fighter', 25, 10, 25, [], Visibility.None)
    combatant.changeVisibility(false)
    expect(combatant.visibility).toBe(Visibility.Half)

    combatant.changeVisibility(false)
    expect(combatant.visibility).toBe(Visibility.Full)

    combatant.changeVisibility(false)
    expect(combatant.visibility).toBe(Visibility.None)
  })

  it('should set to Full on right click', () => {
    const combatant = new Combatant('Fighter', 25, 10, 25, [], Visibility.None)
    combatant.changeVisibility(true)
    expect(combatant.visibility).toBe(Visibility.Full)
  })
})

describe('Combatant - Conditions', () => {
  it('should add conditions correctly', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2)

    expect(combatant.conditions.length).toBe(1)
    expect(combatant.conditions[0].name).toBe('Frightened')
    expect(combatant.conditions[0].value).toBe(2)
  })

  it('should decrement specific condition', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2)
    const condition = combatant.conditions[0]

    combatant.changeConditionValue(condition, false)
    expect(combatant.conditions[0].value).toBe(1)
  })

  it('should increment specific condition', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 1)
    const condition = combatant.conditions[0]

    combatant.changeConditionValue(condition, true)
    expect(combatant.conditions[0].value).toBe(2)
  })

  it('should remove condition when value reaches 0', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 1)
    const condition = combatant.conditions[0]

    combatant.changeConditionValue(condition, false)
    expect(combatant.conditions.length).toBe(0)
  })

  it('should decrement all conditions via decrementAllConditions()', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2)
    combatant.newCondition('Sickened', 3)

    combatant.decrementAllConditions()
    expect(combatant.conditions[0].value).toBe(1)
    expect(combatant.conditions[1].value).toBe(2)
  })
})

describe('colorIsDark', () => {
  it('should detect dark colors', () => {
    expect(colorIsDark('#000000')).toBe(true)
    expect(colorIsDark('#1a1a1a')).toBe(true)
    expect(colorIsDark('000000')).toBe(true) // without # prefix
  })

  it('should detect light colors', () => {
    expect(colorIsDark('#ffffff')).toBe(false)
    expect(colorIsDark('#f0f0f0')).toBe(false)
    expect(colorIsDark('ffffff')).toBe(false) // without # prefix
  })

  it('should handle medium colors correctly', () => {
    expect(colorIsDark('#808080')).toBe(false) // gray
    expect(colorIsDark('#404040')).toBe(true) // dark gray
  })
})

describe('Combatant - schema v2 fields', () => {
  it('should default to type "pc" when not specified', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    expect(combatant.type).toBe('pc')
  })

  it('should accept rich stat-block fields via extras', () => {
    const combatant = new Combatant('Goblin', 6, 2, 6, [], Visibility.Half, 0, 0, {
      type: 'monster',
      level: 1,
      ac: 16,
      perception: 5,
      fortitude: 4,
      reflex: 6,
      will: 3,
      speed: 25,
      resistances: [{ type: 'fire', value: 5 }],
      weaknesses: [{ type: 'cold', value: 5 }],
      immunities: ['poison'],
      traits: ['humanoid', 'goblinoid'],
      family: 'Goblin',
      source: 'Monster Core pg. 144',
      attacks: [
        {
          name: 'dogslicer',
          type: 'melee',
          bonus: 7,
          map1: 3,
          map2: -1,
          damage: '1d6+3',
          damageType: 'slashing',
        },
      ],
      abilities: [{ name: 'Goblin Scuttle', type: 'reaction', description: '...' }],
      aonUrl: 'https://2e.aonprd.com/Monsters.aspx?ID=1',
      notes: 'Boss goblin',
    })
    expect(combatant.type).toBe('monster')
    expect(combatant.level).toBe(1)
    expect(combatant.ac).toBe(16)
    expect(combatant.resistances?.[0].value).toBe(5)
    expect(combatant.immunities).toContain('poison')
    expect(combatant.attacks?.[0].map2).toBe(-1)
    expect(combatant.aonUrl).toContain('aonprd')
  })
})

describe('Combatant - typed damage (resistances/weaknesses/immunities)', () => {
  it('should apply immunity (0 damage)', () => {
    const combatant = new Combatant('Golem', 50, 5, 50, [], Visibility.Half, 0, 0, {
      immunities: ['fire'],
    })
    const result = combatant.applyTypedDamage(20, 'fire')
    expect(result.immune).toBe(true)
    expect(result.finalAmount).toBe(0)
    expect(combatant.currentHP).toBe(50)
  })

  it('should apply resistance (subtract from incoming)', () => {
    const combatant = new Combatant('Fighter', 30, 5, 30, [], Visibility.Half, 0, 0, {
      resistances: [{ type: 'slashing', value: 5 }],
    })
    const result = combatant.applyTypedDamage(15, 'slashing')
    expect(result.resisted).toBe(5)
    expect(result.finalAmount).toBe(10)
    expect(combatant.currentHP).toBe(20)
  })

  it('should apply weakness (add to incoming)', () => {
    const combatant = new Combatant('Troll', 50, 3, 50, [], Visibility.Half, 0, 0, {
      weaknesses: [{ type: 'fire', value: 5 }],
    })
    const result = combatant.applyTypedDamage(10, 'fire')
    expect(result.weakness).toBe(5)
    expect(result.finalAmount).toBe(15)
    expect(combatant.currentHP).toBe(35)
  })

  it('should apply both weakness and resistance (weakness first per PF2e RAW)', () => {
    const combatant = new Combatant('Hybrid', 40, 4, 40, [], Visibility.Half, 0, 0, {
      resistances: [{ type: 'fire', value: 5 }],
      weaknesses: [{ type: 'fire', value: 3 }],
    })
    const result = combatant.applyTypedDamage(10, 'fire')
    // 10 + 3 (weak) - 5 (res) = 8
    expect(result.finalAmount).toBe(8)
    expect(combatant.currentHP).toBe(32)
  })

  it('should heal when amount is negative (heal bypasses modifiers)', () => {
    const combatant = new Combatant('Fighter', 30, 5, 15, [], Visibility.Half, 0, 0, {
      resistances: [{ type: 'fire', value: 5 }],
    })
    const result = combatant.applyTypedDamage(-10, 'fire')
    expect(result.finalAmount).toBe(10)
    expect(combatant.currentHP).toBe(25)
  })

  it('should treat untyped damage as bypassing res/weak/immune', () => {
    const combatant = new Combatant('Fighter', 30, 5, 30, [], Visibility.Half, 0, 0, {
      resistances: [{ type: 'slashing', value: 5 }],
      weaknesses: [{ type: 'fire', value: 3 }],
      immunities: ['poison'],
    })
    const result = combatant.applyTypedDamage(10, 'untyped')
    expect(result.immune).toBe(false)
    expect(result.resisted).toBe(0)
    expect(result.weakness).toBe(0)
    expect(result.finalAmount).toBe(10)
    expect(combatant.currentHP).toBe(20)
  })
})

describe('Combatant - Condition durations', () => {
  it('should create a condition with explicit duration', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2, 3)
    expect(combatant.conditions[0].duration).toBe(3)
    expect(combatant.conditions[0].expiresOn).toBe('end')
  })

  it('should default duration to null (until removed)', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Prone')
    expect(combatant.conditions[0].duration).toBeNull()
  })

  it('should allow persistent damage on conditions', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Persistent Damage', 1, null, {
      persistentDamage: { diceCount: 1, diceSize: 4, damageType: 'fire' },
    })
    expect(combatant.conditions[0].persistentDamage?.diceSize).toBe(4)
    expect(combatant.conditions[0].persistentDamage?.damageType).toBe('fire')
  })
})

describe('Schema migration (v1 -> v2)', () => {
  it('should add v2 fields with defaults to v1 combatants', () => {
    const v1Combatant = {
      name: 'Amiri',
      totalHP: 22,
      initiative: 4,
      currentHP: 22,
      conditions: [{ name: 'Frightened', value: 2 }],
      visibility: 2,
      tempHP: 0,
      maxTempHP: 0,
    }
    const migrated = migrateCombatants(1, [v1Combatant])
    expect(migrated[0].type).toBe('pc')
    expect(migrated[0].level).toBeUndefined()
    expect(migrated[0].ac).toBeUndefined()
    expect(migrated[0].conditions[0].duration).toBeNull()
    expect(migrated[0].conditions[0].expiresOn).toBe('end')
  })

  it('should preserve existing v1 fields during migration', () => {
    const v1Combatant = {
      name: 'Amiri',
      totalHP: 22,
      initiative: 4,
      currentHP: 22,
      conditions: [],
      visibility: 2,
      tempHP: 0,
      maxTempHP: 0,
    }
    const migrated = migrateCombatants(1, [v1Combatant])
    expect(migrated[0].name).toBe('Amiri')
    expect(migrated[0].totalHP).toBe(22)
    expect(migrated[0].visibility).toBe(2)
  })

  it('should deserialize into a real Combatant class instance', () => {
    const v1Combatant = {
      name: 'Amiri',
      totalHP: 22,
      initiative: 4,
      currentHP: 22,
      conditions: [{ name: 'Frightened', value: 2 }],
      visibility: 2,
      tempHP: 5,
      maxTempHP: 5,
    }
    const migrated = migrateCombatants(1, [v1Combatant])
    const combatant = deserializeCombatant(migrated[0])
    expect(combatant).toBeInstanceOf(Combatant)
    expect(combatant.conditions[0]).toBeInstanceOf(Condition)
    expect(combatant.name).toBe('Amiri')
    expect(combatant.tempHP).toBe(5)
    expect(combatant.conditions[0].name).toBe('Frightened')
  })

  it('should be a no-op when stored version equals current', () => {
    const v2Combatant = {
      name: 'X',
      totalHP: 10,
      initiative: 1,
      currentHP: 10,
      conditions: [],
      visibility: 1,
      tempHP: 0,
      maxTempHP: 0,
      type: 'monster',
      level: 3,
      ac: 18,
    }
    const migrated = migrateCombatants(CURRENT_SCHEMA_VERSION, [v2Combatant])
    expect(migrated[0]).toEqual(v2Combatant)
  })

  it('should preserve v2 fields if the source was already v2', () => {
    const v2Combatant = {
      name: 'Goblin',
      totalHP: 6,
      initiative: 2,
      currentHP: 6,
      conditions: [],
      visibility: 1,
      tempHP: 0,
      maxTempHP: 0,
      type: 'monster',
      level: 1,
      ac: 16,
      resistances: [{ type: 'fire', value: 5 }],
    }
    // Stored as v1 by mistake, but v2 fields are present -> migration
    // should preserve them.
    const migrated = migrateCombatants(1, [v2Combatant])
    expect(migrated[0].type).toBe('monster')
    expect(migrated[0].level).toBe(1)
    expect(migrated[0].resistances[0].type).toBe('fire')
  })
})

describe('Combatant - action/reaction tracking', () => {
  it('should initialize with 0 actions used and reaction not used', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    expect(combatant.actionsUsed).toBe(0)
    expect(combatant.reactionUsed).toBe(false)
  })

  it('should increment actionsUsed via useAction()', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    combatant.useAction()
    expect(combatant.actionsUsed).toBe(1)
    combatant.useAction()
    expect(combatant.actionsUsed).toBe(2)
    combatant.useAction()
    expect(combatant.actionsUsed).toBe(3)
  })

  it('should clamp actionsUsed at max (default 3 per PF2e RAW)', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    combatant.useAction()
    combatant.useAction()
    combatant.useAction()
    combatant.useAction() // 4th click should not go past 3
    expect(combatant.actionsUsed).toBe(3)
  })

  it('should allow a custom max for effects like Haste (4 actions)', () => {
    const combatant = new Combatant('Hasted Fighter', 25, 10)
    combatant.useAction(4)
    combatant.useAction(4)
    combatant.useAction(4)
    combatant.useAction(4)
    expect(combatant.actionsUsed).toBe(4)
    combatant.useAction(4) // 5th should clamp at 4
    expect(combatant.actionsUsed).toBe(4)
  })

  it('should decrement actionsUsed via unuseAction()', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    combatant.useAction()
    combatant.useAction()
    expect(combatant.actionsUsed).toBe(2)
    combatant.unuseAction()
    expect(combatant.actionsUsed).toBe(1)
  })

  it('should not go below 0 actionsUsed via unuseAction()', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    combatant.unuseAction()
    expect(combatant.actionsUsed).toBe(0)
  })

  it('should toggle reaction via toggleReaction()', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    expect(combatant.reactionUsed).toBe(false)
    combatant.toggleReaction()
    expect(combatant.reactionUsed).toBe(true)
    combatant.toggleReaction()
    expect(combatant.reactionUsed).toBe(false)
  })

  it('should reset actions and reaction via resetActions()', () => {
    const combatant = new Combatant('Goblin', 6, 2)
    combatant.useAction()
    combatant.useAction()
    combatant.toggleReaction()
    expect(combatant.actionsUsed).toBe(2)
    expect(combatant.reactionUsed).toBe(true)
    combatant.resetActions()
    expect(combatant.actionsUsed).toBe(0)
    expect(combatant.reactionUsed).toBe(false)
  })

  it('should accept actionsUsed/reactionUsed via constructor extras', () => {
    const combatant = new Combatant('Goblin', 6, 2, 6, [], Visibility.Half, 0, 0, {
      type: 'monster',
      actionsUsed: 2,
      reactionUsed: true,
    })
    expect(combatant.actionsUsed).toBe(2)
    expect(combatant.reactionUsed).toBe(true)
  })
})

describe('Schema migration (v2 -> v3)', () => {
  it('should add v3 action fields with defaults to v2 combatants', () => {
    const v2Combatant = {
      name: 'Goblin',
      totalHP: 6,
      initiative: 2,
      currentHP: 6,
      conditions: [],
      visibility: 1,
      tempHP: 0,
      maxTempHP: 0,
      type: 'monster',
      level: 1,
      ac: 16,
    }
    const migrated = migrateCombatants(2, [v2Combatant])
    expect(migrated[0].actionsUsed).toBe(0)
    expect(migrated[0].reactionUsed).toBe(false)
    // v2 fields should be preserved
    expect(migrated[0].type).toBe('monster')
    expect(migrated[0].level).toBe(1)
  })

  it('should preserve existing v3 fields if already present', () => {
    const v3Combatant = {
      name: 'Boss',
      totalHP: 50,
      initiative: 5,
      currentHP: 30,
      conditions: [],
      visibility: 2,
      tempHP: 0,
      maxTempHP: 0,
      type: 'monster',
      level: 3,
      actionsUsed: 2,
      reactionUsed: true,
    }
    // Stored as v2 by mistake, but v3 fields are present -> migration
    // should preserve them.
    const migrated = migrateCombatants(2, [v3Combatant])
    expect(migrated[0].actionsUsed).toBe(2)
    expect(migrated[0].reactionUsed).toBe(true)
  })

  it('should deserialize v3 combatant with action fields into class instance', () => {
    const v3Combatant = {
      name: 'Goblin',
      totalHP: 6,
      initiative: 2,
      currentHP: 6,
      conditions: [],
      visibility: 1,
      tempHP: 0,
      maxTempHP: 0,
      type: 'monster',
      level: 1,
      actionsUsed: 1,
      reactionUsed: true,
    }
    const migrated = migrateCombatants(3, [v3Combatant])
    const combatant = deserializeCombatant(migrated[0])
    expect(combatant).toBeInstanceOf(Combatant)
    expect(combatant.actionsUsed).toBe(1)
    expect(combatant.reactionUsed).toBe(true)
  })

  it('should be a no-op when stored version equals current (v3)', () => {
    const v3Combatant = {
      name: 'X',
      totalHP: 10,
      initiative: 1,
      currentHP: 10,
      conditions: [],
      visibility: 1,
      tempHP: 0,
      maxTempHP: 0,
      type: 'pc',
      actionsUsed: 0,
      reactionUsed: false,
    }
    const migrated = migrateCombatants(CURRENT_SCHEMA_VERSION, [v3Combatant])
    expect(migrated[0]).toEqual(v3Combatant)
  })

  it('should migrate v1 all the way to v3 in one pass', () => {
    const v1Combatant = {
      name: 'Amiri',
      totalHP: 22,
      initiative: 4,
      currentHP: 22,
      conditions: [{ name: 'Frightened', value: 2 }],
      visibility: 2,
      tempHP: 0,
      maxTempHP: 0,
    }
    const migrated = migrateCombatants(1, [v1Combatant])
    // v2 fields
    expect(migrated[0].type).toBe('pc')
    // v3 fields
    expect(migrated[0].actionsUsed).toBe(0)
    expect(migrated[0].reactionUsed).toBe(false)
    // Condition got v2 upgrade
    expect(migrated[0].conditions[0].duration).toBeNull()
  })
})

describe('computeMonsterXP (PF2e XP table)', () => {
  it('should return 40 XP for a monster at party level', () => {
    expect(computeMonsterXP(5, 5)).toBe(40)
  })

  it('should return 10 XP for a monster 4+ levels below party', () => {
    expect(computeMonsterXP(1, 5)).toBe(10)
    expect(computeMonsterXP(0, 5)).toBe(10)
  })

  it('should return 160 XP for a monster 4+ levels above party', () => {
    expect(computeMonsterXP(9, 5)).toBe(160)
    expect(computeMonsterXP(15, 5)).toBe(160)
  })

  it('should handle -3 delta (15 XP)', () => {
    expect(computeMonsterXP(2, 5)).toBe(15) // delta -3
  })

  it('should handle specific delta values from the table', () => {
    expect(computeMonsterXP(3, 5)).toBe(20) // -2
    expect(computeMonsterXP(4, 5)).toBe(30) // -1
    expect(computeMonsterXP(5, 5)).toBe(40) // 0
    expect(computeMonsterXP(6, 5)).toBe(60) // +1
    expect(computeMonsterXP(7, 5)).toBe(80) // +2
    expect(computeMonsterXP(8, 5)).toBe(120) // +3
  })

  it('should return 0 XP for monsters without a level', () => {
    expect(computeMonsterXP(undefined, 5)).toBe(0)
    expect(computeMonsterXP(undefined, 1)).toBe(0)
  })

  it('should default partyLevel to 1', () => {
    expect(computeMonsterXP(1)).toBe(40) // 1 - 1 = 0 -> 40 XP
    expect(computeMonsterXP(5)).toBe(160) // 5 - 1 = 4 -> 160 XP
  })
})

describe('deserializeCombatantArray - party roster (save/load round-trip)', () => {
  it('should round-trip a single-stringified roster (the fixed format)', () => {
    // This mirrors the fixed saveParty: JSON.stringify(combatantsArray).
    const party = [
      new Combatant('Amiri', 22, 4, 22, [], Visibility.Full, 0, 0, { type: 'pc' }),
      new Combatant('Lini', 18, 3, 15, [], Visibility.Full, 0, 0, { type: 'pc' }),
    ]
    const saved = JSON.stringify(party)
    // Simulate loading from localStorage: deserializeCombatantArray(savedString)
    const loaded = deserializeCombatantArray(saved)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]).toBeInstanceOf(Combatant)
    expect(loaded[0].name).toBe('Amiri')
    expect(loaded[0].totalHP).toBe(22)
    expect(loaded[0].currentHP).toBe(22)
    expect(loaded[0].type).toBe('pc')
    expect(loaded[1].name).toBe('Lini')
    expect(loaded[1].currentHP).toBe(15)
  })

  it('should load a legacy double-stringified roster without undefined fields', () => {
    // Mirrors the buggy saveParty: JSON.stringify(party.map(c => JSON.stringify(c))).
    // Each element becomes a JSON string, and the whole thing is stringified again.
    const party = [
      new Combatant('Amiri', 22, 4, 22, [], Visibility.Full, 0, 0, { type: 'pc' }),
      new Combatant('Lini', 18, 3, 18, [], Visibility.Full, 0, 0, { type: 'pc' }),
    ]
    const buggySaved = JSON.stringify(party.map((c) => JSON.stringify(c)))

    const loaded = deserializeCombatantArray(buggySaved)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]).toBeInstanceOf(Combatant)
    // The regression: each field used to read as undefined because the
    // element was a string, not an object. Now the loader parses strings.
    expect(loaded[0].name).toBe('Amiri')
    expect(loaded[0].totalHP).toBe(22)
    expect(loaded[0].currentHP).toBe(22)
    expect(loaded[0].type).toBe('pc')
    expect(loaded[1].name).toBe('Lini')
    expect(loaded[1].totalHP).toBe(18)
  })

  it('should fall back to default combatants when raw is empty/null', () => {
    expect(deserializeCombatantArray(null)).toHaveLength(4)
    expect(deserializeCombatantArray(undefined)).toHaveLength(4)
    expect(deserializeCombatantArray('')).toHaveLength(4)
  })
})
