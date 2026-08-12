import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { readEpub } from '../../src/parsers/epub-reader.js';
import { readZipText } from '../../src/utils/zip-utils.js';
import { writeZipFile } from '../../src/utils/zip-writer.js';
import { parseDisplayChapterTitle } from '../../src/features/titles/chapter-title-normalizer.js';
import { analyzeChapterTitles } from '../../src/features/titles/chapter-title-analyzer.js';
import { normalizeChapterTitlesInCopy } from '../../src/features/titles/chapter-title-fixer.js';

test('parseDisplayChapterTitle normalizes missing structural colon and preserves internal colon', () => {
  assert.deepEqual(pick(parseDisplayChapterTitle('Capítulo 1 O Tirano Injustiçado')), {
    matched: true,
    number: 1,
    title: 'O Tirano Injustiçado',
    normalized: 'Capítulo 1: O Tirano Injustiçado',
    changed: true
  });
  assert.deepEqual(pick(parseDisplayChapterTitle('Capítulo 17 Ning Xiaoxiao: Seu imperador cachorro')), {
    matched: true,
    number: 17,
    title: 'Ning Xiaoxiao: Seu imperador cachorro',
    normalized: 'Capítulo 17: Ning Xiaoxiao: Seu imperador cachorro',
    changed: true
  });
  assert.equal(parseDisplayChapterTitle('Capítulo 2: Beliscando').changed, false);
});

test('chapter title normalization updates XHTML, NAV and NCX without changing narrative body', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'title-normalization-'));
  const epub = path.join(dir, 'titles.epub');
  createTitleFixtureEpub(epub, [
    { number: 1, heading: 'Capítulo 1 O Tirano Injustiçado', body: 'Texto narrativo um.' },
    { number: 2, heading: 'Capítulo 2: Beliscando', body: 'Texto narrativo dois.' },
    { number: 17, heading: 'Capítulo 17 Ning Xiaoxiao: Seu imperador cachorro', body: 'Texto narrativo dezessete.' }
  ]);

  const analysis = analyzeChapterTitles(epub);
  assert.equal(analysis.chapterCount, 3);
  assert.equal(analysis.changed, 2);
  assert.equal(analysis.unchanged, 1);

  const report = await normalizeChapterTitlesInCopy(epub, analysis, { outputDir: dir });
  assert.equal(report.status, 'success');
  assert.equal(report.changed, 2);
  assert.equal(report.validation.ok, true);
  assert.equal(report.validation.remainingInconsistent, 0);
  assert.equal(report.validation.bodyTextPreserved, true);
  assert.equal(report.validation.navSynced, true);
  assert.equal(report.validation.ncxSynced, true);

  const fixed = readEpub(report.outputFile);
  const ch1 = readZipText(fixed.zip, 'OEBPS/chapter_001.xhtml');
  const ch17 = readZipText(fixed.zip, 'OEBPS/chapter_017.xhtml');
  assert.match(ch1, /Capítulo 1: O Tirano Injustiçado/);
  assert.match(ch17, /Capítulo 17: Ning Xiaoxiao: Seu imperador cachorro/);
  assert.match(ch17, /Texto narrativo dezessete/);
  assert.match(readZipText(fixed.zip, 'OEBPS/nav.xhtml'), /Capítulo 17: Ning Xiaoxiao: Seu imperador cachorro/);
  assert.match(readZipText(fixed.zip, 'OEBPS/toc.ncx'), /Capítulo 17: Ning Xiaoxiao: Seu imperador cachorro/);

  const second = await normalizeChapterTitlesInCopy(report.outputFile, null, { outputDir: dir });
  assert.equal(second.status, 'already_normalized');
});

test('chapter title analysis can be used as preview without writing output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'title-preview-'));
  const epub = path.join(dir, 'preview.epub');
  createTitleFixtureEpub(epub, [{ number: 1, heading: 'Capítulo 1 Sem Dois Pontos', body: 'Corpo.' }]);
  const before = fs.readdirSync(dir);
  const analysis = analyzeChapterTitles(epub);
  const after = fs.readdirSync(dir);
  assert.equal(analysis.changed, 1);
  assert.deepEqual(after, before);
});

function pick(result) {
  return {
    matched: result.matched,
    number: result.number,
    title: result.title,
    normalized: result.normalized,
    changed: result.changed
  };
}

function createTitleFixtureEpub(filePath, chapters) {
  const manifest = chapters.map((item) => `    <item id="ch${item.number}" href="chapter_${String(item.number).padStart(3, '0')}.xhtml" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((item) => `    <itemref idref="ch${item.number}"/>`).join('\n');
  writeZipFile(filePath, [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml()) },
    { name: 'OEBPS/content.opf', data: Buffer.from(opfXml(manifest, spine)) },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from(navXml(chapters)) },
    { name: 'OEBPS/toc.ncx', data: Buffer.from(ncxXml(chapters)) },
    ...chapters.map((item) => ({
      name: `OEBPS/chapter_${String(item.number).padStart(3, '0')}.xhtml`,
      data: Buffer.from(chapterXhtml(item.heading, item.body))
    }))
  ]);
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
}

function opfXml(manifest, spine) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Titles</dc:title><dc:language>pt-BR</dc:language></metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifest}
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`;
}

function navXml(chapters) {
  const items = chapters.map((item) => `      <li><a href="chapter_${String(item.number).padStart(3, '0')}.xhtml">${item.heading}</a></li>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body><nav epub:type="toc"><ol>
${items}
</ol></nav></body></html>`;
}

function ncxXml(chapters) {
  const items = chapters.map((item, index) => `    <navPoint id="nav-${item.number}" playOrder="${index + 1}">
      <navLabel><text>${item.heading}</text></navLabel>
      <content src="chapter_${String(item.number).padStart(3, '0')}.xhtml"/>
    </navPoint>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>
${items}
</navMap></ncx>`;
}

function chapterXhtml(heading, body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${heading}</title></head>
<body><h1>${heading}</h1><p>${body}</p></body>
</html>`;
}
