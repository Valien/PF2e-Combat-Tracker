<script setup lang="ts">
import CombatantCard from './CombatantCard.vue'
import InitiativeStrip from './InitiativeStrip.vue'
import { Icon } from '@iconify/vue'
import { useTranslations } from './lang.ts'
import { Combatant } from './functions.ts'

const { t } = useTranslations()

defineProps<{
  turn: number
  round: number
  combatants: Combatant[]
}>()
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <div class="badge badge-lg badge-neutral gap-1 px-3 py-4">
        <Icon icon="tabler:swords" height="18" />
        <span class="font-bold">{{ t.table.round }} {{ round }}</span>
      </div>
    </div>

    <InitiativeStrip :combatants="combatants" :turn="turn" is-read-only />

    <div v-if="combatants.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <CombatantCard
        v-for="(combatant, i) in combatants"
        :key="`${combatant.name}-${i}`"
        :combatant="combatant"
        :is-active="i === turn"
        is-read-only
      />
    </div>
    <div v-else class="flex flex-col items-center justify-center py-20 text-base-content/30">
      <Icon icon="tabler:swords" height="80" />
      <p class="mt-4 text-lg">{{ t.card.noParty }}</p>
    </div>
  </div>
</template>
