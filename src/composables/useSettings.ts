import { useStorage } from '@vueuse/core'
import { getDefaultEnabledSources } from '../db.ts'

// Single source of truth for app-wide settings.
// Components were previously declaring their own useStorage refs for the same
// keys, which shared localStorage state but ran independent watchers and
// diverged on default values (e.g. Settings.vue hardcoded 'pathfinder').
// Module-singleton refs are created once and shared across all callers.

const tempHPEnabled = useStorage<boolean>('useTempHP', true)
const enabledContentSources = useStorage<string[]>(
  'enabledContentSources',
  getDefaultEnabledSources(),
)
const theme = useStorage<string>('theme', 'dracula')
const partyLevel = useStorage<number>('partyLevel', 1)

export function useSettings() {
  return {
    useTempHP: tempHPEnabled,
    enabledContentSources,
    theme,
    partyLevel,
  }
}

export function useTheme() {
  return theme
}

export function useEnabledContentSources() {
  return enabledContentSources
}

export function useTempHP() {
  return tempHPEnabled
}

export function usePartyLevel() {
  return partyLevel
}
