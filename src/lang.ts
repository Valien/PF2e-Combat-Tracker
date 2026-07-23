import { computed } from 'vue'
import { useStorage } from '@vueuse/core'

type Locale = 'en' | 'pt_BR'

type TranslationStructure = {
  table: {
    round: string
    name: string
    hp: string
    initiative: string
    conditions: string
    actions: string
  }
  dm_actions: {
    next: string
    reset: string
    resetTooltip: string
    playerView: string
    add: string
    clear: string
    quantity: string
    onlineMode: string
    copyPlayerUrl: string
    copiedToClipboard: string
  }
  dm_table: {
    addConditionName: string
    addConditionValue: string
  }
  options: {
    theme: string
    language: string
    settings: string
    useTempHP: string
    contents: string
    resetToDefaults: string
    resetConfirmTitle: string
    resetConfirmMessage: string
    resetConfirmYes: string
    clearAll: string
    resetConfirmNo: string
  }
  colors: {
    red: string
    green: string
    blue: string
    purple: string
    pink: string
    brown: string
  }
  statBlock: {
    level: string
    ac: string
    fortitude: string
    reflex: string
    will: string
    speed: string
    perception: string
    resistances: string
    weaknesses: string
    immunities: string
    traits: string
    attacks: string
    abilities: string
    notes: string
  }
  card: {
    pc: string
    monster: string
    npc: string
    saveParty: string
    loadParty: string
    noParty: string
    actions: string
    reaction: string
    resetActions: string
  }
  endCombat: {
    title: string
    description: string
    partyLevel: string
    partyLevelHint: string
    defeated: string
    xp: string
    totalXp: string
    newEncounter: string
    close: string
    noMonsters: string
    severityTrivial: string
    severityLow: string
    severityModerate: string
    severitySevere: string
    severityExtreme: string
  }
  nav: {
    prev: string
    next: string
  }
  helpText: {
    actions: string[]
    hp: string[]
    conditions: string[]
  }
}

const translations: Record<Locale, TranslationStructure> = {
  en: {
    table: {
      round: 'Round',
      name: 'Name',
      hp: 'HP',
      initiative: 'Initiative',
      conditions: 'Conditions',
      actions: 'Actions',
    },
    dm_actions: {
      next: 'Next',
      reset: 'New combat',
      resetTooltip: 'Clear all combatants for a new encounter',
      playerView: 'Player View',
      add: 'Add',
      clear: 'Clear',
      quantity: 'Quantity',
      onlineMode: 'Online Mode',
      copyPlayerUrl: 'Copy Player URL',
      copiedToClipboard: 'Copied to clipboard!',
    },
    dm_table: {
      addConditionName: 'Name',
      addConditionValue: 'Value',
    },
    options: {
      theme: 'Theme',
      language: 'Language',
      settings: 'Settings',
      useTempHP: 'Use Temporary HP',
      contents: 'Contents:',
      resetToDefaults: 'Reset to Defaults',
      resetConfirmTitle: 'New Combat?',
      resetConfirmMessage:
        'Clear all combatants for a new encounter, or restore the default party.',
      resetConfirmYes: 'Restore Defaults',
      clearAll: 'Clear All',
      resetConfirmNo: 'Cancel',
    },
    colors: {
      red: 'Red',
      green: 'Green',
      blue: 'Blue',
      purple: 'Purple',
      pink: 'Pink',
      brown: 'Brown',
    },
    statBlock: {
      level: 'Lvl',
      ac: 'AC',
      fortitude: 'Fort',
      reflex: 'Ref',
      will: 'Will',
      speed: 'Speed',
      perception: 'Perc',
      resistances: 'Resistances',
      weaknesses: 'Weaknesses',
      immunities: 'Immunities',
      traits: 'Traits',
      attacks: 'Attacks',
      abilities: 'Abilities',
      notes: 'Notes',
    },
    card: {
      pc: 'PC',
      monster: 'Monster',
      npc: 'NPC',
      saveParty: 'Save Party',
      loadParty: 'Load Party',
      noParty: 'No saved party',
      actions: 'Actions',
      reaction: 'Reaction',
      resetActions: 'Reset Actions',
    },
    endCombat: {
      title: 'End Combat',
      description: 'Review defeated monsters and award XP before starting a new encounter.',
      partyLevel: 'Party Level',
      partyLevelHint: 'Used to calculate XP per monster',
      defeated: 'Defeated monsters',
      xp: 'XP',
      totalXp: 'Total XP',
      newEncounter: 'New Encounter',
      close: 'Close',
      noMonsters: 'No monsters in this encounter',
      severityTrivial: 'Trivial',
      severityLow: 'Low',
      severityModerate: 'Moderate',
      severitySevere: 'Severe',
      severityExtreme: 'Extreme',
    },
    nav: {
      prev: 'Previous',
      next: 'Next',
    },
    helpText: {
      actions: [
        '<icon:tabler:eye-off /> Hidden from player view; ignored during turn advancement',
        '<icon:tabler:eye-closed /> HP bar NOT visible to players',
        '<icon:tabler:eye /> HP bar visible to players',
        '<br />',
        '<icon:ph:mouse-left-click-fill /> Click button to cycle: <icon:tabler:eye-off /> → <icon:tabler:eye-closed /> → <icon:tabler:eye />',
        '<icon:ph:mouse-right-click-fill /> Right-click to set <icon:tabler:eye />',
      ],
      hp: [
        'Set the value here to increase/decrease HP and temporary HP',
        '<br />',
        '<icon:tabler:minus class="text-error" /> <strong>Remove HP:</strong>',
        '<icon:ph:mouse-left-click-fill /> Click to subtract HP (removes temporary HP first, then regular HP)',
        '<br />',
        '<icon:tabler:plus class="text-success" /> <strong>Add HP:</strong>',
        '<icon:ph:mouse-left-click-fill /> Click to add HP (stops at maximum)',
        '<br />',
        '<icon:tabler:plus class="text-info" /> <strong>Add Temporary HP:</strong>',
        '<icon:ph:mouse-left-click-fill /> Click to add temporary HP',
        '<br />',
        '<strong>HP Display Button (XX/XX +Y/Z):</strong>',
        '<icon:ph:mouse-left-click-fill /> Click to heal to max (if has temp HP, removes all temp HP and heals to max)',
        '<icon:ph:mouse-right-click-fill /> Right-click to set max HP to the configured value',
      ],
      conditions: [
        '<icon:ph:mouse-left-click-fill /> Click <icon:tabler:plus /> to add a new condition',
        '<icon:ph:mouse-left-click-fill /> Click <icon:tabler:minus /> to reduce 1 stage from all conditions',
        '<br />',
        '<icon:ph:mouse-left-click-fill /> Click on a condition to reduce 1 stage',
        '<icon:ph:mouse-right-click-fill /> Right-click on a condition to increase 1 stage',
        '<br />',
        'Conditions without value have 1 stage',
        'Condition is removed when reducing from stage 1 to 0',
      ],
    },
  },
  pt_BR: {
    table: {
      round: 'Rodada',
      name: 'Nome',
      hp: 'PV',
      initiative: 'Iniciativa',
      conditions: 'Condições',
      actions: 'Ações',
    },
    dm_actions: {
      next: 'Avançar',
      reset: 'Novo combate',
      resetTooltip: 'Limpar todos os combatentes para um novo encontro',
      playerView: 'Player View',
      add: 'Adicionar',
      clear: 'Limpar',
      quantity: 'Quantidade',
      onlineMode: 'Modo Online',
      copyPlayerUrl: 'Copiar URL dos Jogadores',
      copiedToClipboard: 'Copiado!',
    },
    dm_table: {
      addConditionName: 'Nome',
      addConditionValue: 'Valor',
    },
    options: {
      theme: 'Tema',
      language: 'Idioma',
      settings: 'Configurações',
      useTempHP: 'Usar PV Temporário',
      contents: 'Conteúdos:',
      resetToDefaults: 'Restaurar Padrões',
      resetConfirmTitle: 'Novo Combate?',
      resetConfirmMessage:
        'Limpar todos os combatentes para um novo encontro, ou restaurar o grupo padrão.',
      resetConfirmYes: 'Restaurar Padrões',
      clearAll: 'Limpar Tudo',
      resetConfirmNo: 'Cancelar',
    },
    colors: {
      red: 'Vermelho',
      green: 'Verde',
      blue: 'Azul',
      purple: 'Roxo',
      pink: 'Rosa',
      brown: 'Marrom',
    },
    statBlock: {
      level: 'Nv',
      ac: 'CA',
      fortitude: 'Fort',
      reflex: 'Ref',
      will: 'Vont',
      speed: 'Vel',
      perception: 'Percep',
      resistances: 'Resistências',
      weaknesses: 'Fraquezas',
      immunities: 'Imunidades',
      traits: 'Traços',
      attacks: 'Ataques',
      abilities: 'Habilidades',
      notes: 'Notas',
    },
    card: {
      pc: 'PJ',
      monster: 'Monstro',
      npc: 'NPC',
      saveParty: 'Salvar Grupo',
      loadParty: 'Carregar Grupo',
      noParty: 'Sem grupo salvo',
      actions: 'Ações',
      reaction: 'Reação',
      resetActions: 'Resetar Ações',
    },
    endCombat: {
      title: 'Encerrar Combate',
      description: 'Revise os monstros derrotados e conceda XP antes de iniciar um novo encontro.',
      partyLevel: 'Nível do Grupo',
      partyLevelHint: 'Usado para calcular XP por monstro',
      defeated: 'Monstros derrotados',
      xp: 'XP',
      totalXp: 'XP Total',
      newEncounter: 'Novo Encontro',
      close: 'Fechar',
      noMonsters: 'Sem monstros neste encontro',
      severityTrivial: 'Trivial',
      severityLow: 'Baixo',
      severityModerate: 'Moderado',
      severitySevere: 'Severo',
      severityExtreme: 'Extremo',
    },
    nav: {
      prev: 'Anterior',
      next: 'Próximo',
    },
    helpText: {
      actions: [
        '<icon:tabler:eye-off /> Oculto da visão do jogador; é ignorado durante a passagem de turno',
        '<icon:tabler:eye-closed /> Barra de vida NÃO visível para os jogadores',
        '<icon:tabler:eye /> Barra de vida visível para os jogadores',
        '<br />',
        '<icon:ph:mouse-left-click-fill /> Clique no botão para alternar: <icon:tabler:eye-off /> → <icon:tabler:eye-closed /> → <icon:tabler:eye />',
        '<icon:ph:mouse-right-click-fill /> Clique direito para definir <icon:tabler:eye />',
      ],
      hp: [
        'Defina aqui o valor para aumentar/diminuir PV e PV temporário',
        '<br />',
        '<icon:tabler:minus class="text-error" /> <strong>Remover PV:</strong>',
        '<icon:ph:mouse-left-click-fill /> Clique para subtrair vida (remove PV temporário primeiro, depois PV normal)',
        '<br />',
        '<icon:tabler:plus class="text-success" /> <strong>Adicionar PV:</strong>',
        '<icon:ph:mouse-left-click-fill /> Clique para adicionar vida (para no máximo)',
        '<br />',
        '<icon:tabler:plus class="text-info" /> <strong>Adicionar PV Temporário:</strong>',
        '<icon:ph:mouse-left-click-fill /> Clique para adicionar PV temporário',
        '<br />',
        '<strong>Botão de PV (XX/XX +Y/Z):</strong>',
        '<icon:ph:mouse-left-click-fill /> Clique para curar ao máximo (se tiver PV temporário, remove todo PV temporário e cura ao máximo)',
        '<icon:ph:mouse-right-click-fill /> Clique direito para definir o PV máximo ao valor configurado',
      ],
      conditions: [
        '<icon:ph:mouse-left-click-fill /> Clique em <icon:tabler:plus /> para adicionar uma nova condição',
        '<icon:ph:mouse-left-click-fill /> Clique em <icon:tabler:minus /> para reduzir 1 estágio de todas as condições',
        '<br />',
        '<icon:ph:mouse-left-click-fill /> Clique em uma condição para reduzir 1 estágio',
        '<icon:ph:mouse-right-click-fill /> Clique direito em uma condição para aumentar 1 estágio',
        '<br />',
        'Condições sem valor possuem 1 estágio',
        'A condição é removida ao reduzir de 1 estágio para 0',
      ],
    },
  },
}

export function useTranslations() {
  const lang = useStorage<Locale>('lang', 'en')

  const t = computed(() => translations[lang.value])

  return { t, lang }
}
