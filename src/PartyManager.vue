<script setup lang="ts">
import { ref, computed } from 'vue'
import { Combatant } from './functions.ts'
import { Icon } from '@iconify/vue'
import { useTranslations } from './lang.ts'
import { useStorage } from '@vueuse/core'
import { parsePathbuilderExport, PathbuilderParseError } from './pathbuilder.ts'
import { Label, NumberFieldRoot, NumberFieldInput } from 'reka-ui'
import { getModules, type ModuleData, type ModuleEncounter } from './modules.ts'

const { t } = useTranslations()

const props = defineProps<{
  combatants: Combatant[]
  partyRosters: Record<string, any[]>
  activePartyName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'newPc', name: string, HP: number, initiative: number, extras?: Record<string, unknown>): void
  (e: 'saveParty'): void
  (e: 'savePartyAs', name: string): void
  (e: 'loadParty'): void
  (e: 'loadPartyByName', name: string): void
  (e: 'renameParty', oldName: string, newName: string): void
  (e: 'deleteParty', name: string): void
  (e: 'removeFromRoster', name: string): void
  (e: 'loadEncounter', encounter: ModuleEncounter): void
}>()

const isOpen = useStorage<boolean>('partyPanelOpen', false)

// --- PC manual add form ---
const isAddPcOpen = ref(false)
const newPcName = ref('')
const newPcLevel = ref(1)
const newPcHP = ref(10)
const newPcInitiative = ref(1)
const newPcAC = ref<number | undefined>(undefined)
const newPcPerception = ref<number | undefined>(undefined)
const newPcFortitude = ref<number | undefined>(undefined)
const newPcReflex = ref<number | undefined>(undefined)
const newPcWill = ref<number | undefined>(undefined)

function clearPcForm(): void {
  newPcName.value = ''
  newPcLevel.value = 1
  newPcHP.value = 10
  newPcInitiative.value = 1
  newPcAC.value = undefined
  newPcPerception.value = undefined
  newPcFortitude.value = undefined
  newPcReflex.value = undefined
  newPcWill.value = undefined
}

function addPc(): void {
  const extras: Record<string, unknown> = {
    type: 'pc',
    level: newPcLevel.value,
  }
  if (newPcAC.value !== undefined) extras.ac = newPcAC.value
  if (newPcPerception.value !== undefined) extras.perception = newPcPerception.value
  if (newPcFortitude.value !== undefined) extras.fortitude = newPcFortitude.value
  if (newPcReflex.value !== undefined) extras.reflex = newPcReflex.value
  if (newPcWill.value !== undefined) extras.will = newPcWill.value

  emit('newPc', newPcName.value, newPcHP.value, newPcInitiative.value, extras)
  isAddPcOpen.value = false
  setTimeout(clearPcForm, 1)
}

// --- Pathbuilder import ---
const isImportOpen = ref(false)
const importText = ref('')
const importError = ref('')
const importSuccess = ref(false)
const fileInput = ref<HTMLInputElement>()

function handleImport(): void {
  importError.value = ''
  importSuccess.value = false
  const text = importText.value.trim()
  if (!text) {
    importError.value = t.value.party.parseError
    return
  }

  try {
    const parsed = parsePathbuilderExport(text)
    const extras: Record<string, unknown> = {
      type: 'pc',
      level: parsed.level,
    }
    if (parsed.ac !== undefined) extras.ac = parsed.ac
    if (parsed.perception !== undefined) extras.perception = parsed.perception
    if (parsed.fortitude !== undefined) extras.fortitude = parsed.fortitude
    if (parsed.reflex !== undefined) extras.reflex = parsed.reflex
    if (parsed.will !== undefined) extras.will = parsed.will
    if (parsed.speed !== undefined) extras.speed = parsed.speed
    if (parsed.traits?.length) extras.traits = parsed.traits
    if (parsed.resistances?.length) extras.resistances = parsed.resistances
    if (parsed.attacks?.length) extras.attacks = parsed.attacks
    if (parsed.abilities?.length) extras.abilities = parsed.abilities

    emit('newPc', parsed.name, parsed.totalHP, parsed.initiative, extras)
    importSuccess.value = true
    importText.value = ''
    setTimeout(() => {
      importSuccess.value = false
    }, 3000)
  } catch (err) {
    importError.value =
      err instanceof PathbuilderParseError ? err.message : t.value.party.parseError
  }
}

function handleFileUpload(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    importText.value = String(e.target?.result || '')
    handleImport()
  }
  reader.onerror = () => {
    importError.value = t.value.party.parseError
  }
  reader.readAsText(file)
}

// --- Saved parties (multiple) ---
const partyNames = computed<string[]>(() => Object.keys(props.partyRosters || {}))

// Active party's roster (for display in the "Active Party Members" section)
const activeRoster = computed<any[]>(() => {
  const name = props.activePartyName
  if (!name) return []
  const roster = props.partyRosters?.[name]
  if (!roster) return []
  return (Array.isArray(roster) ? roster : []).map((item: unknown) =>
    typeof item === 'string' ? JSON.parse(item) : item,
  )
})

function handleSavePartyAs(): void {
  const name = window.prompt(t.value.party.saveAsPrompt, t.value.party.defaultPartyName)
  if (name && name.trim()) emit('savePartyAs', name.trim())
}

function handleRename(name: string): void {
  const newName = window.prompt(t.value.party.renamePrompt, name)
  if (newName && newName.trim() && newName.trim() !== name) {
    emit('renameParty', name, newName.trim())
  }
}

function handleDelete(name: string): void {
  if (window.confirm(t.value.party.deleteConfirm)) {
    emit('deleteParty', name)
  }
}

// --- Adventure modules ---
const isModulesOpen = ref(false)
const selectedModuleId = ref<string>('')
const modules = getModules()
const selectedModule = computed<ModuleData | undefined>(() =>
  modules.find((m) => m.id === selectedModuleId.value),
)

// Group encounters by act for display
const encounterGroups = computed(() => {
  const mod = selectedModule.value
  if (!mod) return []
  const groups: { act: string; encounters: ModuleEncounter[] }[] = []
  for (const enc of mod.encounters) {
    const act = enc.act || ''
    let group = groups.find((g) => g.act === act)
    if (!group) {
      group = { act, encounters: [] }
      groups.push(group)
    }
    group.encounters.push(enc)
  }
  return groups
})

// Track which encounters have been added to current combat (by monster names)
const addedEncounterIds = ref<Set<string>>(new Set())

function handleLoadEncounter(encounter: ModuleEncounter): void {
  emit('loadEncounter', encounter)
  addedEncounterIds.value.add(encounter.id)
}
</script>

<template>
  <!-- Toggle button (visible when panel is closed) -->
  <button
    v-if="!isOpen"
    class="btn btn-neutral btn-sm fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-r-none"
    :aria-label="t.party.toggle"
    @click="isOpen = true"
  >
    <Icon icon="tabler:users" height="18" />
    <span class="hidden lg:inline">{{ t.party.title }}</span>
  </button>

  <!-- Side Panel -->
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    leave-active-class="transition-transform duration-200 ease-in"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="isOpen"
      class="fixed right-0 top-0 bottom-0 w-96 max-w-[90vw] z-50 bg-base-200 shadow-2xl flex flex-col"
    >
      <!-- Panel header -->
      <div class="flex items-center justify-between p-4 border-b border-base-content/10 shrink-0">
        <h2 class="font-bold text-lg flex items-center gap-2">
          <Icon icon="tabler:users" height="24" />
          {{ t.party.title }}
        </h2>
        <button class="btn btn-ghost btn-sm btn-circle" @click="isOpen = false">
          <Icon icon="tabler:x" height="20" />
        </button>
      </div>

      <!-- Panel body (scrollable) -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Action buttons -->
        <div class="flex flex-col gap-2">
          <button
            class="btn btn-primary btn-sm"
            :disabled="!combatants.length"
            @click="$emit('saveParty')"
          >
            <Icon icon="tabler:device-floppy" height="18" />{{ t.party.saveCurrent }}
          </button>
          <button
            class="btn btn-neutral btn-sm"
            :disabled="!combatants.length"
            @click="handleSavePartyAs"
          >
            <Icon icon="tabler:folder-plus" height="18" />{{ t.party.saveAs }}
          </button>
        </div>

        <!-- Saved parties list -->
        <div class="border border-base-content/10 rounded-lg p-3 bg-base-100">
          <div class="text-sm font-semibold mb-2">{{ t.party.parties }}</div>
          <div v-if="partyNames.length" class="flex flex-col gap-1">
            <div
              v-for="name in partyNames"
              :key="name"
              class="group flex items-center gap-2 p-2 rounded bg-base-200/50"
              :class="{ 'ring-1 ring-accent': name === activePartyName }"
            >
              <button
                class="flex-1 text-left flex items-center gap-2 hover:bg-base-300/60 transition-colors rounded -mx-1 px-1 py-0.5"
                :title="t.party.loadParty"
                @click="$emit('loadPartyByName', name)"
              >
                <Icon
                  v-if="name === activePartyName"
                  icon="tabler:circle-filled"
                  height="10"
                  class="text-accent shrink-0"
                />
                <Icon
                  v-else
                  icon="tabler:circle"
                  height="10"
                  class="text-base-content/30 shrink-0"
                />
                <span class="text-sm font-medium truncate">{{ name }}</span>
                <span class="badge badge-xs badge-ghost">
                  {{ partyRosters[name]?.length ?? 0 }}
                </span>
                <Icon
                  icon="tabler:chevron-right"
                  height="16"
                  class="ml-auto text-base-content/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-circle"
                :title="t.party.rename"
                @click="handleRename(name)"
              >
                <Icon icon="tabler:edit" height="14" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-circle text-error"
                :title="t.party.delete"
                @click="handleDelete(name)"
              >
                <Icon icon="tabler:trash" height="14" />
              </button>
            </div>
          </div>
          <div v-else class="text-sm text-base-content/40 italic">{{ t.party.noParties }}</div>
        </div>

        <!-- Active party members -->
        <div
          v-if="activePartyName"
          class="border border-base-content/10 rounded-lg p-3 bg-base-100"
        >
          <div class="text-sm font-semibold mb-2 flex items-center gap-2">
            <Icon icon="tabler:users" height="16" />
            {{ activePartyName }}
            <span class="badge badge-xs badge-accent">{{ t.party.activeParty }}</span>
          </div>
          <div v-if="activeRoster.length" class="flex flex-col gap-1">
            <div
              v-for="member in activeRoster"
              :key="member.name"
              class="flex items-center justify-between gap-2 p-2 rounded bg-base-200/50"
            >
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ member.name }}</div>
                <div class="text-xs text-base-content/60 flex gap-2">
                  <span v-if="member.level !== undefined"
                    >{{ t.statBlock.level }} {{ member.level }}</span
                  >
                  <span>HP {{ member.totalHP }}</span>
                  <span v-if="member.ac !== undefined">{{ t.statBlock.ac }} {{ member.ac }}</span>
                </div>
              </div>
              <button
                class="btn btn-ghost btn-xs btn-circle text-error"
                @click="$emit('removeFromRoster', member.name)"
              >
                <Icon icon="tabler:trash" height="16" />
              </button>
            </div>
          </div>
          <div v-else class="text-sm text-base-content/40 italic">{{ t.party.empty }}</div>
        </div>

        <!-- Adventure Modules -->
        <div class="border border-base-content/10 rounded-lg p-3 bg-base-100">
          <button
            class="flex items-center gap-2 text-sm font-semibold w-full"
            @click="isModulesOpen = !isModulesOpen"
          >
            <Icon
              :icon="isModulesOpen ? 'tabler:chevron-down' : 'tabler:chevron-right'"
              height="18"
            />
            <Icon icon="tabler:book" height="18" />
            {{ t.party.modules }}
          </button>

          <div v-if="isModulesOpen" class="mt-3 flex flex-col gap-3">
            <select
              v-model="selectedModuleId"
              class="select select-sm"
            >
              <option value="" disabled>{{ t.party.selectModule }}</option>
              <option v-for="mod in modules" :key="mod.id" :value="mod.id">
                {{ mod.name }}
              </option>
            </select>

            <div v-if="selectedModule?.description" class="text-xs text-base-content/60">
              {{ selectedModule.description }}
            </div>

            <div v-if="selectedModule && selectedModule.encounters.length" class="flex flex-col gap-2">
              <div
                v-for="group in encounterGroups"
                :key="group.act"
                class="flex flex-col gap-1"
              >
                <div
                  v-if="group.act"
                  class="text-xs font-semibold text-base-content/50 uppercase tracking-wide"
                >
                  {{ group.act }}
                </div>
                <div
                  v-for="enc in group.encounters"
                  :key="enc.id"
                  class="flex items-start justify-between gap-2 p-2 rounded bg-base-200/50"
                >
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm truncate">{{ enc.name }}</div>
                    <div v-if="enc.description" class="text-xs text-base-content/60">
                      {{ enc.description }}
                    </div>
                    <div class="text-xs text-base-content/40 mt-0.5">
                      <span
                        v-for="(m, mi) in enc.monsters"
                        :key="m.name"
                      >{{ mi > 0 ? ', ' : '' }}{{ m.name }}<span v-if="m.quantity > 1"> x{{ m.quantity }}</span></span>
                    </div>
                  </div>
                  <button
                    v-if="addedEncounterIds.has(enc.id)"
                    class="btn btn-ghost btn-xs btn-circle"
                    :title="t.party.encounterAdded"
                    disabled
                  >
                    <Icon icon="tabler:check" height="16" class="text-success" />
                  </button>
                  <button
                    v-else
                    class="btn btn-accent btn-xs shrink-0"
                    @click="handleLoadEncounter(enc)"
                  >
                    <Icon icon="tabler:plus" height="14" />{{ t.party.addEncounter }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else-if="selectedModule" class="text-sm text-base-content/40 italic">
              {{ t.party.noEncounters }}
            </div>
          </div>
        </div>

        <!-- Add PC manually -->
        <div class="border border-base-content/10 rounded-lg p-3 bg-base-100">
          <button
            class="flex items-center gap-2 text-sm font-semibold w-full"
            @click="isAddPcOpen = !isAddPcOpen"
          >
            <Icon
              :icon="isAddPcOpen ? 'tabler:chevron-down' : 'tabler:chevron-right'"
              height="18"
            />
            {{ t.party.addPcFull }}
          </button>

          <div v-if="isAddPcOpen" class="mt-3 flex flex-col gap-3">
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcName" class="text-xs">{{ t.table.name }}</Label>
              <input
                id="pcName"
                v-model="newPcName"
                type="text"
                class="input input-sm col-span-2 h-8"
              />
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcLevel" class="text-xs">{{ t.statBlock.level }}</Label>
              <NumberFieldRoot v-model="newPcLevel" :min="1" class="col-span-2">
                <NumberFieldInput id="pcLevel" class="input input-sm h-8" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcHP" class="text-xs">{{ t.table.hp }}</Label>
              <NumberFieldRoot v-model="newPcHP" :min="1" class="col-span-2">
                <NumberFieldInput id="pcHP" class="input input-sm h-8" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcInit" class="text-xs">{{ t.table.initiative }}</Label>
              <NumberFieldRoot v-model="newPcInitiative" :min="1" class="col-span-2">
                <NumberFieldInput id="pcInit" class="input input-sm h-8" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcAC" class="text-xs">{{ t.statBlock.ac }}</Label>
              <NumberFieldRoot v-model="newPcAC" :min="1" class="col-span-2">
                <NumberFieldInput id="pcAC" class="input input-sm h-8" placeholder="—" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcPerc" class="text-xs">{{ t.statBlock.perception }}</Label>
              <NumberFieldRoot v-model="newPcPerception" class="col-span-2">
                <NumberFieldInput id="pcPerc" class="input input-sm h-8" placeholder="—" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcFort" class="text-xs">{{ t.statBlock.fortitude }}</Label>
              <NumberFieldRoot v-model="newPcFortitude" class="col-span-2">
                <NumberFieldInput id="pcFort" class="input input-sm h-8" placeholder="—" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcRef" class="text-xs">{{ t.statBlock.reflex }}</Label>
              <NumberFieldRoot v-model="newPcReflex" class="col-span-2">
                <NumberFieldInput id="pcRef" class="input input-sm h-8" placeholder="—" />
              </NumberFieldRoot>
            </div>
            <div class="grid grid-cols-3 items-center gap-2">
              <Label for="pcWill" class="text-xs">{{ t.statBlock.will }}</Label>
              <NumberFieldRoot v-model="newPcWill" class="col-span-2">
                <NumberFieldInput id="pcWill" class="input input-sm h-8" placeholder="—" />
              </NumberFieldRoot>
            </div>
            <button class="btn btn-accent btn-sm" :disabled="!newPcName" @click="addPc">
              <Icon icon="tabler:plus" height="18" />{{ t.party.addPc }}
            </button>
          </div>
        </div>

        <!-- Pathbuilder import -->
        <div class="border border-base-content/10 rounded-lg p-3 bg-base-100">
          <button
            class="flex items-center gap-2 text-sm font-semibold w-full"
            @click="isImportOpen = !isImportOpen"
          >
            <Icon
              :icon="isImportOpen ? 'tabler:chevron-down' : 'tabler:chevron-right'"
              height="18"
            />
            {{ t.party.importPathbuilder }}
          </button>

          <div v-if="isImportOpen" class="mt-3 flex flex-col gap-2">
            <p class="text-xs text-base-content/60">{{ t.party.importHint }}</p>
            <textarea
              v-model="importText"
              class="textarea textarea-sm h-32"
              :placeholder="t.party.pasteJson"
            ></textarea>
            <div class="flex gap-2">
              <button class="btn btn-accent btn-sm flex-1" @click="handleImport">
                <Icon icon="tabler:file-import" height="18" />{{ t.party.parse }}
              </button>
              <button class="btn btn-neutral btn-sm" @click="fileInput?.click()">
                <Icon icon="tabler:upload" height="18" />
              </button>
              <input
                ref="fileInput"
                type="file"
                accept=".json,application/json"
                class="hidden"
                @change="handleFileUpload"
              />
            </div>
            <div v-if="importError" class="alert alert-error alert-sm text-xs py-2">
              <Icon icon="tabler:alert-circle" height="16" />
              {{ importError }}
            </div>
            <div v-if="importSuccess" class="alert alert-success alert-sm text-xs py-2">
              <Icon icon="tabler:circle-check" height="16" />
              {{ t.party.parseSuccess }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped></style>
