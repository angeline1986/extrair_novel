import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { buildChapterXhtml } from '../../src/utils/dom-range-extractor.js';

test('buildChapterXhtml removes normal duplicated chapter marker and title', () => {
  const xhtml = buildChapterXhtml({
    title: '5. Permissões do editor (1)',
    bodyContent: '<p>Capítulo 5</p><p>Permissões do editor (1)</p><p>Texto real</p>',
    lang: 'pt-BR'
  });
  const texts = bodyChildrenTexts(xhtml);

  assert.deepEqual(texts.slice(0, 2), ['5. Permissões do editor (1)', 'Texto real']);
});

test('buildChapterXhtml removes duplicated marker and title inside inherited wrapper', () => {
  const xhtml = buildChapterXhtml({
    title: '458. Coronação (1)',
    bodyContent: '<a><p>Capítulo 458</p><p>Coronação (1)</p><p>Texto 458</p></a>',
    lang: 'pt-BR'
  });
  const texts = bodyChildrenTexts(xhtml);

  assert.equal(texts[0], '458. Coronação (1)');
  assert.equal(texts[1], 'Texto 458');
  assert.doesNotMatch(xhtml, /Capítulo 458/);
});

test('buildChapterXhtml removes irregular duplicated title after canonical h1', () => {
  const xhtml = buildChapterXhtml({
    title: '456. Avant la lettre (1)',
    bodyContent: '<p>456 (vai?)</p><p>Avant la lettre1) (1)</p><p>Texto 456</p>',
    lang: 'pt-BR'
  });
  const texts = bodyChildrenTexts(xhtml);

  assert.deepEqual(texts.slice(0, 2), ['456. Avant la lettre (1)', 'Texto 456']);
});

test('buildChapterXhtml preserves natural body text starting with Capítulo', () => {
  const xhtml = buildChapterXhtml({
    title: '20. Outro título',
    bodyContent: '<p>Capítulo estranho da vida começou aqui.</p><p>Texto real</p>',
    lang: 'pt-BR'
  });
  const texts = bodyChildrenTexts(xhtml);

  assert.deepEqual(texts.slice(0, 3), ['20. Outro título', 'Capítulo estranho da vida começou aqui.', 'Texto real']);
});

function bodyChildrenTexts(xhtml) {
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: true });
  return $('body').children().map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get();
}
