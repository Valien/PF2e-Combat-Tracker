<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import CombatantCard from './CombatantCard.vue'
import InitiativeStrip from './InitiativeStrip.vue'
import EndCombatModal from './EndCombatModal.vue'
import PartyManager from './PartyManager.vue'
import Settings from './Settings.vue'
import { Combatant, Visibility } from './functions.ts'
import { Icon } from '@iconify/vue'
import { useTranslations } from './lang.ts'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  Label,
  NumberFieldInput,
  NumberFieldRoot,
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { getEnabledMonsters, useConditions, type Monster } from './db.ts'
import { useEnabledContentSources } from './composables/useSettings'
import type { ModuleEncounter } from './modules.ts'

const { t, lang } = useTranslations()
const conditions = computed(() => useConditions(lang.value))

const emit = defineEmits<{
  (e: 'nextTurn'): void
  (e: 'prevTurn'): void
  (e: 'reset'): void
  (e: 'resetToDefaults'): void
  (
    e: 'newCombatant',
    name: string,
    HP: number,
    initiative: number,
    visibility: Visibility,
    extras?: Record<string, unknown>,
  ): void
  (e: 'removeCombatant', index: number): void
  (e: 'toggleOnlineMode', value: boolean): void
  (e: 'saveParty'): void
  (e: 'savePartyAs', name: string): void
  (e: 'loadParty'): void
  (e: 'loadPartyByName', name: string): void
  (e: 'renameParty', oldName: string, newName: string): void
  (e: 'deleteParty', name: string): void
  (e: 'endCombat'): void
  (e: 'newPc', name: string, HP: number, initiative: number, extras?: Record<string, unknown>): void
  (e: 'removeFromRoster', name: string): void
  (e: 'loadEncounter', encounter: ModuleEncounter): void
}>()

const props = defineProps<{
  turn: number
  round: number
  combatants: Combatant[]
  isOnlineMode: boolean
  sessionId: string
  partyRosters: Record<string, any[]>
  activePartyName: string
}>()

const showCopiedMessage = ref(false)
const showResetConfirm = ref(false)
const showEndCombatModal = ref(false)
const isSettingsOpen = ref(false)

const newName = ref('')
const newHP = ref(1)
const newInitiative = ref(1)
const newVisibility = ref(Visibility.Half)
const newQuantity = ref(1)
const isNewCombatantPopoverOpen = ref(false)

const enabledContentSources = useEnabledContentSources()
const monsterList = computed<Monster[]>(() => getEnabledMonsters(enabledContentSources.value))

// Scroll the active card into view when the turn changes so the DM doesn't
// have to manually scroll through a long combatant list.
const cardGrid = ref<HTMLElement>()
watch(
  () => props.turn,
  async () => {
    await nextTick()
    cardGrid.value?.querySelector('[data-active="true"]')?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  },
)

watch(newName, (selectedName) => {
  const monster = monsterList.value.find((m) => m.name === selectedName)
  if (monster && monster.hp > 1) {
    newHP.value = monster.hp
  }
})

function changeNewVisibility(): void {
  newVisibility.value++
  if (newVisibility.value > 2) newVisibility.value = 0
}

function clearNewCombatant(): void {
  newName.value = ''
  newHP.value = 1
  newInitiative.value = 1
  newVisibility.value = Visibility.Half
  newQuantity.value = 1
  document.getElementById('newName')?.focus()
}

function getCombatantName(i: number): string {
  if (i == 0 && newQuantity.value == 1) return newName.value
  switch (i) {
    case 0:
      return `${newName.value} (${t.value.colors.red})`
    case 1:
      return `${newName.value} (${t.value.colors.green})`
    case 2:
      return `${newName.value} (${t.value.colors.blue})`
    case 3:
      return `${newName.value} (${t.value.colors.purple})`
    case 4:
      return `${newName.value} (${t.value.colors.pink})`
    case 5:
      return `${newName.value} (${t.value.colors.brown})`
    default:
      return `${newName.value} (${i})`
  }
}

function addCombatant(): void {
  const monster = monsterList.value.find((m) => m.name === newName.value)
  for (let i = 0; i < newQuantity.value; i++) {
    const extras = monster
      ? {
          type: 'monster' as const,
          level: monster.level,
          ac: monster.ac,
          perception: monster.perception,
          fortitude: monster.fortitude,
          reflex: monster.reflex,
          will: monster.will,
          speed: monster.speed,
          resistances: monster.resistances,
          weaknesses: monster.weaknesses,
          immunities: monster.immunities,
          traits: monster.traits,
          family: monster.family,
          source: monster.source,
          attacks: monster.attacks,
          abilities: monster.abilities,
          aonUrl: monster.url,
        }
      : {
          // No bestiary match → DM-created NPC (per functions.ts docstring:
          // "DM-created creatures without a bestiary entry")
          type: 'npc' as const,
        }
    emit(
      'newCombatant',
      getCombatantName(i),
      newHP.value,
      newInitiative.value,
      newVisibility.value,
      extras,
    )
  }
  isNewCombatantPopoverOpen.value = false
  setTimeout(clearNewCombatant, 1)
}

function removeCombatant(index: number): void {
  emit('removeCombatant', index)
}

function requestReset() {
  showResetConfirm.value = true
}
function cancelReset() {
  showResetConfirm.value = false
}
function confirmReset() {
  showResetConfirm.value = false
  emit('resetToDefaults')
}
function confirmClearAll() {
  showResetConfirm.value = false
  emit('reset')
}

async function copyPlayerUrl(): Promise<void> {
  if (!props.sessionId) return
  const url = new URL(window.location.href)
  url.searchParams.set('session', props.sessionId)
  url.searchParams.set('view', 'player')
  try {
    await navigator.clipboard.writeText(url.toString())
    showCopiedMessage.value = true
    setTimeout(() => {
      showCopiedMessage.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy URL:', err)
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Initiative Strip -->
    <InitiativeStrip
      :combatants="combatants"
      :turn="turn"
      show-nav
      @prev="$emit('prevTurn')"
      @next="$emit('nextTurn')"
    />

    <!-- Action Bar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="badge badge-lg badge-neutral gap-1 px-3 py-4">
        <Icon icon="tabler:swords" height="18" />
        <span class="font-bold">{{ t.table.round }} {{ round }}</span>
      </div>

      <button class="btn btn-primary btn-sm" @click="$emit('nextTurn')">
        <Icon icon="tabler:player-skip-forward" height="18" />{{ t.dm_actions.next }}
      </button>

      <button class="btn btn-error btn-sm" @click="requestReset">
        <Icon icon="tabler:refresh" height="18" />{{ t.dm_actions.reset }}
      </button>

      <button
        class="btn btn-warning btn-sm"
        :disabled="!combatants.length"
        @click="showEndCombatModal = true"
      >
        <Icon icon="tabler:flag" height="18" />{{ t.endCombat.title }}
      </button>

      <!-- Add Monster/NPC Popover -->
      <PopoverRoot
        :open="isNewCombatantPopoverOpen"
        @update:open="(v) => (isNewCombatantPopoverOpen = v)"
      >
        <PopoverTrigger as-child>
          <button class="btn btn-accent btn-sm">
            <Icon icon="tabler:plus" height="18" />{{ t.dm_actions.addMonster }}
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent class="card w-96 bg-base-300 card-md shadow-xl z-50" role="dialog">
            <form class="card-body" @submit.prevent="addCombatant">
              <div class="grid grid-cols-3 items-center gap-3">
                <Label for="newName" class="text-sm">{{ t.table.name }}</Label>
                <input
                  id="newName"
                  v-model="newName"
                  tabindex="1"
                  type="text"
                  class="input input-sm col-span-2"
                  list="monsters"
                />
                <datalist id="monsters">
                  <option
                    v-for="monster in monsterList"
                    :key="monster.name"
                    :value="monster.name"
                  />
                </datalist>
              </div>
              <div class="grid grid-cols-3 items-center gap-3">
                <Label for="newHP" class="text-sm">{{ t.table.hp }}</Label>
                <NumberFieldRoot v-model="newHP" :min="1" class="col-span-2">
                  <NumberFieldInput id="newHP" tabindex="2" class="input input-sm" />
                </NumberFieldRoot>
              </div>
              <div class="grid grid-cols-3 items-center gap-3">
                <Label for="newInitiative" class="text-sm">{{ t.table.initiative }}</Label>
                <NumberFieldRoot v-model="newInitiative" :min="1" class="col-span-2">
                  <NumberFieldInput id="newInitiative" tabindex="3" class="input input-sm" />
                </NumberFieldRoot>
              </div>
              <div class="grid grid-cols-3 items-center gap-3">
                <Label for="newQuantity" class="text-sm">{{ t.dm_actions.quantity }}</Label>
                <NumberFieldRoot v-model="newQuantity" :min="1" class="col-span-2">
                  <NumberFieldInput id="newQuantity" tabindex="4" class="input input-sm" />
                </NumberFieldRoot>
              </div>
              <div class="flex justify-end gap-2">
                <button type="button" tabindex="-1" class="btn btn-ghost btn-sm" @click="changeNewVisibility">
                  <Icon v-if="newVisibility === Visibility.Full" icon="tabler:eye" height="18" />
                  <Icon
                    v-else-if="newVisibility === Visibility.Half"
                    icon="tabler:eye-off"
                    height="18"
                  />
                  <Icon v-else icon="tabler:eye-closed" height="18" />
                </button>
                <button type="button" tabindex="-1" class="btn btn-ghost btn-sm" @click="clearNewCombatant">
                  <Icon icon="tabler:eraser" height="18" />{{ t.dm_actions.clear }}
                </button>
                <button type="submit" tabindex="5" class="btn btn-accent btn-sm">
                  <Icon icon="tabler:plus" height="18" />{{ t.dm_actions.add }}
                </button>
              </div>
            </form>
            <PopoverArrow class="fill-base-300" />
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <div class="ml-auto flex gap-2">
        <PartyManager
          :combatants="combatants"
          :party-rosters="partyRosters"
          :active-party-name="activePartyName"
          @new-pc="
            (name: string, hp: number, init: number, extras?: Record<string, unknown>) =>
              $emit('newPc', name, hp, init, extras)
          "
          @save-party="$emit('saveParty')"
          @save-party-as="(name: string) => $emit('savePartyAs', name)"
          @load-party="$emit('loadParty')"
          @load-party-by-name="(name: string) => $emit('loadPartyByName', name)"
          @rename-party="(oldName: string, newName: string) => $emit('renameParty', oldName, newName)"
          @delete-party="(name: string) => $emit('deleteParty', name)"
          @remove-from-roster="(name: string) => $emit('removeFromRoster', name)"
          @load-encounter="(encounter: ModuleEncounter) => $emit('loadEncounter', encounter)"
        >
          <template #trigger="{ open }">
            <button class="btn btn-neutral btn-sm" @click="open">
              <Icon icon="tabler:users" height="18" />{{ t.party.title }}
            </button>
          </template>
        </PartyManager>

        <a v-if="!isOnlineMode" class="btn btn-neutral btn-sm" href="?view=player">
          <Icon icon="tabler:users-group" height="18" />{{ t.dm_actions.playerView }}
        </a>
        <button v-else class="btn btn-neutral btn-sm relative" @click="copyPlayerUrl">
          <Icon icon="tabler:users-group" height="18" />{{ t.dm_actions.copyPlayerUrl }}
          <div
            v-if="showCopiedMessage"
            class="absolute -top-8 left-1/2 -translate-x-1/2 badge badge-success badge-sm"
          >
            {{ t.dm_actions.copiedToClipboard }}
          </div>
        </button>

        <button class="btn btn-neutral btn-sm" @click="isSettingsOpen = true">
          <Icon icon="tabler:settings" height="18" />{{ t.options.settings }}
        </button>
      </div>
    </div>

    <!-- Card Grid -->
    <div
      v-if="combatants.length"
      ref="cardGrid"
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
    >
      <CombatantCard
        v-for="(combatant, i) in combatants"
        :key="`${combatant.name}-${i}`"
        :combatant="combatant"
        :is-active="i === turn"
        :data-active="i === turn ? 'true' : 'false'"
        @remove="removeCombatant(i)"
      />
    </div>
    <div v-else class="flex flex-col items-center justify-center py-20 text-base-content/30">
      <Icon icon="tabler:swords" height="80" />
      <p class="mt-4 text-lg">{{ t.card.noParty }}</p>
    </div>

    <!-- Condition datalist (shared by all cards) -->
    <datalist id="conditions">
      <option v-for="(condition, key) in conditions" :key="key" :value="condition.name" />
    </datalist>

    <!-- Reset Confirmation Dialog -->
    <AlertDialogRoot :open="showResetConfirm" @update:open="(v) => (showResetConfirm = v)">
      <AlertDialogPortal>
        <AlertDialogOverlay class="fixed inset-0 bg-black/50 z-[9998]" />
        <AlertDialogContent
          class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-96 max-w-[90vw]"
        >
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <AlertDialogTitle class="card-title text-error flex items-center gap-2">
                <Icon icon="tabler:alert-triangle" height="24" />
                {{ t.dm_actions.reset }}
              </AlertDialogTitle>
              <AlertDialogDescription>{{ t.options.resetConfirmMessage }}</AlertDialogDescription>
              <div class="card-actions justify-end mt-4 gap-2">
                <button class="btn btn-ghost" @click="cancelReset">
                  {{ t.options.resetConfirmNo }}
                </button>
                <button class="btn btn-warning" @click="confirmClearAll">
                  <Icon icon="tabler:trash" height="20" />{{ t.options.clearAll }}
                </button>
                <button class="btn btn-error" @click="confirmReset">
                  <Icon icon="tabler:refresh" height="20" />{{ t.options.resetConfirmYes }}
                </button>
              </div>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>

    <!-- Settings Modal -->
    <Settings
      :is-online-mode="isOnlineMode"
      :session-id="sessionId"
      :is-d-m-view="true"
      :is-open="isSettingsOpen"
      @toggle-online-mode="(v) => $emit('toggleOnlineMode', v)"
      @request-reset="requestReset"
      @close="isSettingsOpen = false"
    />

    <!-- End Combat / XP Summary Modal -->
    <EndCombatModal
      :is-open="showEndCombatModal"
      :combatants="combatants"
      @close="showEndCombatModal = false"
      @end-combat="$emit('endCombat')"
    />

  </div>
</template>

<style scoped></style>
