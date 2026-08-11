import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBookStructureOverrides } from '../../src/utils/book-structure-overrides.js';
import { analyzeChapterBoundaries } from '../../src/analyzers/chapter-boundary-analyzer.js';
import { buildChapterRanges } from '../../src/analyzers/chapter-range-builder.js';

test('book override adds initial implicit chapters and teaser range', () => {
  const epub = fakeEpub([['index_split_000.html', body(`
    <p>Teaser</p>
    <p>No manuscrito (1)</p><p>Texto 1</p>
    <p>No manuscrito (2)</p><p>Texto 2</p>
    <p>No manuscrito (3)</p><p>Texto 3</p>
    <p>No manuscrito (4)</p><p>Texto 4</p>
    <p>Capítulo 5</p><p>Permissões do editor (1)</p>
  `)]]);
  const report = baseReport([{ n: 5, title: '5. Permissões do editor (1)', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(10)' }]);

  const result = applyBookStructureOverrides(epub, report);

  assert.deepEqual(result.report.addedImplicitChapters, [1, 2, 3, 4]);
  assert.equal(result.teaserRange.outputFile, 'prologue.xhtml');
  assert.equal(result.teaserRange.endDomPath, result.chapterReport.chapters.find((chapter) => chapter.chapterNumber === 1).domPath);
});

test('book override creates chapter 13 without changing generic numbered parsing', () => {
  const epub = fakeEpub([['index_split_000.html', body(`
    <p>Capítulo 12</p><p>Dever de estudante (2)</p><p>Texto 12</p>
    <p>One3</p><p>Dever de estudante (3)</p><p>Texto 13</p>
    <p>Capítulo 14</p><p>Dever de estudante (4)</p>
  `)]]);
  const report = baseReport([
    { n: 12, title: '12. Dever de estudante (2)', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(1)' },
    { n: 14, title: '14. Dever de estudante (4)', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(7)' }
  ]);

  const result = applyBookStructureOverrides(epub, report);
  const chapter13 = result.chapterReport.chapters.find((chapter) => chapter.chapterNumber === 13);

  assert.equal(chapter13.title, '13. Dever de estudante (3)');
  assert.equal(chapter13.detectionSource, 'book-structure-override');
  assert.equal(chapter13.overrideMatchedText, 'Dever de estudante (3)');
});

test('book override creates chapter 83 only by override', () => {
  const epub = fakeEpub([['index_split_000.html', body(`
    <p>Capítulo 82</p><p>Título 82</p><p>Texto 82</p>
    <p>83 O estágio do coração partido (3)</p><p>Texto 83</p>
    <p>Capítulo 84</p><p>O que fazer</p>
  `)]]);
  const report = baseReport([
    { n: 82, title: '82. Título 82', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(1)' },
    { n: 84, title: '84. O que fazer', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(6)' }
  ]);

  const result = applyBookStructureOverrides(epub, report);

  assert.equal(result.chapterReport.chapters.find((chapter) => chapter.chapterNumber === 83).title, '83. O estágio do coração partido (3)');
});

test('book override creates chapter 108 from title-only marker', () => {
  const epub = fakeEpub([['index_split_000.html', body(`
    <p>Capítulo 107</p><p>ao norte da cordilheira (4)</p><p>Texto 107</p>
    <p>Cavaleiros de Tristein (1)</p><p>Texto 108</p>
    <p>Capítulo 109</p><p>Cavaleiros de Tristein (2)</p>
  `)]]);
  const report = baseReport([
    { n: 107, title: '107. ao norte da cordilheira (4)', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(1)' },
    { n: 109, title: '109. Cavaleiros de Tristein (2)', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(6)' }
  ]);

  const result = applyBookStructureOverrides(epub, report);

  assert.equal(result.chapterReport.chapters.find((chapter) => chapter.chapterNumber === 108).title, '108. Cavaleiros de Tristein (1)');
});

test('book override creates chapters 456 and 457 with normalized display titles', () => {
  const epub = fakeEpub([['index_split_000.html', body(`
    <p>Capítulo 455</p><p>Título 455</p><p>Texto 455</p>
    <p>456 (vai?)</p><p>Avant la lettre1) (1)</p><p>Texto 456</p>
    <p>457 (um testamento de Arthur privado?)</p><p>Avant la lettre1) (2)</p><p>Texto 457</p>
    <p>Capítulo 458</p><p>Coroação (1)</p>
  `)]]);
  const report = baseReport([
    { n: 455, title: '455. Título 455', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(1)' },
    { n: 458, title: '458. Coroação (1)', href: 'index_split_000.html', domPath: 'html > body > p:nth-of-type(10)' }
  ]);

  const result = applyBookStructureOverrides(epub, report);
  const boundaryReport = analyzeChapterBoundaries(epub, result.chapterReport);
  const rangeReport = buildChapterRanges(boundaryReport, epub);

  assert.equal(result.chapterReport.chapters.find((chapter) => chapter.chapterNumber === 456).title, '456. Avant la lettre (1)');
  assert.equal(result.chapterReport.chapters.find((chapter) => chapter.chapterNumber === 457).title, '457. Avant la lettre (2)');
  assert.equal(rangeReport.ranges.find((range) => range.chapterNumber === 455).endBeforeChapterNumber, 456);
  assert.equal(rangeReport.ranges.find((range) => range.chapterNumber === 456).endBeforeChapterNumber, 457);
});

test('book override can produce complete 1-490 sequence', () => {
  const chapters = [];
  const paragraphs = [];
  for (let n = 5; n <= 490; n++) {
    if ([13, 83, 108, 456, 457].includes(n)) {
      if (n === 456) paragraphs.push('<p>456 (vai?)</p>');
      if (n === 457) paragraphs.push('<p>457 (um testamento de Arthur privado?)</p>');
      paragraphs.push(`<p>${overrideTextFor(n)}</p>`);
      continue;
    }
    paragraphs.push(`<p>Capítulo ${n} Capítulo ${n}</p>`);
    chapters.push({ n, title: `${n}. Capítulo ${n}`, href: 'index_split_000.html', domPath: `html > body > p:nth-of-type(${paragraphs.length + 4})` });
  }
  const html = body(`
    <p>No manuscrito (1)</p><p>No manuscrito (2)</p><p>No manuscrito (3)</p><p>No manuscrito (4)</p>
    ${paragraphs.join('\n')}
  `);

  const result = applyBookStructureOverrides(fakeEpub([['index_split_000.html', html]]), baseReport(chapters));

  assert.equal(result.chapterReport.chapterCount, 490);
  assert.equal(result.chapterReport.sequence.missingChapters.length, 0);
  assert.equal(result.chapterReport.sequence.duplicateChapters.length, 0);
  assert.equal(result.chapterReport.sequence.outOfOrderChapters.length, 0);
});

function baseReport(chapters) {
  return {
    generatedAt: new Date().toISOString(),
    source: 'internal-dom',
    canonicalMapActive: false,
    canonicalMapSource: null,
    totalDocuments: 1,
    chapterCount: chapters.length,
    documents: [],
    chapters: chapters.map((chapter, index) => ({
      index,
      role: 'chapter',
      chapterNumber: chapter.n,
      title: chapter.title,
      finalTitle: chapter.title,
      href: chapter.href,
      fullPath: chapter.href,
      sourceHref: chapter.href,
      spineIndex: 0,
      domPath: chapter.domPath,
      detectionSource: 'internal-dom'
    })),
    sequence: { missingChapters: [], duplicateChapters: [], outOfOrderChapters: [] },
    diagnostics: { confidenceSummary: { averageConfidence: 0.9 }, conflicts: [] },
    ok: true
  };
}

function overrideTextFor(number) {
  if (number === 13) return 'Dever de estudante (3)';
  if (number === 83) return '83 O estágio do coração partido (3)';
  if (number === 108) return 'Cavaleiros de Tristein (1)';
  if (number === 456) return 'Avant la lettre1) (1)';
  if (number === 457) return 'Avant la lettre1) (2)';
  return '';
}

function fakeEpub(entries) {
  const files = new Map(entries.map(([href, html]) => [href, html]));
  return {
    sourcePath: '/books/The_Editor_Is_the_Novels_Extra.epub',
    opf: { metadata: { title: 'The Editor Is the Novel’s Extra' } },
    spineItems: entries.map(([href], index) => ({ href, fullPath: href, mediaType: 'application/xhtml+xml', index })),
    zip: {
      getEntry(entryPath) {
        return { getData: () => Buffer.from(files.get(entryPath), 'utf8') };
      }
    }
  };
}

function body(value) {
  return `<html><body>${value}</body></html>`;
}
