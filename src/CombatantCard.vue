<script setup lang="ts">
import { ref, computed } from 'vue'
import { Combatant, Visibility, colorIsDark } from './functions.ts'
import { Icon } from '@iconify/vue'
import { useTranslations } from './lang.ts'
import { useTempHP } from './composables/useSettings'
import { useConditions } from './db.ts'
import {
  Label,
  NumberFieldRoot,
  NumberFieldInput,
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  PopoverArrow,
} from 'reka-ui'

const { t, lang } = useTranslations()
const tempHPEnabled = useTempHP()
// Per-card HP delta input. Previously this was a module-singleton ref in
// useSettings, which caused editing it on one card to update every card.
// Local ref = each card tracks its own damage/heal amount independently.
const hpValue = ref(5)
const conditions = computed(() => useConditions(lang.value))

const props = withDefaults(
  defineProps<{
    combatant: Combatant
    isActive: boolean
    isReadOnly?: boolean
  }>(),
  { isReadOnly: false },
)

const emit = defineEmits<{
  (e: 'remove'): void
}>()

const isConditionPopoverOpen = ref(false)
const newConditionName = ref('')
const newConditionValue = ref(1)

const hpRatio = computed(() => {
  if (props.combatant.totalHP <= 0) return 0
  return (props.combatant.currentHP / props.combatant.totalHP) * 100
})

const hpColor = computed(() => {
  if (hpRatio.value >= 66) return 'progress-success'
  if (hpRatio.value >= 33) return 'progress-warning'
  return 'progress-error'
})

const playerHpValue = computed(() => {
  if (props.isReadOnly && props.combatant.visibility !== Visibility.Full) return 0
  return props.combatant.currentHP
})

function addCondition() {
  const condition =
    conditions.value[
      Object.keys(conditions.value).find(
        (key) => conditions.value[key].name.toLowerCase() === newConditionName.value.toLowerCase(),
      ) as string
    ]
  props.combatant.newCondition(newConditionName.value, newConditionValue.value, null, {
    description: condition?.description,
  })
  isConditionPopoverOpen.value = false
  setTimeout(clearCondition, 1)
}

function clearCondition() {
  newConditionName.value = ''
  newConditionValue.value = 1
}

// Set the combatant's used-action count to `target` by repeatedly calling
// useAction/unuseAction (which clamp internally). Lets the DM click any pip
// to jump to that count, or right-click to clear down to the previous pip.
function setActions(target: number) {
  while (props.combatant.actionsUsed < target) props.combatant.useAction()
  while (props.combatant.actionsUsed > target) props.combatant.unuseAction()
}

function getConditionTooltip(conditionName: string): string {
  const found = Object.values(conditions.value).find(
    (c) => c.name.toLowerCase() === conditionName.toLowerCase(),
  )
  return found?.description || ''
}

const currentTooltip = ref('')
const currentTooltipName = ref('')

function showTooltip(conditionName: string) {
  currentTooltipName.value = conditionName
  currentTooltip.value = getConditionTooltip(conditionName)
}

function closeTooltip() {
  currentTooltip.value = ''
  currentTooltipName.value = ''
}

const typeBadge = computed(() => {
  switch (props.combatant.type) {
    case 'monster':
      return t.value.card.monster
    case 'npc':
      return t.value.card.npc
    default:
      return t.value.card.pc
  }
})

const typeBadgeClass = computed(() => {
  switch (props.combatant.type) {
    case 'monster':
      return 'badge-error'
    case 'npc':
      return 'badge-warning'
    default:
      return 'badge-primary'
  }
})

const hasStatBlock = computed(
  () =>
    props.combatant.ac !== undefined ||
    props.combatant.level !== undefined ||
    props.combatant.attacks?.length ||
    props.combatant.abilities?.length,
)
</script>

<template>
  <div
    :class="[
      'card bg-base-100 shadow-md transition-all duration-200',
      {
        'ring-2 ring-accent shadow-accent/30': isActive,
        'opacity-60': combatant.visibility === Visibility.None,
      },
    ]"
  >
    <div class="card-body p-4 gap-2">
      <!-- Header: Name, Type, Init, Visibility controls -->
      <div class="flex items-center gap-2">
        <span :class="['badge badge-sm shrink-0', typeBadgeClass]">{{ typeBadge }}</span>

        <input
          v-if="!isReadOnly"
          :value="combatant.initiative"
          type="number"
          class="input input-sm w-14 text-center font-bold"
          :aria-label="t.table.initiative"
          @change="combatant.setInitiative(Number(($event.target as HTMLInputElement).value))"
        />
        <span v-else class="font-bold text-lg shrink-0">{{ combatant.initiative }}</span>

        <h3 class="card-title flex-1 text-base truncate" :title="combatant.name">
          {{ combatant.name }}
        </h3>

        <!-- Visibility toggle (DM only) -->
        <button
          v-if="!isReadOnly"
          class="btn btn-ghost btn-xs"
          @click.left="combatant.changeVisibility(false)"
          @click.right.prevent="combatant.changeVisibility(true)"
        >
          <Icon v-if="combatant.visibility === Visibility.Full" icon="tabler:eye" height="18" />
          <Icon
            v-else-if="combatant.visibility === Visibility.Half"
            icon="tabler:eye-off"
            height="18"
          />
          <Icon v-else icon="tabler:eye-closed" height="18" />
        </button>

        <!-- Delete (DM only) -->
        <button v-if="!isReadOnly" class="btn btn-ghost btn-xs text-error" @click="emit('remove')">
          <Icon icon="tabler:trash" height="18" />
        </button>
      </div>

      <!-- HP Section -->
      <div class="space-y-1">
        <!-- Temp HP bar -->
        <progress
          v-if="tempHPEnabled && combatant.maxTempHP > 0"
          class="progress progress-info h-2 w-full"
          :value="combatant.tempHP"
          :max="combatant.maxTempHP"
        />
        <!-- Main HP bar -->
        <div class="flex items-center gap-2">
          <progress
            class="progress h-3 flex-1"
            :class="hpColor"
            :value="playerHpValue"
            :max="combatant.totalHP"
          />
          <span class="text-sm font-mono whitespace-nowrap">
            {{
              isReadOnly && combatant.visibility !== Visibility.Full
                ? '???'
                : `${combatant.currentHP}/${combatant.totalHP}`
            }}
            <span
              v-if="
                tempHPEnabled && combatant.maxTempHP > 0 && combatant.visibility === Visibility.Full
              "
              class="text-info"
            >
              +{{ combatant.tempHP }}
            </span>
          </span>
        </div>

        <!-- HP Controls (DM only) -->
        <div v-if="!isReadOnly" class="flex items-center gap-1">
          <input
            v-model="hpValue"
            type="number"
            class="input input-xs w-12 text-center"
            :aria-label="t.table.hp"
          />
          <button class="btn btn-error btn-xs flex-1" @click="combatant.changeHP(-hpValue)">
            <Icon icon="tabler:minus" height="16" />
          </button>
          <button
            class="btn btn-soft btn-info btn-xs px-2 font-mono"
            @click.left="combatant.healToMax()"
            @click.right.prevent="combatant.setMaxHP(hpValue)"
          >
            {{ combatant.currentHP }}/{{ combatant.totalHP }}
          </button>
          <button class="btn btn-success btn-xs flex-1" @click="combatant.changeHP(hpValue)">
            <Icon icon="tabler:plus" height="16" />
          </button>
          <button
            v-if="tempHPEnabled"
            class="btn btn-info btn-xs flex-1"
            @click="combatant.addTempHP(hpValue)"
          >
            <Icon icon="tabler:shield-plus" height="16" />
          </button>
        </div>
      </div>

      <!-- Action / Reaction pips (DM only) -->
      <div v-if="!isReadOnly" class="flex items-center gap-1 min-h-8">
        <Icon icon="tabler:swords" height="14" class="text-base-content/40 shrink-0" />
        <button
          v-for="i in 3"
          :key="`act-${i}`"
          class="btn btn-ghost btn-xs px-1"
          :aria-label="t.card.actions"
          :title="`${t.card.actions} ${i}`"
          @click="setActions(i)"
          @contextmenu.prevent="setActions(i - 1)"
        >
          <Icon
            :icon="i <= combatant.actionsUsed ? 'tabler:circle-filled' : 'tabler:circle'"
            height="16"
            :class="i <= combatant.actionsUsed ? 'text-accent' : 'text-base-content/30'"
          />
        </button>
        <div class="w-px h-5 bg-base-content/20 mx-1"></div>
        <Icon icon="tabler:arrows-exchange" height="14" class="text-base-content/40 shrink-0" />
        <button
          class="btn btn-ghost btn-xs px-1"
          :aria-label="t.card.reaction"
          :title="t.card.reaction"
          @click="combatant.toggleReaction()"
        >
          <Icon
            :icon="combatant.reactionUsed ? 'tabler:circle-filled' : 'tabler:circle'"
            height="16"
            :class="combatant.reactionUsed ? 'text-warning' : 'text-base-content/30'"
          />
        </button>
        <button
          class="btn btn-ghost btn-xs px-1 ml-1"
          :aria-label="t.card.resetActions"
          :title="t.card.resetActions"
          @click="combatant.resetActions()"
        >
          <Icon icon="tabler:rotate" height="14" class="text-base-content/40" />
        </button>
      </div>

      <!-- Conditions -->
      <div class="flex flex-wrap items-center gap-1 min-h-8">
        <button
          v-if="!isReadOnly"
          class="btn btn-ghost btn-xs"
          @click="combatant.decrementAllConditions()"
        >
          <Icon icon="tabler:minus" height="16" />
        </button>

        <!-- Add condition popover (DM only) -->
        <PopoverRoot
          v-if="!isReadOnly"
          :open="isConditionPopoverOpen"
          @update:open="(v) => (isConditionPopoverOpen = v)"
        >
          <PopoverTrigger as-child>
            <button class="btn btn-ghost btn-xs">
              <Icon icon="tabler:plus" height="16" />
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent class="card w-72 bg-base-300 card-sm shadow-lg z-50">
              <div class="card-body p-3" @keydown.enter.prevent="addCondition">
                <div class="grid grid-cols-3 items-center gap-2">
                  <Label for="condName" class="text-xs">{{ t.dm_table.addConditionName }}</Label>
                  <input
                    id="condName"
                    v-model="newConditionName"
                    type="text"
                    class="input input-sm col-span-2 h-7"
                    list="conditions"
                  />
                </div>
                <div class="grid grid-cols-3 items-center gap-2">
                  <Label for="condVal" class="text-xs">{{ t.dm_table.addConditionValue }}</Label>
                  <NumberFieldRoot v-model="newConditionValue" :min="1" class="col-span-2">
                    <NumberFieldInput id="condVal" class="input input-sm h-7" />
                  </NumberFieldRoot>
                </div>
                <div class="flex justify-end gap-1">
                  <button class="btn btn-ghost btn-xs" @click="clearCondition">
                    <Icon icon="tabler:eraser" height="16" />{{ t.dm_actions.clear }}
                  </button>
                  <button class="btn btn-neutral btn-xs" @click="addCondition">
                    <Icon icon="tabler:plus" height="16" />{{ t.dm_actions.add }}
                  </button>
                </div>
              </div>
              <PopoverArrow class="fill-base-300" />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <!-- Condition badges -->
        <template v-for="condition in combatant.conditions" :key="condition.name">
          <span
            :class="[
              'badge badge-sm select-none cursor-pointer',
              { 'text-accent-content': !colorIsDark(condition.color) },
            ]"
            :style="{ backgroundColor: condition.color }"
            @click.left="
              isReadOnly ? showTooltip(condition.name) : combatant.changeConditionValue(condition)
            "
            @click.right.prevent="!isReadOnly && combatant.changeConditionValue(condition, true)"
          >
            {{ condition.name }}<span v-if="condition.value > 1"> {{ condition.value }}</span>
          </span>
        </template>
      </div>

      <!-- Stat Block (collapsible, monsters/NPCs with data) -->
      <details
        v-if="hasStatBlock && !isReadOnly"
        class="collapse collapse-arrow bg-base-200 rounded-lg"
      >
        <summary class="collapse-title py-1 px-3 text-sm font-semibold min-h-0">
          <span v-if="combatant.level !== undefined"
            >{{ t.statBlock.level }} {{ combatant.level }}</span
          >
          <span v-if="combatant.ac !== undefined" class="ml-2"
            >{{ t.statBlock.ac }} {{ combatant.ac }}</span
          >
          <span v-if="combatant.speed !== undefined" class="ml-2"
            >{{ t.statBlock.speed }} {{ combatant.speed }}</span
          >
        </summary>
        <div class="collapse-content text-sm space-y-1">
          <!-- Defenses -->
          <div
            v-if="combatant.perception !== undefined || combatant.fortitude !== undefined"
            class="flex flex-wrap gap-2"
          >
            <span v-if="combatant.perception !== undefined" class="badge badge-sm badge-ghost"
              >{{ t.statBlock.perception }} +{{ combatant.perception }}</span
            >
            <span v-if="combatant.fortitude !== undefined" class="badge badge-sm badge-ghost"
              >{{ t.statBlock.fortitude }} +{{ combatant.fortitude }}</span
            >
            <span v-if="combatant.reflex !== undefined" class="badge badge-sm badge-ghost"
              >{{ t.statBlock.reflex }} +{{ combatant.reflex }}</span
            >
            <span v-if="combatant.will !== undefined" class="badge badge-sm badge-ghost"
              >{{ t.statBlock.will }} +{{ combatant.will }}</span
            >
          </div>
          <!-- Traits -->
          <div v-if="combatant.traits?.length" class="flex flex-wrap gap-1">
            <span
              v-for="trait in combatant.traits"
              :key="trait"
              class="badge badge-xs badge-outline"
              >{{ trait }}</span
            >
          </div>
          <!-- Resistances / Weaknesses / Immunities -->
          <div v-if="combatant.resistances?.length" class="text-xs">
            <strong>{{ t.statBlock.resistances }}:</strong>
            {{ combatant.resistances.map((r) => `${r.type} ${r.value}`).join(', ') }}
          </div>
          <div v-if="combatant.weaknesses?.length" class="text-xs">
            <strong>{{ t.statBlock.weaknesses }}:</strong>
            {{ combatant.weaknesses.map((w) => `${w.type} ${w.value}`).join(', ') }}
          </div>
          <div v-if="combatant.immunities?.length" class="text-xs">
            <strong>{{ t.statBlock.immunities }}:</strong>
            {{ combatant.immunities.join(', ') }}
          </div>
          <!-- Attacks -->
          <div v-if="combatant.attacks?.length" class="text-xs">
            <strong>{{ t.statBlock.attacks }}:</strong>
            <div v-for="atk in combatant.attacks" :key="atk.name" class="ml-2">
              <span class="font-semibold">{{ atk.name }}</span>
              ({{ atk.type }}) +{{ atk.bonus }}
              <span v-if="atk.damage"> — {{ atk.damage }} {{ atk.damageType }}</span>
            </div>
          </div>
          <!-- Abilities -->
          <div v-if="combatant.abilities?.length" class="text-xs">
            <strong>{{ t.statBlock.abilities }}:</strong>
            <div v-for="abil in combatant.abilities" :key="abil.name" class="ml-2">
              <span class="font-semibold">{{ abil.name }}</span>
              <span class="badge badge-xs badge-ghost ml-1">{{ abil.type }}</span>
              <div class="text-muted">{{ abil.description }}</div>
            </div>
          </div>
          <!-- Source + AoN link -->
          <div
            v-if="combatant.source || combatant.aonUrl"
            class="text-xs text-muted flex items-center gap-2"
          >
            <span v-if="combatant.source">{{ combatant.source }}</span>
            <a
              v-if="combatant.aonUrl"
              :href="combatant.aonUrl"
              target="_blank"
              class="link link-primary"
            >
              <Icon icon="tabler:external-link" height="12" class="inline" /> AoN
            </a>
          </div>
        </div>
      </details>
    </div>
  </div>

  <!-- Condition tooltip toast (player view) -->
  <Teleport to="body">
    <div v-if="isReadOnly && currentTooltip" class="toast toast-center z-50">
      <div class="alert alert-info text-sm text-justify max-w-md relative">
        <button class="btn btn-ghost btn-xs absolute top-1 right-1" @click="closeTooltip">
          <Icon icon="tabler:x" height="16" />
        </button>
        <div>
          <div class="font-bold">{{ currentTooltipName }}</div>
          <div>{{ currentTooltip }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
