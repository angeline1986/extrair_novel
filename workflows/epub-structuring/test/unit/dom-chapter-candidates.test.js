import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { collectDomChapterCandidates } from '../../src/utils/dom-chapter-candidates.js';

test('combines chapter-only p with immediate p title', () => {
  const candidates = collect('<p>Capítulo 17</p><p>Férias sábias de verão (3)</p>');
  const composed = candidates.find((candidate) => candidate.combined);
  assert.equal(composed.combinedText, 'Capítulo 17 Férias sábias de verão (3)');
  assert.equal(composed.tagName, 'p');
  assert.match(composed.titleDomPath, /p:nth-of-type\(2\)/);
});

test('combines chapter-only p with immediate div title', () => {
  const candidates = collect('<p>Capítulo 17</p><div>Férias sábias de verão (3)</div>');
  assert.equal(candidates.find((candidate) => candidate.combined).combinedText, 'Capítulo 17 Férias sábias de verão (3)');
});

test('does not combine when next sibling is another chapter heading', () => {
  const candidates = collect('<p>Capítulo 17</p><p>Capítulo 18</p>');
  assert.equal(candidates.some((candidate) => candidate.combined), false);
});

test('does not combine when next sibling looks like a footnote', () => {
  const candidates = collect('<p>Capítulo 17</p><p>2) Livro de oração comum</p>');
  assert.equal(candidates.some((candidate) => candidate.combined), false);
});

test('does not combine with empty sibling', () => {
  assert.equal(collect('<p>Capítulo 17</p><p></p>').some((candidate) => candidate.combined), false);
});

test('does not combine with whitespace sibling', () => {
  assert.equal(collect('<p>Capítulo 17</p><p>   </p>').some((candidate) => candidate.combined), false);
});

test('combines only heading and title; following normal text remains separate', () => {
  const candidates = collect('<p>Capítulo 17</p><p>Férias sábias...</p><p>Texto normal...</p>');
  const composed = candidates.find((candidate) => candidate.combined);
  assert.equal(composed.combinedText, 'Capítulo 17 Férias sábias...');
  assert.equal(candidates.some((candidate) => candidate.text === 'Texto normal...'), true);
});

function collect(body) {
  const $ = cheerio.load(`<html><body>${body}</body></html>`, { xmlMode: true, decodeEntities: true });
  return collectDomChapterCandidates($, 'body', { sourceHref: 'index.xhtml', spineIndex: 0 });
}
