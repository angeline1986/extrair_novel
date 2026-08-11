import test from 'node:test';
import assert from 'node:assert/strict';
import { languageBase, normalizeLanguageTag } from '../../src/utils/language-utils.js';

test('normalizeLanguageTag converts underscore locale to BCP 47 casing', () => {
  assert.equal(normalizeLanguageTag('PT_br'), 'pt-BR');
  assert.equal(normalizeLanguageTag('pt_br'), 'pt-BR');
  assert.equal(normalizeLanguageTag('pt-BR'), 'pt-BR');
});

test('languageBase compares normalized language prefixes', () => {
  assert.equal(languageBase('PT_br'), 'pt');
});
