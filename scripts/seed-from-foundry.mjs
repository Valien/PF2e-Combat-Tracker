#!/usr/bin/env node
// Seed missing monster data from the Foundry VTT pf2e system repo
// (https://github.com/foundryvtt/pf2e) and the legacy bestiary spreadsheet.
//
// Usage:
//   node scripts/seed-from-foundry.mjs              # seed all missing sources
//   node scripts/seed-from-foundry.mjs --dry-run    # report what would change
//
// Sources (in priority order):
//   1. Foundry VTT pf2e packs (pathfinder-bestiary, menace-under-otari-bestiary)
//      — complete structured stat blocks (attacks, abilities, traits)
//   2. Legacy Bestiary spreadsheet (Google Sheets CSV export)
//      — basic stats (name, level, ac, hp, fort/ref/will, atk) for monsters
//        not available in Foundry (e.g. "Kobold Warrior" was pruned from the
//        Foundry B1 pack during the Remaster transition)
//
// The Foundry JSONs are individual readable files committed under
// packs/pf2e/<pack-name>/ in the foundryvtt/pf2e repo on branch v14-dev.
// Raw URLs: raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/packs/pf2e/<pack>/<path>
// These are CDN-served and do NOT count against GitHub API rate limits.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'src', 'data', 'pathfinder')
const UA = 'PF2e-Combat-Tracker/2.0 (https://github.com/Valforte/initiative-tracker)'

// GitHub API base for tree listing (rate-limited, ~60/hr unauthenticated)
const GH_API = 'https://api.github.com/repos/foundryvtt/pf2e'
// Raw CDN base for file content (NOT rate-limited)
const GH_RAW = 'https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/packs/pf2e'

// Spreadsheet CSV export URL
const SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1VQdXIJMMeNlkL1ta_b9q_iImAHoujDCYs1WaBJP-Rjs/export?format=csv&gid=0'

const CONCURRENCY = 20

// Pack folder tree SHAs (from GitHub Contents API)
const PACK_TREES = {
  'menace-under-otari-bestiary': '4c1c9b73e2acc2f3fc96b25b4c70213ecb914939',
  'pathfinder-bestiary': 'ea64f7ea57689c2a9df4d1bd282c6989a33d42b2',
}

// Which JSON file each Foundry pack maps to
const PACK_TO_JSON = {
  'menace-under-otari-bestiary': 'menace-under-otari.json',
  'pathfinder-bestiary': 'bestiary.json',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Fetch JSON with retries. Returns parsed JSON or null. */
async function fetchJSON(url, isApi = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = { 'User-Agent': UA, Accept: 'application/json' }
      const res = await fetch(url, { headers, redirect: 'follow' })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status >= 500) {
        const backoff = 1000 * Math.pow(2, attempt)
        console.warn(`  ${res.status}, retrying in ${backoff}ms`)
        await sleep(backoff)
        continue
      }
      if (isApi)
        console.warn(`  GitHub API ${res.status} — rate limit? Remaining: ${res.headers.get('x-ratelimit-remaining')}`)
      return null
    } catch (err) {
      const backoff = 1000 * Math.pow(2, attempt)
      console.warn(`  fetch error: ${err.message}, retrying in ${backoff}ms`)
      await sleep(backoff)
    }
  }
  return null
}

/** Fetch text with retries (for CSV). */
async function fetchText(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
      if (res.ok) return await res.text()
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * Math.pow(2, attempt))
        continue
      }
      return null
    } catch (err) {
      await sleep(1000 * Math.pow(2, attempt))
    }
  }
  return null
}

/** Fetch a batch of URLs concurrently. Calls fn(url, index) for each. */
async function fetchBatch(urls, fn) {
  const results = new Array(urls.length).fill(null)
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (url, j) => {
        const data = await fetchJSON(url)
        return { index: i + j, data }
      }),
    )
    for (const { index, data } of batchResults) {
      results[index] = data
    }
    process.stdout.write('.')
  }
  process.stdout.write('\n')
  return results
}

/**
 * Transform a Foundry VTT NPC actor document to our Monster shape.
 * Strips HTML and Foundry template syntax from descriptions.
 */
function transformFoundryMonster(data) {
  const sys = data.system || {}
  const attrs = sys.attributes || {}
  const details = sys.details || {}
  const saves = sys.saves || {}

  // Strip " (BB)" suffix (Beginner Box variant)
  const name = (data.name || '').replace(/\s*\((?:BB|BoG)\)\s*$/i, '').trim()
  if (!name) return null

  const monster = { name, hp: attrs.hp?.max ?? 1 }

  if (details.level?.value !== undefined) monster.level = details.level.value
  if (attrs.ac?.value !== undefined) monster.ac = attrs.ac.value
  if (sys.perception?.mod !== undefined) monster.perception = sys.perception.mod
  if (saves.fortitude?.value !== undefined) monster.fortitude = saves.fortitude.value
  if (saves.reflex?.value !== undefined) monster.reflex = saves.reflex.value
  if (saves.will?.value !== undefined) monster.will = saves.will.value
  if (attrs.speed?.value !== undefined) monster.speed = attrs.speed.value
  if (sys.traits?.value?.length > 0) monster.traits = sys.traits.value

  const pubTitle = details.publication?.title
  if (pubTitle) monster.source = pubTitle

  // Attacks: melee/ranged items
  const attacks = (data.items || [])
    .filter((item) => item.type === 'melee' || item.type === 'ranged')
    .map((item) => {
      const sys2 = item.system || {}
      const bonus = sys2.bonus?.value
      const traits = sys2.traits?.value || []
      const isAgile = traits.includes('agile')
      const step = isAgile ? 4 : 5
      const map1 = typeof bonus === 'number' ? bonus - step : undefined
      const map2 = typeof bonus === 'number' ? bonus - step * 2 : undefined

      // Damage rolls: { key: { damage: '1d6+1', damageType: 'piercing' } }
      const rolls = Object.values(sys2.damageRolls || {})
        .filter((dr) => dr.damage)
        .map((dr) => `${dr.damage} ${dr.damageType || ''}`.trim())
      const damage = rolls.length > 0 ? rolls.join(' plus ') : undefined

      const atk = { name: item.name, type: item.type }
      if (typeof bonus === 'number') atk.bonus = bonus
      if (map1 !== undefined) atk.map1 = map1
      if (map2 !== undefined) atk.map2 = map2
      if (damage) {
        atk.damage = damage
        const dtMatch = damage.match(/(\w+)\s*$/)
        if (dtMatch) atk.damageType = dtMatch[1]
      }
      if (traits.length > 0) atk.traits = traits
      return atk
    })
  if (attacks.length > 0) monster.attacks = attacks

  // Abilities: action/reaction/free items
  const abilities = (data.items || [])
    .filter((item) => ['action', 'reaction', 'free'].includes(item.type))
    .map((item) => {
      const sys2 = item.system || {}
      const actionType = sys2.actionType?.value
      const actions = sys2.actions?.value
      let desc = sys2.description?.value || ''
      // Strip HTML tags
      desc = desc.replace(/<[^>]+>/g, ' ')
      // @UUID[...]{Text} → Text
      desc = desc.replace(/@UUID\[[^\]]*\]\{([^}]+)\}/g, '$1')
      // @Damage[formula] → formula
      desc = desc.replace(/@Damage\[([^\]]+)\]/g, '$1')
      // Other @Template[...] references → strip
      desc = desc.replace(/@\w+\[[^\]]+\]/g, '')
      desc = desc.replace(/\s+/g, ' ').trim()
      if (!desc) return null
      const ab = { name: item.name, type: actionType || 'passive', description: desc }
      if (actions !== null && actions !== undefined) ab.actions = actions
      return ab
    })
    .filter(Boolean)
  if (abilities.length > 0) monster.abilities = abilities

  return monster
}

/** Parse a modifier string like "+5" or "-1" → number. */
function parseMod(text) {
  if (!text) return undefined
  const m = String(text).match(/-?\+?\d+/)
  return m ? parseInt(m[0], 10) : undefined
}

/** Parse the spreadsheet CSV into an array of basic monster objects. */
function parseSpreadsheet(csvText) {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  // Header: Name,Level,AC,Low Save,Hi Save,Median Save,Fort,Ref,Will,HP,Atk,DC
  const monsters = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 10) continue
    const name = cols[0]?.trim()
    if (!name) continue
    const level = parseInt(cols[1], 10)
    const ac = parseInt(cols[2], 10)
    const fort = parseMod(cols[6])
    const ref = parseMod(cols[7])
    const will = parseMod(cols[8])
    const hp = parseInt(cols[9], 10)
    if (isNaN(hp)) continue
    const m = { name, hp }
    if (!isNaN(level)) m.level = level
    if (!isNaN(ac)) m.ac = ac
    if (fort !== undefined) m.fortitude = fort
    if (ref !== undefined) m.reflex = ref
    if (will !== undefined) m.will = will
    monsters.push(m)
  }
  return monsters
}

/** Minimal CSV line parser (handles quoted fields). */
function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

/** Collect all existing monster names (lowercased) from all JSON source files. */
function collectExistingNames() {
  const names = new Set()
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
      for (const m of data.monsters || []) {
        const name = typeof m === 'string' ? m : m.name
        if (name) names.add(name.toLowerCase())
      }
    } catch {
      // skip corrupt
    }
  }
  return names
}

/** Load and parse an existing source JSON file. */
function loadSource(file) {
  const filePath = path.join(DATA_DIR, file)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

/** Get all file paths from a Foundry pack tree (recursive). */
async function getPackFileList(packFolder, treeSha) {
  const url = `${GH_API}/git/trees/${treeSha}?recursive=1`
  const data = await fetchJSON(url, true)
  if (!data || !data.tree) {
    console.warn(`  Could not fetch tree for ${packFolder}`)
    return []
  }
  return data.tree
    .filter((t) => t.path.endsWith('.json') && !t.path.startsWith('_'))
    .map((t) => ({ path: t.path, pack: packFolder }))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('=== Monster Seeding Script ===\n')

  // Step 1: Collect existing monster names
  console.log('1. Collecting existing monster names from all source JSONs...')
  const existingNames = collectExistingNames()
  console.log(`   Found ${existingNames.size} existing monster entries\n`)

  // Step 2: Download Foundry packs
  console.log('2. Fetching Foundry VTT pack file listings...')
  let allFoundryFiles = []
  for (const [packFolder, treeSha] of Object.entries(PACK_TREES)) {
    const files = await getPackFileList(packFolder, treeSha)
    console.log(`   ${packFolder}: ${files.length} files`)
    allFoundryFiles.push(...files)
  }
  console.log(`   Total Foundry files: ${allFoundryFiles.length}\n`)

  // Step 3: Download and transform all Foundry monsters
  console.log('3. Downloading and transforming Foundry monsters...')
  const rawUrls = allFoundryFiles.map(
    (f) => `${GH_RAW}/${PACK_TREES[f.pack] ? f.pack : f.pack}/${f.path}`,
  )
  // Build correct raw URLs
  const urls = allFoundryFiles.map((f) => {
    const packBase = f.pack // e.g. "menace-under-otari-bestiary" or "pathfinder-bestiary"
    return `${GH_RAW}/${packBase}/${f.path}`
  })

  const foundryData = await fetchBatch(urls)
  const foundryByPack = {}
  for (let i = 0; i < allFoundryFiles.length; i++) {
    const file = allFoundryFiles[i]
    const data = foundryData[i]
    if (!data) continue
    const monster = transformFoundryMonster(data)
    if (!monster) continue
    const jsonFile = PACK_TO_JSON[file.pack]
    if (!jsonFile) continue
    if (!foundryByPack[jsonFile]) foundryByPack[jsonFile] = []
    foundryByPack[jsonFile].push(monster)
  }

  for (const [jsonFile, monsters] of Object.entries(foundryByPack)) {
    console.log(`   ${jsonFile}: ${monsters.length} transformed monsters`)
  }
  console.log()

  // Step 4: Download and parse the spreadsheet
  console.log('4. Fetching legacy bestiary spreadsheet...')
  const csvText = await fetchText(SPREADSHEET_URL)
  let spreadsheetMonsters = []
  if (csvText) {
    spreadsheetMonsters = parseSpreadsheet(csvText)
    console.log(`   Parsed ${spreadsheetMonsters.length} monsters from spreadsheet\n`)
  } else {
    console.warn('   Could not fetch spreadsheet — skipping spreadsheet-only seeding\n')
  }

  // Step 5: Build novel monster lists per source file
  console.log('5. Filtering against existing entries...')

  // For each Foundry pack, filter out monsters already in our JSONs
  const newByFile = {}
  for (const [jsonFile, monsters] of Object.entries(foundryByPack)) {
    newByFile[jsonFile] = monsters.filter(
      (m) => !existingNames.has(m.name.toLowerCase()),
    )
    console.log(`   ${jsonFile}: ${newByFile[jsonFile].length} new (of ${monsters.length} from Foundry)`)
  }

  // For spreadsheet monsters not in Foundry, add to bestiary.json
  const foundryB1Names = new Set(
    (foundryByPack['bestiary.json'] || []).map((m) => m.name.toLowerCase()),
  )
  const spreadsheetOnly = spreadsheetMonsters.filter((m) => {
    const lower = m.name.toLowerCase()
    return !existingNames.has(lower) && !foundryB1Names.has(lower)
  })
  console.log(`   bestiary.json: ${spreadsheetOnly.length} new from spreadsheet (not in Foundry)`)

  if (!newByFile['bestiary.json']) newByFile['bestiary.json'] = []
  newByFile['bestiary.json'].push(...spreadsheetOnly)

  // Step 6: Write results
  console.log('\n6. Writing updated source files...')
  let totalNew = 0
  for (const [jsonFile, newMonsters] of Object.entries(newByFile)) {
    if (newMonsters.length === 0) continue
    totalNew += newMonsters.length

    // For new source files (menace-under-otari.json), create the full structure
    if (jsonFile === 'menace-under-otari.json') {
      const sourceData = {
        id: 'menace-under-otari',
        name: 'Menace under Otari',
        system: 'pathfinder',
        enabledByDefault: false,
        monsters: newMonsters,
      }
      if (dryRun) {
        console.log(`   [DRY RUN] Would CREATE ${jsonFile} with ${newMonsters.length} monsters`)
      } else {
        const outPath = path.join(DATA_DIR, jsonFile)
        fs.writeFileSync(outPath, JSON.stringify(sourceData, null, 2) + '\n')
        console.log(`   CREATED ${jsonFile}: ${newMonsters.length} monsters`)
      }
      continue
    }

    // For existing source files, load and append
    const source = loadSource(jsonFile)
    if (!source) {
      console.warn(`   Could not load ${jsonFile} — skipping`)
      continue
    }

    // Sort new monsters by name for consistency
    newMonsters.sort((a, b) => a.name.localeCompare(b.name))

    if (dryRun) {
      console.log(`   [DRY RUN] Would APPEND ${newMonsters.length} monsters to ${jsonFile}`)
    } else {
      source.monsters.push(...newMonsters)
      // Sort all monsters by name
      source.monsters.sort((a, b) => {
        const an = typeof a === 'string' ? a : a.name
        const bn = typeof b === 'string' ? b : b.name
        return an.localeCompare(bn)
      })
      const outPath = path.join(DATA_DIR, jsonFile)
      fs.writeFileSync(outPath, JSON.stringify(source, null, 2) + '\n')
      console.log(`   UPDATED ${jsonFile}: +${newMonsters.length} monsters (total: ${source.monsters.length})`)
    }
  }

  console.log(`\n=== Done. ${totalNew} new monsters seeded. ===`)

  // Report Kobold Warrior specifically
  const allNames = [...existingNames]
  const kwFound = foundryByPack['menace-under-otari.json']?.some((m) => m.name === 'Kobold Warrior')
  const kwSpreadsheet = spreadsheetMonsters.some((m) => m.name === 'Kobold Warrior')
  console.log(`\nKobold Warrior: ${kwFound ? 'Found in Foundry (Menace under Otari)' : kwSpreadsheet ? 'Found in spreadsheet' : 'NOT FOUND'}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
