import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInternalChapters } from '../../src/analyzers/internal-chapter-discovery.js';

test('detectInternalChapters finds multiple chapters in one HTML in physical order', () => {
  const epub = fakeEpub([
    ['index_split_001.xhtml', `
      <html><body>
        <h2>Capítulo 1 Primeiro</h2><p>Texto 1.</p>
        <h2>Capítulo 2 Segundo</h2><p>Texto 2.</p>
        <h2>Capítulo 3 Terceiro</h2><p>Texto 3.</p>
      </body></html>`]
  ]);

  const report = detectInternalChapters(epub, []);

  assert.equal(report.source, 'internal-dom');
  assert.equal(report.chapterCount, 3);
  assert.deepEqual(report.chapters.map((chapter) => chapter.chapterNumber), [1, 2, 3]);
  assert.deepEqual(report.chapters.map((chapter) => chapter.sourceHref), ['index_split_001.xhtml', 'index_split_001.xhtml', 'index_split_001.xhtml']);
  assert.equal(report.diagnostics.totalCandidates, 3);
  assert.equal(report.diagnostics.acceptedCandidates, 3);
});

test('detectInternalChapters prefers parent element for aggregated inline title', () => {
  const epub = fakeEpub([
    ['index_split_001.xhtml', `
      <html><body>
        <p>
          <span>Capítulo</span>
          <span>1</span>
          <strong>Título agregado</strong>
        </p>
      </body></html>`]
  ]);

  const report = detectInternalChapters(epub, []);

  assert.equal(report.chapterCount, 1);
  assert.equal(report.chapters[0].detectedTitle, 'Capítulo 1 Título agregado');
  assert.match(report.chapters[0].domPath, /p/);
});

test('detectInternalChapters deduplicates parent and child with same text', () => {
  const epub = fakeEpub([
    ['index_split_001.xhtml', `
      <html><body>
        <p><strong>Capítulo 1 Mesmo título</strong></p>
      </body></html>`]
  ]);

  const report = detectInternalChapters(epub, []);

  assert.equal(report.chapterCount, 1);
  assert.equal(report.diagnostics.duplicateCandidates.length, 1);
  assert.equal(report.chapters[0].chapterNumber, 1);
});

test('detectInternalChapters records conflicting duplicates and keeps first', () => {
  const epub = fakeEpub([
    ['index_split_001.xhtml', `
      <html><body>
        <h2>Capítulo 1 Um</h2>
        <h2>Capítulo 1 Outro</h2>
      </body></html>`]
  ]);

  const report = detectInternalChapters(epub, []);

  assert.equal(report.chapterCount, 1);
  assert.equal(report.ok, false);
  assert.equal(report.diagnostics.conflicts.length, 1);
});

test('detectInternalChapters reports missing and out-of-order chapters without reordering', () => {
  const epub = fakeEpub([
    ['index_split_001.xhtml', `
      <html><body>
        <h2>Capítulo 2 Dois</h2>
        <h2>Capítulo 1 Um</h2>
        <h2>Capítulo 4 Quatro</h2>
      </body></html>`]
  ]);

  const report = detectInternalChapters(epub, []);

  assert.deepEqual(report.chapters.map((chapter) => chapter.chapterNumber), [2, 1, 4]);
  assert.deepEqual(report.sequence.missingChapters, [3]);
  assert.equal(report.sequence.outOfOrderChapters.length, 1);
});

test('detectInternalChapters ignores text without recognizable headings', () => {
  const epub = fakeEpub([
    ['chapter001.xhtml', '<html><body><p>17 anos depois todos chegaram.</p><p>Texto corrido.</p></body></html>']
  ]);

  const report = detectInternalChapters(epub, []);

  assert.equal(report.chapterCount, 0);
  assert.equal(report.ok, false);
});

function fakeEpub(entries) {
  const files = new Map(entries.map(([href, html]) => [`OEBPS/${href}`, html]));
  return {
    spineItems: entries.map(([href], index) => ({
      index,
      idref: `item-${index + 1}`,
      href,
      fullPath: `OEBPS/${href}`,
      mediaType: 'application/xhtml+xml'
    })),
    zip: {
      getEntry(path) {
        if (!files.has(path)) return null;
        return {
          getData() {
            return Buffer.from(files.get(path), 'utf8');
          }
        };
      }
    }
  };
}
