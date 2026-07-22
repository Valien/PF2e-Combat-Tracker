#!/usr/bin/env node
// Parse Archives of Nethys monster pages and write rich stat-block data
// into the per-source JSON files under src/data/pathfinder/.
//
// Replaces the dead scripts/parse-pf2e-monsters.cjs (which read from a
// pf2e-monsters.json source file no longer checked into the repo).
//
// Usage:
//   pnpm update-monsters                          # update default sources only
//   node scripts/parse-aon-monsters.mjs --all    # update all sources
//   node scripts/parse-aon-monsters.mjs --source monster-core
//   node scripts/parse-aon-monsters.mjs --source monster-core --force
//   node scripts/parse-aon-monsters.mjs --source monster-core --elite
//   node scripts/parse-aon-monsters.mjs --source monster-core --weak
//
// Politeness:
//   - 1 request per second throttle (configurable via --delay <ms>)
//   - custom UA identifying the project
//   - exponential backoff on 429 / 5xx (max 3 retries)
//   - resumable per-file: skips monsters that already have a `level` field
//     unless --force is passed
//
// Validation:
//   - every parsed monster is validated against a Zod schema before write
//   - a single malformed AoN page will not corrupt the JSON

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { z } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'src', 'data', 'pathfinder')
const BASE_URL = 'https://2e.aonprd.com'
const UA = 'PF2e-Combat-Tracker/2.0 (https://github.com/Valforte/initiative-tracker)'
const DEFAULT_DELAY_MS = 1000
const MAX_RETRIES = 3

const DamageModifierSchema = z.object({
  type: z.string(),
  value: z.number(),
})

const AttackSchema = z.object({
  name: z.string(),
  type: z.enum(['melee', 'ranged']),
  bonus: z.number(),
  map1: z.number().optional(),
  map2: z.number().optional(),
  damage: z.string().optional(),
  damageType: z.string().optional(),
  traits: z.array(z.string()).optional(),
})

const AbilitySchema = z.object({
  name: z.string(),
  type: z.enum(['action', 'reaction', 'free', 'passive']),
  actions: z.number().optional(),
  description: z.string(),
  traits: z.array(z.string()).optional(),
})

const MonsterSchema = z.object({
  name: z.string(),
  hp: z.number(),
  url: z.string().optional(),
  level: z.number().optional(),
  ac: z.number().optional(),
  perception: z.number().optional(),
  fortitude: z.number().optional(),
  reflex: z.number().optional(),
  will: z.number().optional(),
  speed: z.number().optional(),
  resistances: z.array(DamageModifierSchema).optional(),
  weaknesses: z.array(DamageModifierSchema).optional(),
  immunities: z.array(z.string()).optional(),
  traits: z.array(z.string()).optional(),
  family: z.string().optional(),
  source: z.string().optional(),
  attacks: z.array(AttackSchema).optional(),
  abilities: z.array(AbilitySchema).optional(),
})

/** Parse CLI args into a runtime config. */
function parseArgs() {
  const argv = process.argv.slice(2)
  const config = {
    source: null,
    all: false,
    force: false,
    elite: false,
    weak: false,
    delay: DEFAULT_DELAY_MS,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--all') config.all = true
    else if (arg === '--force') config.force = true
    else if (arg === '--elite') config.elite = true
    else if (arg === '--weak') config.weak = true
    else if (arg === '--source') config.source = argv[++i]
    else if (arg === '--delay') config.delay = parseInt(argv[++i], 10) || DEFAULT_DELAY_MS
    else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: parse-aon-monsters.mjs [options]',
          '',
          'Options:',
          '  --source <id>   Only update the named source (kebab-case id from JSON)',
          '  --all           Update all sources (default: only enabledByDefault ones)',
          '  --force         Re-fetch monsters that already have rich data',
          '  --elite         Apply elite adjustments (level +1)',
          '  --weak          Apply weak adjustments (level -1)',
          '  --delay <ms>    Throttle between requests (default 1000)',
          '  --help, -h      Show this help',
        ].join('\n'),
      )
      process.exit(0)
    }
  }
  return config
}

/** Sleep helper for throttling. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch a URL with retries and exponential backoff.
 * Returns the response text, or null if all retries failed.
 */
async function fetchWithRetries(url) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'follow',
      })
      if (res.ok) return await res.text()
      if (res.status === 429 || res.status >= 500) {
        const backoff = 1000 * Math.pow(2, attempt)
        console.warn(
          `  ${res.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        )
        await sleep(backoff)
        continue
      }
      console.warn(`  ${res.status} (unrecoverable), skipping`)
      return null
    } catch (err) {
      const backoff = 1000 * Math.pow(2, attempt)
      console.warn(`  fetch error: ${err.message}, retrying in ${backoff}ms`)
      await sleep(backoff)
    }
  }
  return null
}

/**
 * Number parser that handles "+5", "-1", "22", returns undefined on no match.
 */
function parseModifier(text) {
  if (!text) return undefined
  const match = text.match(/-?\+?\d+/)
  if (!match) return undefined
  return parseInt(match[0], 10)
}

function parseNumber(text) {
  if (!text) return undefined
  const match = text.match(/\d+/)
  if (!match) return undefined
  return parseInt(match[0], 10)
}

/**
 * Parse the damage-type list (e.g. "poison 5, fire 10") into DamageModifier[].
 */
function parseDamageModifiers(text) {
  if (!text) return []
  const mods = []
  for (const part of text.split(/[,;]/)) {
    const m = part.trim().match(/^(\w[\w\s-]*?)\s+(\d+)$/)
    if (m) mods.push({ type: m[1].trim(), value: parseInt(m[2], 10) })
  }
  return mods
}

function parseImmunities(text) {
  if (!text) return []
  return text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Parse a single AoN monster HTML page into a rich monster object.
 * Returns null if the page structure doesn't match expectations.
 */
function parseMonsterPage(html, baseUrl) {
  const $ = cheerio.load(html)
  const main = $('.monster-page').first()
  if (!main.length) return null

  // Name + level
  const navbarName = $('.monster-statblock-name a').first().text().trim()
  const titleText = $('.monster-statblock-name').first().text().trim()
  const name = navbarName || titleText.split('Creature')[0].trim()
  if (!name) return null

  // "Creature N" appears at the right edge of .monster-statblock-name
  const levelMatch = $('.monster-statblock-name')
    .first()
    .text()
    .match(/Creature\s+(-?\d+)/)
  const level = levelMatch ? parseInt(levelMatch[1], 10) : undefined

  // Traits: spans with class "trait". Selecting only ".trait" (not ".trait a")
  // avoids doubling — ".trait a" matches the <a> inside .trait, and the parent
  // .trait match would also include the same text.
  const traitsSet = new Set()
  main.find('.trait').each((_, el) => {
    const t = $(el).text().trim()
    if (t) traitsSet.add(t)
  })
  const traits = [...traitsSet]

  // We grab the whole stat block text and use targeted regexes for the
  // labeled fields. Cheerio selectors alone are unreliable here because
  // AoN mixes inline bold tags with plain text on a single line.
  const text = main.text()

  const hpMatch = text.match(/HP\s+(\d+)/)
  const hp = hpMatch ? parseInt(hpMatch[1], 10) : 1

  const acMatch = text.match(/AC\s+(\d+)/)
  const ac = acMatch ? parseInt(acMatch[1], 10) : undefined

  const perceptionMatch = text.match(/Perception\s+([+-]?\d+)/)
  const perception = perceptionMatch ? parseModifier(perceptionMatch[1]) : undefined

  const fortMatch = text.match(/Fort\s+([+-]?\d+)/)
  const fortitude = fortMatch ? parseModifier(fortMatch[1]) : undefined

  const refMatch = text.match(/Ref\s+([+-]?\d+)/)
  const reflex = refMatch ? parseModifier(refMatch[1]) : undefined

  const willMatch = text.match(/Will\s+([+-]?\d+)/)
  const will = willMatch ? parseModifier(willMatch[1]) : undefined

  const speedMatch = text.match(/Speed\s+(\d+)/)
  const speed = speedMatch ? parseInt(speedMatch[1], 10) : undefined

  // Resistances / Weaknesses / Immunities
  // AoN puts the entire stat block on a single line (no newlines), so [^\n]+
  // would grab to end of text. We use a lookahead for the next labeled field
  // as the boundary.
  const fieldBoundary =
    '(?=\\s*(?:Resistances|Weaknesses|Immunities|Speed|Melee|Ranged|HP|AC|Perception|Fort|Ref|Will|Source|All Monsters|Before|Note|Remember|$))'

  const resMatch = text.match(new RegExp('Resistances\\s+(.+?)' + fieldBoundary))
  const resistances = resMatch ? parseDamageModifiers(resMatch[1]) : undefined

  const weakMatch = text.match(new RegExp('Weaknesses\\s+(.+?)' + fieldBoundary))
  const weaknesses = weakMatch ? parseDamageModifiers(weakMatch[1]) : undefined

  const immuneMatch = text.match(new RegExp('Immunities\\s+(.+?)' + fieldBoundary))
  const immunities = immuneMatch ? parseImmunities(immuneMatch[1]) : undefined

  // Source line (e.g. "Monster Core pg. 304") — match up to the page number
  const sourceMatch = text.match(/Source\s+(.+?pg\.\s*\d+)/)
  const source = sourceMatch ? sourceMatch[1].trim() : undefined

  // Monster family (sidebar link)
  const familyName = main.find('.monster-family .title a').first().text().trim() || undefined

  // Attacks: split statblock text at Melee/Ranged boundaries so each attack
  // is isolated, then parse name/bonus/MAP/damage from its segment.
  // Previously a single [^\n]+ regex was used, but AoN has no newlines in the
  // stat block, so it swallowed subsequent attacks and abilities.
  const attacks = []
  const statblockHtml = $('.monster-statblock-name').first().parent().html() || main.html() || ''
  const statblockText = cheerio.load(statblockHtml)('body').text()
  const attackSegments = statblockText.split(/(?=(?:Melee|Ranged)\s)/)
  for (const seg of attackSegments) {
    const segTrim = seg.trim()
    if (!/^(Melee|Ranged)/.test(segTrim)) continue
    const isRanged = segTrim.startsWith('Ranged')
    const nameMatch = segTrim.match(
      /^(?:Melee|Ranged)\s*\s*\[one-action\]\s*\s*(\S+(?:\s+\S+)*?)\s+([+-]\d+)/,
    )
    if (!nameMatch) continue
    const atkName = nameMatch[1].trim()
    const bonus = parseModifier(nameMatch[2])
    const mapMatch = segTrim.match(/\[([+-]\d+)\/([+-]\d+)\]/)
    // Damage: bound to this segment (already split at next Melee/Ranged).
    // The last attack's segment extends to end of statblock text and includes
    // abilities/lore. AoN concatenates elements without spaces, so a
    // lowercase→uppercase transition marks where an ability name begins
    // (e.g. "1d6+11 piercingRattling Spear [one-action]..." → "1d6+11 piercing").
    // Damage text is lowercase-only in PF2e (dice + type + "plus" + "persistent").
    let damageText = null
    const damageMatch = segTrim.match(/Damage\s+(.+)/)
    if (damageMatch) {
      const bleedMatch = damageMatch[1].match(/^(.+?[a-z])(?=[A-Z])/)
      damageText = bleedMatch ? bleedMatch[1] : damageMatch[1].trim()
    }
    const damageTypeMatch = damageText?.match(/(\w+)\s*$/)
    attacks.push({
      name: atkName,
      type: isRanged ? 'ranged' : 'melee',
      bonus,
      ...(mapMatch && { map1: parseModifier(mapMatch[1]) }),
      ...(mapMatch && { map2: parseModifier(mapMatch[2]) }),
      ...(damageText && { damage: damageText }),
      ...(damageTypeMatch && { damageType: damageTypeMatch[1] }),
    })
  }

  // Abilities: reactions and named actions inside hanging-indent spans
  const abilities = []
  main.find('.hanging-indent').each((_, el) => {
    const $el = $(el)
    const rawText = $el.text().trim()
    if (!rawText) return
    const nameMatch = rawText.match(/^(.+?)\s{2,}/)
    const abName = nameMatch ? nameMatch[1].trim() : rawText.split('  ')[0].trim()
    if (!abName || abName.length > 80) return // sanity: skip misfires
    // Description: strip the leading name (it repeats at the start of the text)
    let description = rawText
    if (rawText.startsWith(abName)) {
      description = rawText.slice(abName.length).trim()
    }
    const isReaction = rawText.includes('[reaction]')
    const isFree = rawText.includes('[free-action]')
    const actionCount =
      (rawText.match(/\[one-action\]/g) || []).length +
      (rawText.match(/\[two-action\]/g) || []).length * 2 +
      (rawText.match(/\[three-action\]/g) || []).length * 3
    const type = isReaction ? 'reaction' : isFree ? 'free' : actionCount > 0 ? 'action' : 'passive'
    abilities.push({
      name: abName,
      type,
      ...(actionCount > 0 && { actions: actionCount }),
      description,
    })
  })

  const url = baseUrl
    ? `${baseUrl}?${new URLSearchParams({
        ID: baseUrl.match(/ID=(\d+)/)?.[1] || '',
        ...(config.elite && { Elite: 'true' }),
        ...(config.weak && { Weak: 'true' }),
      }).toString()}`
    : undefined

  return {
    name,
    hp,
    ...(url && { url }),
    ...(level !== undefined && { level }),
    ...(ac !== undefined && { ac }),
    ...(perception !== undefined && { perception }),
    ...(fortitude !== undefined && { fortitude }),
    ...(reflex !== undefined && { reflex }),
    ...(will !== undefined && { will }),
    ...(speed !== undefined && { speed }),
    ...(resistances && resistances.length > 0 && { resistances }),
    ...(weaknesses && weaknesses.length > 0 && { weaknesses }),
    ...(immunities && immunities.length > 0 && { immunities }),
    ...(traits.length > 0 && { traits }),
    ...(familyName && { family: familyName }),
    ...(source && { source }),
    ...(attacks.length > 0 && { attacks }),
    ...(abilities.length > 0 && { abilities }),
  }
}

// Hoist config so parseMonsterPage can read elite/weak for url building.
let config = null

/**
 * Enrich one monster entry by fetching its AoN page and parsing.
 * Skips monsters that already have `level` unless --force is set.
 * Returns the original entry if fetch fails, so the JSON stays intact.
 */
async function enrichMonster(entry) {
  if (typeof entry === 'string') {
    // string-only entries have no URL to fetch; return as-is
    return entry
  }
  if (entry.level !== undefined && !config.force) {
    return entry
  }
  if (!entry.url) return entry

  console.log(`  Fetching: ${entry.name} (${entry.url})`)
  const html = await fetchWithRetries(entry.url)
  await sleep(config.delay)
  if (!html) {
    console.warn(`  ! Failed to fetch ${entry.name}, keeping existing entry`)
    return entry
  }

  const parsed = parseMonsterPage(html, entry.url)
  if (!parsed) {
    console.warn(`  ! Could not parse ${entry.name}, keeping existing entry`)
    return entry
  }

  const result = MonsterSchema.safeParse(parsed)
  if (!result.success) {
    console.warn(`  ! Schema validation failed for ${entry.name}:`, result.error.message)
    return entry
  }

  // Merge: keep the original url, prefer parsed fields
  return { ...entry, ...result.data, url: entry.url, name: entry.name }
}

/**
 * Process one JSON source file: read it, enrich each monster, write it back.
 * Preserves enabledByDefault. Returns counts for the summary.
 */
async function processSourceFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  let updated = 0
  let skipped = 0
  let failed = 0

  console.log(`\nProcessing: ${data.name} (${data.id})`)
  const enriched = []
  for (const entry of data.monsters) {
    try {
      const result = await enrichMonster(entry)
      if (result === entry) {
        skipped++
      } else {
        updated++
      }
      enriched.push(result)
    } catch (err) {
      console.warn(`  ! Unexpected error on ${entry.name || entry}: ${err.message}`)
      failed++
      enriched.push(entry) // keep original on error
    }
  }

  data.monsters = enriched
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  -> ${updated} updated, ${skipped} skipped, ${failed} failed`)
  return { updated, skipped, failed }
}

async function main() {
  config = parseArgs()

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
  const targets = []
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (config.source) {
      if (data.id === config.source) targets.push(filePath)
    } else if (config.all) {
      targets.push(filePath)
    } else if (data.enabledByDefault === true) {
      targets.push(filePath)
    }
  }

  if (targets.length === 0) {
    console.log('No source files matched the criteria.')
    console.log('Available source IDs:')
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
      console.log(`  ${data.id}  (${data.name})`)
    }
    process.exit(0)
  }

  console.log(`Targets: ${targets.length} source file(s)`)
  console.log(`Delay between requests: ${config.delay}ms`)
  if (config.elite) console.log('Mode: Elite (level +1)')
  if (config.weak) console.log('Mode: Weak (level -1)')

  let totalUpdated = 0
  let totalSkipped = 0
  let totalFailed = 0
  for (const filePath of targets) {
    const result = await processSourceFile(filePath)
    totalUpdated += result.updated
    totalSkipped += result.skipped
    totalFailed += result.failed
  }

  console.log(`\n=== Summary ===`)
  console.log(`Updated: ${totalUpdated}`)
  console.log(`Skipped: ${totalSkipped}`)
  console.log(`Failed: ${totalFailed}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
