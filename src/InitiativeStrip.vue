<script setup lang="ts">
import { Combatant, Visibility } from './functions.ts'
import { useTranslations } from './lang.ts'

const { t } = useTranslations()

defineProps<{
  combatants: Combatant[]
  turn: number
  isReadOnly?: boolean
}>()
</script>

<template>
  <div
    class="flex items-center gap-2 overflow-x-auto pb-2 px-1 sticky top-0 z-10 bg-base-200/95 backdrop-blur rounded-lg"
  >
    <div class="flex items-center gap-1 whitespace-nowrap">
      <span class="text-sm font-semibold text-base-content/60 px-2">{{ t.table.round }}</span>
      <template v-for="(combatant, i) in combatants" :key="i">
        <div
          v-if="isReadOnly ? combatant.visibility !== Visibility.None : true"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-default',
            {
              'bg-accent text-accent-content shadow-md scale-105': i === turn,
              'bg-base-300': i !== turn,
              'opacity-50': combatant.visibility === Visibility.None && !isReadOnly,
            },
          ]"
        >
          <!-- Initiative number -->
          <span class="font-bold text-sm">{{ combatant.initiative }}</span>
          <span class="text-sm truncate max-w-32" :title="combatant.name">{{
            combatant.name
          }}</span>
          <!-- HP chip (only for Full visibility or DM view) -->
          <span
            v-if="!isReadOnly || combatant.visibility === Visibility.Full"
            :class="[
              'badge badge-xs font-mono',
              combatant.currentHP <= 0 ? 'badge-error' : 'badge-ghost',
            ]"
          >
            {{ combatant.currentHP }}
          </span>
          <span v-else class="badge badge-xs badge-ghost">?</span>
        </div>
        <!-- Arrow between combatants -->
        <Icon
          v-if="i < combatants.length - 1"
          icon="tabler:chevron-right"
          height="14"
          class="text-base-content/30 shrink-0"
        />
      </template>
    </div>
  </div>
</template>
