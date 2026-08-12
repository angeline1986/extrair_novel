import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { writeZipFile } from '../../src/utils/zip-writer.js';
import { runFinalRegressionValidation } from '../../src/validators/final-regression-validator.js';

test('final regression validator derives dynamic expectation from approved reports', () => {
  const dir = fixtureDir();
  writeReports(dir, 3);
  const epub = path.join(dir, 'final.epub');
  writeMinimalFinalEpub(epub);

  const report = runFinalRegressionValidation(dir, epub);
  assert.equal(report.ok, true);
  assert.ok(report.checks.some((check) => check.code === 'APPROVED_EXPECTATION' && check.ok));
  assert.ok(report.checks.some((check) => check.code === 'CHAPTER_COUNT' && /3 capítulos|= 3/.test(check.message)));
  assert.equal(report.summary.chapterCount, 3);
});

test('final regression validator supports large approved chapter counts', () => {
  const dir = fixtureDir();
  writeReports(dir, 490);
  const epub = path.join(dir, 'final.epub');
  writeMinimalFinalEpub(epub);

  const report = runFinalRegressionValidation(dir, epub);
  assert.equal(report.ok, true);
  assert.ok(report.checks.some((check) => check.code === 'COUNT_CONSISTENCY' && check.message.includes('490 capítulos')));
});

test('final regression validator blocks circular or inconsistent expectations', () => {
  const dir = fixtureDir();
  writeReports(dir, 3, { resplitCount: 2 });
  const epub = path.join(dir, 'final.epub');
  writeMinimalFinalEpub(epub);

  const report = runFinalRegressionValidation(dir, epub);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'APPROVED_EXPECTATION'));
  assert.ok(report.errors.some((error) => error.code === 'COUNT_CONSISTENCY'));
});

function fixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'final-regression-'));
}

function writeReports(dir, count, overrides = {}) {
  const chapters = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      chapterNumber: number,
      href: `chapter_${String(number).padStart(3, '0')}.xhtml`
    };
  });
  const resplitCount = overrides.resplitCount ?? count;
  const resplitChapters = chapters.slice(0, resplitCount).map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    outputFile: chapter.href
  }));
  fs.writeJsonSync(path.join(dir, 'chapter_report.json'), { chapterCount: count, chapters }, { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'toc_report.json'), { entryCount: count, entries: chapters.map((chapter) => ({ src: chapter.href })), hasNav: true, hasNcx: true }, { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'structure_report.json'), { summary: { chapterCount: count }, chapters }, { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'validation_report.json'), { ok: true, issues: [] }, { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'chapter_resplit_report.json'), { chapterCount: resplitCount, chapters: resplitChapters }, { spaces: 2 });
}

function writeMinimalFinalEpub(epubPath) {
  writeZipFile(epubPath, [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from('<container/>') },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from('<html/>') },
    { name: 'OEBPS/toc.ncx', data: Buffer.from('<ncx/>') }
  ]);
}
