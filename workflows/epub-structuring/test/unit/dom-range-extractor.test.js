import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBodyFragmentByRange,
  extractBodyFragmentFromBoundaryToEnd,
  extractBodyFragmentFromStartToBoundary
} from '../../src/utils/dom-range-extractor.js';

test('extracts direct body children as [start, end)', () => {
  const fragment = extractBodyFragmentByRange(wrap(`
    <p id="c17">Capítulo 17</p>
    <p>Título 17</p>
    <p>Texto 17 A</p>
    <p>Texto 17 B</p>
    <p id="c18">Capítulo 18</p>
    <p>Título 18</p>
    <p>Texto 18</p>
  `), '#c17', '#c18');

  assertIncludes(fragment, ['Capítulo 17', 'Título 17', 'Texto 17 A', 'Texto 17 B']);
  assertExcludes(fragment, ['Capítulo 18', 'Título 18', 'Texto 18']);
});

test('extracts within the same top-level wrapper without returning empty fragment', () => {
  const fragment = extractBodyFragmentByRange(wrap(`
    <a id="wrapper">
      <p id="c17">Capítulo 17</p>
      <p>Título 17</p>
      <p>Texto 17 A</p>
      <p>Texto 17 B</p>
      <p id="c18">Capítulo 18</p>
      <p>Título 18</p>
      <p>Texto 18</p>
    </a>
  `), '#c17', '#c18');

  assert.match(fragment, /<a[^>]+id="wrapper"/);
  assertIncludes(fragment, ['Capítulo 17', 'Título 17', 'Texto 17 A', 'Texto 17 B']);
  assertExcludes(fragment, ['Capítulo 18', 'Título 18', 'Texto 18']);
});

test('extracts nested wrappers while preserving needed structure', () => {
  const fragment = extractBodyFragmentByRange(wrap(`
    <div class="outer">
      <section>
        <p id="c17">Capítulo 17</p>
        <p>Título 17</p>
        <div>
          <p>Texto interno 17</p>
        </div>
        <p id="c18">Capítulo 18</p>
        <p>Título 18</p>
      </section>
    </div>
  `), '#c17', '#c18');

  assert.match(fragment, /class="outer"/);
  assert.match(fragment, /<section>/);
  assertIncludes(fragment, ['Capítulo 17', 'Título 17', 'Texto interno 17']);
  assertExcludes(fragment, ['Capítulo 18', 'Título 18']);
});

test('extracts across sibling wrappers in the same body', () => {
  const fragment = extractBodyFragmentByRange(wrap(`
    <div id="part-a">
      <p id="c17">Capítulo 17</p>
      <p>Texto A</p>
    </div>
    <div id="part-b">
      <p>Texto B ainda do capítulo 17</p>
      <p id="c18">Capítulo 18</p>
      <p>Título 18</p>
    </div>
  `), '#c17', '#c18');

  assertIncludes(fragment, ['Capítulo 17', 'Texto A', 'Texto B ainda do capítulo 17']);
  assertExcludes(fragment, ['Capítulo 18', 'Título 18']);
});

test('throws explicit error when start and end are the same boundary', () => {
  assert.throws(
    () => extractBodyFragmentByRange(wrap('<p id="c17">Capítulo 17</p>'), '#c17', '#c17'),
    /INVALID_RANGE_SAME_BOUNDARY/
  );
});

test('extracts from boundary to end when end is absent', () => {
  const fragment = extractBodyFragmentFromBoundaryToEnd(wrap(`
    <div>
      <p id="c17">Capítulo 17</p>
      <p>Título 17</p>
      <p>Texto final</p>
    </div>
  `), '#c17');

  assertIncludes(fragment, ['Capítulo 17', 'Título 17', 'Texto final']);
});

test('extracts from start of body to boundary in nested wrapper', () => {
  const fragment = extractBodyFragmentFromStartToBoundary(wrap(`
    <div>
      <p>Texto anterior</p>
      <p id="c18">Capítulo 18</p>
      <p>Título 18</p>
    </div>
  `), '#c18');

  assertIncludes(fragment, ['Texto anterior']);
  assertExcludes(fragment, ['Capítulo 18', 'Título 18']);
});

function wrap(body) {
  return `<html><body>${body}</body></html>`;
}

function assertIncludes(value, texts) {
  for (const text of texts) assert.match(value, new RegExp(escapeRegExp(text)));
}

function assertExcludes(value, texts) {
  for (const text of texts) assert.doesNotMatch(value, new RegExp(escapeRegExp(text)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
