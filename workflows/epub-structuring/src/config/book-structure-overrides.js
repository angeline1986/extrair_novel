export const BOOK_STRUCTURE_OVERRIDES = [
  {
    bookId: 'the-editor-is-the-novels-extra',
    titleMatchers: [
      /The Editor Is the Novel[’']s Extra/i,
      /The_Editor_Is_the_Novels_Extra/i
    ],
    teaser: {
      sourceFile: 'index_split_000.html',
      endBeforeText: 'No manuscrito (1)',
      outputHref: 'prologue.xhtml',
      navTitle: 'Abertura'
    },
    implicitChapters: [
      { chapterNumber: 1, title: 'No manuscrito (1)', startText: 'No manuscrito (1)' },
      { chapterNumber: 2, title: 'No manuscrito (2)', startText: 'No manuscrito (2)' },
      { chapterNumber: 3, title: 'No manuscrito (3)', startText: 'No manuscrito (3)' },
      { chapterNumber: 4, title: 'No manuscrito (4)', startText: 'No manuscrito (4)' }
    ],
    irregularChapters: [
      { chapterNumber: 13, title: 'Dever de estudante (3)', startText: 'Dever de estudante (3)' },
      { chapterNumber: 83, title: 'O estágio do coração partido (3)', startText: '83 O estágio do coração partido (3)' },
      { chapterNumber: 108, title: 'Cavaleiros de Tristein (1)', startText: 'Cavaleiros de Tristein (1)' },
      { chapterNumber: 456, title: 'Avant la lettre (1)', markerText: '456 (vai?)', startText: 'Avant la lettre1) (1)' },
      { chapterNumber: 457, title: 'Avant la lettre (2)', markerText: '457 (um testamento de Arthur privado?)', startText: 'Avant la lettre1) (2)' }
    ]
  }
];

export function findBookStructureOverride(epub) {
  const haystack = [
    epub?.opf?.metadata?.title,
    epub?.sourcePath
  ].filter(Boolean).join('\n');

  return BOOK_STRUCTURE_OVERRIDES.find((override) =>
    override.titleMatchers.some((matcher) => matcher.test(haystack))
  ) || null;
}
