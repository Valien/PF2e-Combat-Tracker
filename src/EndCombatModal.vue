<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Combatant } from './functions.ts'
import { Icon } from '@iconify/vue'
import { useTranslations } from './lang.ts'
import { usePartyLevel } from './composables/useSettings'
import { computeMonsterXP } from './xp.ts'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  NumberFieldInput,
  NumberFieldRoot,
} from 'reka-ui'

const { t } = useTranslations()
const partyLevel = usePartyLevel()

const props = defineProps<{
  isOpen: boolean
  combatants: Combatant[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'endCombat'): void
}>()

// Track which monsters the DM marks as defeated. Auto-tick on open for
// monsters at HP <= 0 (the common case); DM can override by ticking
// monsters that were killed and removed earlier in the encounter, or
// unticking ones that survived.
const defeatedIds = ref<Set<string>>(new Set())

// Recompute the defaults whenever the modal opens. Using a watcher on isOpen
// rather than a computed so the DM's manual checkbox changes don't get reset
// on every re-render — only on open.
function syncDefaultsOnOpen() {
  const next = new Set<string>()
  for (const c of props.combatants) {
    if (c.type === 'monster' && c.currentHP <= 0) next.add(c.name)
  }
  defeatedIds.value = next
}

// Vue 3 reactivity: defineProps are reactive, but we still want to react to
// isOpen transitions specifically. A simple watch on the prop suffices.
watch(
  () => props.isOpen,
  (open) => {
    if (open) syncDefaultsOnOpen()
  },
  { immediate: true },
)

const monsterRows = computed(() => props.combatants.filter((c) => c.type === 'monster'))

function toggleDefeated(name: string) {
  const next = new Set(defeatedIds.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  defeatedIds.value = next
}

const totalXP = computed(() =>
  monsterRows.value.reduce(
    (sum, m) =>
      defeatedIds.value.has(m.name) ? sum + computeMonsterXP(m.level, partyLevel.value) : sum,
    0,
  ),
)

// PF2e encounter severity by total XP (for 4-PC party):
//   <40 trivial / 80 low / 120 moderate / 160 severe / 200 extreme
function severity(xp: number): string {
  if (xp <= 0) return ''
  if (xp < 80) return t.value.endCombat.severityTrivial
  if (xp < 120) return t.value.endCombat.severityLow
  if (xp < 160) return t.value.endCombat.severityModerate
  if (xp < 200) return t.value.endCombat.severitySevere
  return t.value.endCombat.severityExtreme
}

function confirmEndCombat() {
  emit('endCombat')
  emit('close')
}
</script>

<template>
  <AlertDialogRoot :open="isOpen" @update:open="(v) => !v && emit('close')">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 bg-black/50 z-[9998]" />
      <AlertDialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[640px] max-w-[90vw] max-h-[90vh]"
      >
        <div class="card bg-base-100 shadow-xl h-full flex flex-col">
          <div class="card-body overflow-y-auto p-5">
            <AlertDialogTitle class="card-title text-warning flex items-center gap-2">
              <Icon icon="tabler:flag-3-filled" height="26" />
              {{ t.endCombat.title }}
            </AlertDialogTitle>
            <AlertDialogDescription>{{ t.endCombat.description }}</AlertDialogDescription>

            <!-- Party Level input -->
            <div class="flex items-center gap-3 mt-3">
              <label for="partyLevelInput" class="text-sm font-semibold flex items-center gap-1">
                <Icon icon="tabler:users" height="18" />
                {{ t.endCombat.partyLevel }}
              </label>
              <NumberFieldRoot v-model="partyLevel" :min="1" class="w-24">
                <NumberFieldInput id="partyLevelInput" class="input input-sm" />
              </NumberFieldRoot>
              <span class="text-xs text-base-content/60">{{ t.endCombat.partyLevelHint }}</span>
            </div>

            <!-- Monsters list -->
            <div v-if="monsterRows.length" class="mt-4">
              <div class="text-sm font-semibold mb-2">{{ t.endCombat.defeated }}</div>
              <div class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th class="w-10"></th>
                      <th>{{ t.table.name }}</th>
                      <th class="text-right">{{ t.statBlock.level }}</th>
                      <th class="text-right">{{ t.table.hp }}</th>
                      <th class="text-right">{{ t.endCombat.xp }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="m in monsterRows"
                      :key="m.name"
                      :class="{ 'opacity-50': m.currentHP <= 0 }"
                    >
                      <td>
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-warning"
                          :checked="defeatedIds.has(m.name)"
                          @change="toggleDefeated(m.name)"
                        />
                      </td>
                      <td class="truncate max-w-48" :title="m.name">{{ m.name }}</td>
                      <td class="text-right font-mono">
                        {{ m.level !== undefined ? m.level : '—' }}
                      </td>
                      <td class="text-right font-mono" :class="{ 'text-error': m.currentHP <= 0 }">
                        {{ m.currentHP }}/{{ m.totalHP }}
                      </td>
                      <td class="text-right font-mono">
                        <span v-if="defeatedIds.has(m.name)" class="badge badge-sm badge-success">
                          {{ computeMonsterXP(m.level, partyLevel) }}
                        </span>
                        <span v-else class="text-base-content/40">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="mt-4 flex items-center gap-2 text-base-content/60">
              <Icon icon="tabler:mood-empty" height="20" />
              <span class="text-sm">{{ t.endCombat.noMonsters }}</span>
            </div>

            <!-- Total XP -->
            <div class="flex items-center gap-2 mt-4 p-3 rounded-lg bg-base-200">
              <Icon icon="tabler:award" height="24" class="text-warning" />
              <span class="font-bold text-lg">{{ t.endCombat.totalXp }}</span>
              <span class="font-mono text-2xl text-success">{{ totalXP }}</span>
              <span v-if="severity(totalXP)" class="badge badge-sm badge-info ml-2">
                {{ severity(totalXP) }}
              </span>
            </div>

            <div class="card-actions justify-end mt-4 gap-2">
              <button class="btn btn-ghost" @click="emit('close')">
                <Icon icon="tabler:x" height="20" />{{ t.endCombat.close }}
              </button>
              <button
                class="btn btn-warning"
                :disabled="!combatants.length"
                @click="confirmEndCombat"
              >
                <Icon icon="tabler:flag" height="20" />{{ t.endCombat.newEncounter }}
              </button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped></style>
