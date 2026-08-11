export const DISPLAY_LIMIT = 40;
export const EXAMPLE_LIMIT = 12;

export const GROUPS = [
  {
    id: 'coverage',
    label: 'Cobertura',
    description: 'Omissoes, blocos ausentes, nomes/numeros ausentes e diferencas estruturais.',
  },
  {
    id: 'meaning',
    label: 'Sentido',
    description: 'Possiveis mudancas de sentido, drift semantico e traducoes intermediarias EN/ES.',
  },
  {
    id: 'residual_language',
    label: 'Idioma residual',
    description: 'Expressoes, termos ou titulos que permaneceram em espanhol/ingles.',
  },
  {
    id: 'characters',
    label: 'Personagens',
    description: 'Genero, pronomes, nomes canonicos, romanizacao e tratamento de personagens.',
  },
  {
    id: 'terminology',
    label: 'Terminologia',
    description: 'Glossario, termos perigosos e escolhas terminologicas inconsistentes.',
  },
  {
    id: 'titles',
    label: 'Titulos',
    description: 'Titulos divergentes, literais, duplicados ou com idioma residual.',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Achados editoriais heurísticos que nao se encaixam nas demais abas.',
  },
];

export const GROUP_BY_ID = new Map(GROUPS.map((group) => [group.id, group]));

export function groupLabel(groupId) {
  return GROUP_BY_ID.get(groupId)?.label || groupId || '-';
}

export function emptyGroup(group) {
  return {
    id: group.id,
    label: group.label,
    description: group.description,
    count: 0,
    shown: 0,
    displayLimit: DISPLAY_LIMIT,
    examples: [],
    findings: [],
  };
}

export function buildGroupedCategories(findings) {
  const byGroup = new Map(GROUPS.map((group) => [group.id, []]));
  for (const finding of findings || []) {
    const groupId = GROUP_BY_ID.has(finding.group) ? finding.group : 'editorial';
    byGroup.get(groupId).push(finding);
  }

  return GROUPS.map((group) => {
    const groupFindings = byGroup.get(group.id) || [];
    if (!groupFindings.length) return emptyGroup(group);
    return {
      ...emptyGroup(group),
      count: groupFindings.length,
      shown: Math.min(groupFindings.length, DISPLAY_LIMIT),
      examples: groupFindings.slice(0, EXAMPLE_LIMIT),
      findings: groupFindings,
    };
  });
}

export function severityWeight(severity) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity] ?? 2;
}

function chapterWeight(chapter) {
  const number = Number(chapter);
  return Number.isFinite(number) ? number : 9999;
}

export function sortFindings(findings) {
  return [...(findings || [])].sort((a, b) =>
    chapterWeight(a.chapter) - chapterWeight(b.chapter) ||
    severityWeight(a.severity) - severityWeight(b.severity) ||
    String(a.type || '').localeCompare(String(b.type || ''), 'pt-BR')
  );
}
