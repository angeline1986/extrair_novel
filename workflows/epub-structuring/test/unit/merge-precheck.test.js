import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMergePrecheckFromInventories } from '../../src/features/merge/merge-precheck.js';
import { detectFilenameRange } from '../../src/features/merge/source-range-detector.js';

test('merge precheck preserves correct order and handles random order', () => {
  const report = buildMergePrecheckFromInventories([
    source('part 121 a 180.epub', 121, 180),
    source('part 1 a 60.epub', 1, 60),
    source('part 61 a 120.epub', 61, 120)
  ]);
  assert.equal(report.status, 'ready_for_merge');
  assert.deepEqual(report.orderedSources.map((item) => item.firstChapter), [1, 61, 121]);
  assert.deepEqual(report.gaps, []);
  assert.deepEqual(report.overlaps, []);
  assert.deepEqual(report.duplicates, []);
});

test('merge precheck avoids lexicographic ordering trap', () => {
  const report = buildMergePrecheckFromInventories([
    source('novel capitulos 1 a 60.epub', 1, 60),
    source('novel capitulos 121 a 180.epub', 121, 180),
    source('novel capitulos 61 a 120.epub', 61, 120)
  ]);
  assert.deepEqual(report.orderedSources.map((item) => item.sourceFile), [
    'novel capitulos 1 a 60.epub',
    'novel capitulos 61 a 120.epub',
    'novel capitulos 121 a 180.epub'
  ]);
});

test('merge precheck detects gaps', () => {
  const report = buildMergePrecheckFromInventories([source('a.epub', 1, 60), source('b.epub', 62, 120)]);
  assert.equal(report.status, 'ready_for_merge');
  assert.deepEqual(report.gaps.map((gap) => [gap.missingFrom, gap.missingTo]), [[61, 61]]);
  assert.ok(report.warnings.some((warning) => warning.code === 'GAP'));
});

test('merge precheck blocks overlaps and duplicates', () => {
  const report = buildMergePrecheckFromInventories([source('a.epub', 1, 60), source('b.epub', 60, 120)]);
  assert.equal(report.status, 'blocked');
  assert.equal(report.overlaps.length, 1);
  assert.ok(report.duplicates.some((duplicate) => duplicate.chapter === 60));
});

test('merge precheck blocks invalid and ambiguous ranges', () => {
  const invalid = buildMergePrecheckFromInventories([source('bad.epub', 120, 61)]);
  assert.equal(invalid.status, 'blocked');
  assert.ok(invalid.errors.some((error) => error.code === 'INVALID_RANGE'));

  const ambiguous = buildMergePrecheckFromInventories([{ ...source('unknown.epub', null, null), rangeSource: 'unknown' }]);
  assert.equal(ambiguous.status, 'blocked');
  assert.ok(ambiguous.errors.some((error) => error.code === 'AMBIGUOUS_RANGE'));
});

test('filename range fallback is conservative', () => {
  assert.deepEqual(detectFilenameRange('novel capitulos 61 a 120.epub'), {
    firstChapter: 61,
    lastChapter: 120,
    chapterCount: 60,
    rangeSource: 'filename',
    confidence: 'low',
    issues: []
  });
  assert.equal(detectFilenameRange('novel volume dois.epub'), null);
});

test('merge precheck reports metadata differences and language inconsistency', () => {
  const report = buildMergePrecheckFromInventories([
    source('a.epub', 1, 10, { title: 'Parte A', language: 'pt-BR', author: 'Autor' }),
    source('b.epub', 11, 20, { title: 'Parte B', language: 'en', author: 'Autor' })
  ]);
  assert.ok(report.metadataDifferences.some((item) => item.field === 'title'));
  assert.ok(report.metadataDifferences.some((item) => item.field === 'language'));
});

test('merge precheck classifies same-path resource hashes', () => {
  const same = buildMergePrecheckFromInventories([
    source('a.epub', 1, 10, { resourceEntries: [resource('images/a.jpg', 'AAA')] }),
    source('b.epub', 11, 20, { resourceEntries: [resource('images/a.jpg', 'AAA')] })
  ]);
  assert.equal(same.resourceCollisions[0].type, 'samePathSameHash');

  const different = buildMergePrecheckFromInventories([
    source('a.epub', 1, 10, { resourceEntries: [resource('images/a.jpg', 'AAA')] }),
    source('b.epub', 11, 20, { resourceEntries: [resource('images/a.jpg', 'BBB')] })
  ]);
  assert.equal(different.resourceCollisions[0].type, 'samePathDifferentHash');
});

test('merge precheck records different covers', () => {
  const report = buildMergePrecheckFromInventories([
    source('a.epub', 1, 10, { cover: { path: 'cover.jpg', hash: 'AAA' } }),
    source('b.epub', 11, 20, { cover: { path: 'cover.jpg', hash: 'BBB' } })
  ]);
  assert.equal(report.orderedSources[0].cover.hash, 'AAA');
  assert.equal(report.orderedSources[1].cover.hash, 'BBB');
});

test('merge precheck handles single and empty source sets', () => {
  assert.equal(buildMergePrecheckFromInventories([source('a.epub', 1, 10)]).status, 'ready_for_merge');
  assert.equal(buildMergePrecheckFromInventories([]).status, 'blocked');
});

test('merge precheck accepts 8 parts covering 1..421', () => {
  const report = buildMergePrecheckFromInventories([
    source('361 a 421.epub', 361, 421),
    source('1 a 60.epub', 1, 60),
    source('181 a 211.epub', 181, 211),
    source('121 a 180.epub', 121, 180),
    source('61 a 120.epub', 61, 120),
    source('301 a 360.epub', 301, 360),
    source('271 a 300.epub', 271, 300),
    source('212 a 270.epub', 212, 270)
  ]);
  assert.equal(report.status, 'ready_for_merge');
  assert.equal(report.sourceCount, 8);
  assert.equal(report.globalRange.firstChapter, 1);
  assert.equal(report.globalRange.lastChapter, 421);
  assert.equal(report.gaps.length, 0);
  assert.equal(report.overlaps.length, 0);
  assert.equal(report.duplicates.length, 0);
});

function source(sourceFile, firstChapter, lastChapter, overrides = {}) {
  const chapterCount = Number.isInteger(firstChapter) && Number.isInteger(lastChapter) && lastChapter >= firstChapter ? lastChapter - firstChapter + 1 : 0;
  const resourceEntries = overrides.resourceEntries || [];
  const { resourceEntries: _resourceEntries, ...rest } = overrides;
  return {
    sourceFile,
    sourcePath: sourceFile,
    firstChapter,
    lastChapter,
    chapterCount,
    rangeSource: 'internal-dom',
    confidence: 'high',
    language: 'pt-BR',
    title: 'Novel',
    author: 'Autor',
    publisher: null,
    identifier: sourceFile,
    navigation: { hasNcx: true, hasNav: false, spineCount: chapterCount, htmlCount: chapterCount },
    cover: overrides.cover || { path: null, hash: null },
    resources: { images: 0, stylesheets: 0, fonts: 0, entries: resourceEntries },
    structuralIssues: [],
    ...rest
  };
}

function resource(fullPath, hash) {
  return { fullPath, href: fullPath, mediaType: 'image/jpeg', hash };
}
