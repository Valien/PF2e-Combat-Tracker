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
    addMonster: string
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
    strike: string
    quickActions: string
    stride: string
    step: string
    demoralize: string
    trip: string
    grapple: string
    shove: string
    disarm: string
    noActionsLeft: string
    agile: string
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
  party: {
    title: string
    toggle: string
    roster: string
    empty: string
    addPc: string
    addPcFull: string
    importPathbuilder: string
    importHint: string
    pasteJson: string
    parse: string
    parseError: string
    parseSuccess: string
    save: string
    load: string
    saveCurrent: string
    loadParty: string
    parties: string
    saveAs: string
    saveAsPrompt: string
    rename: string
    renamePrompt: string
    delete: string
    deleteConfirm: string
    activeParty: string
    noParties: string
    defaultPartyName: string
    modules: string
    selectModule: string
    addEncounter: string
    encounterAdded: string
    noEncounters: string
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
      addMonster: 'Add Monster/NPC',
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
      resetToDefaults: 'New Combat',
      resetConfirmTitle: 'New Combat?',
      resetConfirmMessage:
        'Clear all combatants for a new encounter, or restore the last saved party.',
      resetConfirmYes: 'Restore Last Party',
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
      strike: 'Strike',
      quickActions: 'Quick Actions',
      stride: 'Stride',
      step: 'Step',
      demoralize: 'Demoralize',
      trip: 'Trip',
      grapple: 'Grapple',
      shove: 'Shove',
      disarm: 'Disarm',
      noActionsLeft: 'No actions left',
      agile: 'Agile',
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
    party: {
      title: 'Party',
      toggle: 'Party Manager',
      roster: 'Saved Party',
      empty: 'No saved party members',
      addPc: 'Add PC',
      addPcFull: 'Add Player Character',
      importPathbuilder: 'Import from Pathbuilder 2e',
      importHint:
        'Export your character from Pathbuilder 2e as JSON, then paste or upload it here.',
      pasteJson: 'Paste Pathbuilder JSON here...',
      parse: 'Import',
      parseError: 'Could not parse the JSON. Make sure it is a Pathbuilder 2e export.',
      parseSuccess: 'Character imported successfully!',
      save: 'Save',
      load: 'Load',
      saveCurrent: 'Save current party',
      loadParty: 'Load party',
      parties: 'Saved Parties',
      saveAs: 'Save As...',
      saveAsPrompt: 'Enter a name for this party:',
      rename: 'Rename',
      renamePrompt: 'Enter a new name for this party:',
      delete: 'Delete',
      deleteConfirm: 'Delete this party? This cannot be undone.',
      activeParty: 'Active',
      noParties: 'No saved parties',
      defaultPartyName: 'My Party',
      modules: 'Adventure Modules',
      selectModule: 'Select a module...',
      addEncounter: 'Add',
      encounterAdded: 'Added',
      noEncounters: 'No encounters in this module',
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
      addMonster: 'Adicionar Monstro/NPC',
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
      resetToDefaults: 'Novo Combate',
      resetConfirmTitle: 'Novo Combate?',
      resetConfirmMessage:
        'Limpar todos os combatentes para um novo encontro, ou restaurar o último grupo salvo.',
      resetConfirmYes: 'Restaurar Último Grupo',
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
      strike: 'Golpe',
      quickActions: 'Ações Rápidas',
      stride: 'Deslocar',
      step: 'Passo',
      demoralize: 'Intimidar',
      trip: 'Derrubar',
      grapple: 'Agarrar',
      shove: 'Empurrar',
      disarm: 'Desarmar',
      noActionsLeft: 'Sem ações restantes',
      agile: 'Ágil',
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
    party: {
      title: 'Grupo',
      toggle: 'Gerenciador de Grupo',
      roster: 'Grupo Salvo',
      empty: 'Nenhum membro de grupo salvo',
      addPc: 'Adicionar PJ',
      addPcFull: 'Adicionar Personagem Jogador',
      importPathbuilder: 'Importar do Pathbuilder 2e',
      importHint: 'Exporte seu personagem do Pathbuilder 2e como JSON, e cole ou envie aqui.',
      pasteJson: 'Cole o JSON do Pathbuilder aqui...',
      parse: 'Importar',
      parseError:
        'Não foi possível analisar o JSON. Verifique se é uma exportação do Pathbuilder 2e.',
      parseSuccess: 'Personagem importado com sucesso!',
      save: 'Salvar',
      load: 'Carregar',
      saveCurrent: 'Salvar grupo atual',
      loadParty: 'Carregar grupo',
      parties: 'Grupos Salvos',
      saveAs: 'Salvar Como...',
      saveAsPrompt: 'Digite um nome para este grupo:',
      rename: 'Renomear',
      renamePrompt: 'Digite um novo nome para este grupo:',
      delete: 'Excluir',
      deleteConfirm: 'Excluir este grupo? Isso não pode ser desfeito.',
      activeParty: 'Ativo',
      noParties: 'Nenhum grupo salvo',
      defaultPartyName: 'Meu Grupo',
      modules: 'Módulos de Aventura',
      selectModule: 'Selecione um módulo...',
      addEncounter: 'Adicionar',
      encounterAdded: 'Adicionado',
      noEncounters: 'Sem encontros neste módulo',
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
