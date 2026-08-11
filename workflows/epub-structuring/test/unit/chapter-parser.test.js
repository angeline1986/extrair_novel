import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeChapterHeading,
  normalizeChapterTitle,
  parseChapterHeading
} from '../../src/utils/chapter-parser.js';

const accepted = [
  ['Capítulo 17 Férias sábias de verão (3)', 17, 'Férias sábias de verão (3)', 'explicit-prefix'],
  ['Capitulo 102 Para reimpressão! (4)', 102, 'Para reimpressão! (4)', 'explicit-prefix'],
  ['CAPÍTULO 260 — O fim do mundo', 260, 'O fim do mundo', 'explicit-prefix'],
  ['Capítulo 17: Título', 17, 'Título', 'explicit-prefix'],
  ['Capítulo 17:Título', 17, 'Título', 'explicit-prefix'],
  ['Capítulo 17 - Título', 17, 'Título', 'explicit-prefix'],
  ['Capítulo 17-Título', 17, 'Título', 'explicit-prefix'],
  ['Capítulo 17 — Título', 17, 'Título', 'explicit-prefix'],
  ['Capítulo 17–Título', 17, 'Título', 'explicit-prefix'],
  ['Capítulo 17. Título', 17, 'Título', 'explicit-prefix'],
  ['Chapter 17 Title', 17, 'Title', 'explicit-prefix'],
  ['Cap. 17 Título', 17, 'Título', 'explicit-prefix'],
  ['17. Título', 17, 'Título', 'numbered-punctuation'],
  ['17) Título', 17, 'Título', 'numbered-punctuation']
];

for (const [input, number, title, format] of accepted) {
  test(`parseChapterHeading accepts ${input}`, () => {
    const parsed = parseChapterHeading(input, { tagName: 'h2', sequenceCompatible: true });
    assert.equal(parsed.matched, true);
    assert.equal(parsed.chapterNumber, number);
    assert.equal(parsed.title, title);
    assert.equal(parsed.displayTitle, `${number}. ${title}`);
    assert.equal(parsed.originalText, input);
    assert.equal(parsed.format, format);
    assert.equal(typeof parsed.confidence, 'number');
    assert.equal(typeof parsed.confidenceScore, 'number');
    assert.ok(parsed.confidenceReasons.length >= 3);
  });
}

const rejected = [
  '17 anos depois',
  '10 pessoas entraram',
  '2024 foi um ano difícil',
  '17 Título',
  '17',
  'Capítulo',
  'Capítulo dez'
];

for (const input of rejected) {
  test(`parseChapterHeading rejects ${input}`, () => {
    const parsed = parseChapterHeading(input);
    assert.deepEqual(parsed, { matched: false, originalText: input });
  });
}

test('parseChapterHeading keeps parenthetical part in title', () => {
  const parsed = parseChapterHeading('Capítulo 17 Férias sábias de verão (3)');
  assert.equal(parsed.chapterNumber, 17);
  assert.equal(parsed.title, 'Férias sábias de verão (3)');
});

test('normalizeChapterHeading returns display title for recognized heading', () => {
  assert.equal(normalizeChapterHeading('Capítulo 17:Título'), '17. Título');
});

test('normalizeChapterTitle removes accents, punctuation and repeated spaces', () => {
  assert.equal(normalizeChapterTitle(' Férias   sábias de verão (3) '), 'ferias sabias de verao 3');
});
