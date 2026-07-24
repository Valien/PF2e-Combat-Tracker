// Adventure modules — pre-packaged encounter bundles for published adventures.
// Each module references monsters by name from enabled content sources and
// bundles a list of encounters that can be added to the tracker in 2 clicks.
//
// Add a new module:
//  1. Create src/data/modules/<module-id>.json
//  2. Import it below and add to the `modules` array.

import menaceUnderOtariData from './data/modules/menace-under-otari.json'

export interface ModuleEncounterMonster {
  name: string
  quantity: number
}

export interface ModuleEncounter {
  id: string
  name: string
  description?: string
  act?: string
  monsters: ModuleEncounterMonster[]
}

export interface ModuleData {
  id: string
  name: string
  description?: string
  requiredSources: string[]
  encounters: ModuleEncounter[]
}

const modules: ModuleData[] = [menaceUnderOtariData as ModuleData]

export function getModules(): ModuleData[] {
  return modules
}

export function getModule(id: string): ModuleData | undefined {
  return modules.find((m) => m.id === id)
}
