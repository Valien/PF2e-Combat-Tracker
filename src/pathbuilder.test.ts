import { describe, it, expect } from 'vitest'
import { parsePathbuilderExport, PathbuilderParseError } from './pathbuilder'
import type { PbBuild } from './pathbuilder'

// A minimal but realistic Pathbuilder export fixture (shape verified
// against doctor-duus/textbuilder2e examples).
const sampleBuild: PbBuild = {
  name: 'Glimpse, goblin xbowslinger (rogue) 12th',
  level: 12,
  ancestry: 'Goblin',
  heritage: 'Dokkaebi Goblin',
  class: 'Gunslinger',
  background: 'Blow-In (Deception)',
  abilities: { str: 10, dex: 20, con: 18, int: 14, wis: 10, cha: 20 },
  attributes: {
    ancestryhp: 6,
    classhp: 8,
    bonushp: 0,
    bonushpPerLevel: 1,
    speed: 25,
    speedBonus: 5,
  },
  proficiencies: {
    perception: 6, // Master
    fortitude: 4, // Expert
    reflex: 6, // Master
    will: 4, // Expert
  },
  acTotal: { acTotal: 29, shieldBonus: null },
  resistances: [],
  weapons: [
    {
      name: 'Sukgung',
      display: '+1 Striking Sukgung',
      die: 'd8',
      attack: 24,
      damageBonus: 3,
      str: 'striking',
      damageType: 'P',
      extraDamage: ['+2 precision'],
    },
  ],
  specials: ['Way of the Pistolero', 'Sneak Attack', 'Darkvision'],
  feats: [
    ['Toughness', null, 'General Feat', 7],
    ['Nachtfechter Adaptation', null, 'Class Feat', 4],
  ],
}

const wrappedExport = { success: true, build: sampleBuild }

describe('parsePathbuilderExport - input handling', () => {
  it('should accept the { success, build } wrapper', () => {
    const result = parsePathbuilderExport(wrappedExport)
    expect(result.name).toBe('Glimpse')
    expect(result.type).toBe('pc')
  })

  it('should accept a bare build object', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.name).toBe('Glimpse')
    expect(result.level).toBe(12)
  })

  it('should accept a JSON string', () => {
    const result = parsePathbuilderExport(JSON.stringify(wrappedExport))
    expect(result.name).toBe('Glimpse')
  })

  it('should reject invalid JSON strings', () => {
    expect(() => parsePathbuilderExport('{ not json')).toThrow(PathbuilderParseError)
  })

  it('should reject non-objects', () => {
    expect(() => parsePathbuilderExport(42)).toThrow(PathbuilderParseError)
    expect(() => parsePathbuilderExport(null)).toThrow(PathbuilderParseError)
    expect(() => parsePathbuilderExport('just a string')).toThrow(PathbuilderParseError)
  })

  it('should reject inputs without a build object', () => {
    expect(() => parsePathbuilderExport({ foo: 'bar' })).toThrow(PathbuilderParseError)
  })
})

describe('parsePathbuilderExport - name cleanup', () => {
  it('should split descriptor strings on the first comma', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.name).toBe('Glimpse')
  })

  it('should keep full name if no comma', () => {
    const result = parsePathbuilderExport({ ...sampleBuild, name: 'Amiri the Barbarian' })
    expect(result.name).toBe('Amiri the Barbarian')
  })

  it('should fall back to full string if first part is empty', () => {
    const result = parsePathbuilderExport({ ...sampleBuild, name: ', stuff' })
    expect(result.name).toBe(', stuff')
  })

  it('should default to Unknown Character when name is missing', () => {
    const result = parsePathbuilderExport({ level: 1, abilities: {}, attributes: {} })
    expect(result.name).toBe('Unknown Character')
  })
})

describe('parsePathbuilderExport - HP computation', () => {
  it('should compute HP from the standard formula', () => {
    // ancestryhp(6) + (classhp(8) + con_mod(4) + bonushpPerLevel(1)) * level(12) + bonushp(0)
    // = 6 + (8+4+1)*12 + 0 = 6 + 156 = 162
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.totalHP).toBe(162)
  })

  it('should include bonushp (flat) in the total', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      attributes: { ancestryhp: 8, classhp: 10, bonushp: 5, bonushpPerLevel: 0, speed: 25 },
      level: 1,
      abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    })
    // 8 + (10 + 2 + 0)*1 + 5 = 8 + 12 + 5 = 25
    expect(result.totalHP).toBe(25)
  })

  it('should handle missing attributes gracefully (HP = 1 floor)', () => {
    const result = parsePathbuilderExport({ name: 'Test', level: 1, abilities: {} })
    expect(result.totalHP).toBeGreaterThanOrEqual(1)
  })

  it('should never return HP below 1', () => {
    const result = parsePathbuilderExport({
      name: 'Test',
      level: 1,
      abilities: { con: 8 }, // con mod -1
      attributes: { ancestryhp: 0, classhp: 0, bonushpPerLevel: 0 },
    })
    expect(result.totalHP).toBe(1)
  })
})

describe('parsePathbuilderExport - ability modifiers', () => {
  it('should correctly derive CON modifier for HP and Fortitude', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      level: 5,
      abilities: { str: 10, dex: 14, con: 18, int: 10, wis: 12, cha: 10 },
      proficiencies: { fortitude: 4, perception: 2, reflex: 2, will: 2 },
    })
    // Fortitude = rank(4) + level(5) + conMod(4) = 13
    expect(result.fortitude).toBe(13)
  })
})

describe('parsePathbuilderExport - saves and perception', () => {
  it('should compute saves using rank + level + ability_mod', () => {
    const result = parsePathbuilderExport(sampleBuild)
    // con_mod = floor((18-10)/2) = 4
    // Fortitude = 4 (expert rank) + 12 (level, since rank>0) + 4 (con_mod) = 20
    expect(result.fortitude).toBe(20)
    // dex_mod = floor((20-10)/2) = 5
    // Reflex = 6 (master rank) + 12 + 5 = 23
    expect(result.reflex).toBe(23)
    // wis_mod = floor((10-10)/2) = 0
    // Will = 4 + 12 + 0 = 16
    expect(result.will).toBe(16)
  })

  it('should compute perception using wis modifier', () => {
    const result = parsePathbuilderExport(sampleBuild)
    // Perception = 6 (master rank) + 12 (level) + 0 (wis_mod) = 18
    expect(result.perception).toBe(18)
  })

  it('should NOT add level when rank is 0 (Untrained per PF2e RAW)', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      level: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      proficiencies: { perception: 0, fortitude: 0, reflex: 4, will: 0 },
    })
    // Untrained perception: 0 + 0 (no level bonus) + 2 (wis_mod) = 2
    expect(result.perception).toBe(2)
    // Untrained fortitude: 0 + 0 + 0 = 0
    expect(result.fortitude).toBe(0)
    // Trained+ reflex: 4 + 10 + 0 = 14
    expect(result.reflex).toBe(14)
    // Untrained will: 0 + 0 + 2 = 2
    expect(result.will).toBe(2)
  })
})

describe('parsePathbuilderExport - AC', () => {
  it('should read AC directly from acTotal.acTotal (precomputed in export)', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.ac).toBe(29)
  })

  it('should leave AC undefined when acTotal is missing', () => {
    const result = parsePathbuilderExport({ ...sampleBuild, acTotal: undefined })
    expect(result.ac).toBeUndefined()
  })
})

describe('parsePathbuilderExport - speed', () => {
  it('should sum speed and speedBonus', () => {
    const result = parsePathbuilderExport(sampleBuild)
    // 25 + 5 = 30
    expect(result.speed).toBe(30)
  })

  it('should omit speed when zero or missing', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      attributes: { speed: 0, speedBonus: 0 },
    })
    expect(result.speed).toBeUndefined()
  })
})

describe('parsePathbuilderExport - traits', () => {
  it('should derive traits from ancestry/heritage/class/background', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.traits).toEqual([
      'Goblin',
      'Dokkaebi Goblin',
      'Gunslinger',
      'Blow-In (Deception)',
    ])
  })

  it('should filter null and "Not set" from traits', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      ancestry: 'Human',
      heritage: 'Not set',
      class: 'Fighter',
      background: null,
    })
    expect(result.traits).toEqual(['Human', 'Fighter'])
  })

  it('should omit traits array when all are null/Not set', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      ancestry: 'Not set',
      heritage: 'Not set',
      class: 'Not set',
      background: null,
    })
    expect(result.traits).toBeUndefined()
  })
})

describe('parsePathbuilderExport - weaknesses and immunities', () => {
  it('should always omit weaknesses (PB export has no weaknesses array)', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.weaknesses).toBeUndefined()
  })

  it('should always omit immunities (PB export has no immunities array)', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.immunities).toBeUndefined()
  })
})

describe('parsePathbuilderExport - resistances', () => {
  it('should pass through custom resistances from the export', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      resistances: [{ type: 'fire', value: 5 }],
    })
    expect(result.resistances).toEqual([{ type: 'fire', value: 5 }])
  })

  it('should omit resistances array when empty', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.resistances).toBeUndefined()
  })
})

describe('parsePathbuilderExport - attacks (weapons)', () => {
  it('should map weapons to MonsterAttack shape', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.attacks).toHaveLength(1)
    const atk = result.attacks![0]
    expect(atk.name).toBe('+1 Striking Sukgung')
    expect(atk.bonus).toBe(24)
    // Striking rune → 2 dice
    expect(atk.damage).toContain('2d8')
    expect(atk.damage).toContain('+3')
    // Damage type P → piercing
    expect(atk.damageType).toBe('piercing')
  })

  it('should append extra damage to the damage string', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.attacks![0].damage).toContain('+2 precision')
  })

  it('should compute MAP as bonus - 5 / - 10 (non-agile default)', () => {
    const result = parsePathbuilderExport(sampleBuild)
    const atk = result.attacks![0]
    expect(atk.map1).toBe(19) // 24 - 5
    expect(atk.map2).toBe(14) // 24 - 10
  })

  it('should use display name if present, else weapon.name', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      weapons: [{ name: 'Longsword', die: 'd8', attack: 10, str: '', damageType: 'S' }],
    })
    expect(result.attacks![0].name).toBe('Longsword')
  })

  it('should default dice count to 1 when no striking rune', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      weapons: [{ name: 'Dagger', die: 'd4', attack: 7, str: '', damageType: 'P' }],
    })
    expect(result.attacks![0].damage).toBe('1d4')
  })

  it('should handle greaterStriking (3 dice) and majorStriking (4 dice)', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      weapons: [
        { name: 'Sword A', die: 'd8', attack: 10, str: 'greaterStriking', damageType: 'S' },
        { name: 'Sword B', die: 'd8', attack: 10, str: 'majorStriking', damageType: 'S' },
      ],
    })
    expect(result.attacks![0].damage).toContain('3d8')
    expect(result.attacks![1].damage).toContain('4d8')
  })

  it('should infer ranged for crossbows, pistols, bows', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      weapons: [{ name: 'Light Crossbow', die: 'd8', attack: 5, str: '', damageType: 'P' }],
    })
    expect(result.attacks![0].type).toBe('ranged')
  })

  it('should infer melee for swords, axes, daggers', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      weapons: [{ name: 'Longsword', die: 'd8', attack: 10, str: '', damageType: 'S' }],
    })
    expect(result.attacks![0].type).toBe('melee')
  })

  it('should expand all single-letter damage types', () => {
    const types = { P: 'piercing', B: 'bludgeoning', S: 'slashing', F: 'fire' }
    for (const [letter, expected] of Object.entries(types)) {
      const result = parsePathbuilderExport({
        ...sampleBuild,
        weapons: [{ name: 'Test Weapon', die: 'd6', attack: 5, str: '', damageType: letter }],
      })
      expect(result.attacks![0].damageType).toBe(expected)
    }
  })

  it('should omit damage when weapon has no die', () => {
    const result = parsePathbuilderExport({
      ...sampleBuild,
      weapons: [{ name: ' unarmed', attack: 5, str: '' }],
    })
    expect(result.attacks![0].damage).toBeUndefined()
  })
})

describe('parsePathbuilderExport - abilities (specials + feats)', () => {
  it('should map specials (plain strings) to passive abilities', () => {
    const result = parsePathbuilderExport(sampleBuild)
    const specialNames = result.abilities!.map((a) => a.name)
    expect(specialNames).toContain('Way of the Pistolero')
    expect(specialNames).toContain('Sneak Attack')
    expect(specialNames).toContain('Darkvision')

    const sneaky = result.abilities!.find((a) => a.name === 'Sneak Attack')!
    expect(sneaky.type).toBe('passive')
    expect(sneaky.description).toBe('')
  })

  it('should map feats (positional tuples) to passive abilities with composed description', () => {
    const result = parsePathbuilderExport(sampleBuild)
    const toughness = result.abilities!.find((a) => a.name === 'Toughness')!
    expect(toughness.type).toBe('passive')
    expect(toughness.description).toContain('Level 7')
    expect(toughness.description).toContain('General Feat')
  })

  it('should omit abilities array when specials and feats are empty', () => {
    const result = parsePathbuilderExport({ ...sampleBuild, specials: [], feats: [] })
    expect(result.abilities).toBeUndefined()
  })
})

describe('parsePathbuilderExport - initiative', () => {
  it('should default initiative to computed perception total (PF2e RAW)', () => {
    const result = parsePathbuilderExport(sampleBuild)
    // Perception = 6 (master) + 12 (level) + 0 (wis_mod) = 18
    expect(result.initiative).toBe(result.perception)
    expect(result.initiative).toBe(18)
  })
})

describe('parsePathbuilderExport - type field', () => {
  it('should always set type to "pc"', () => {
    const result = parsePathbuilderExport(sampleBuild)
    expect(result.type).toBe('pc')
  })
})
