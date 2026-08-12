import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { writeZipFile } from '../../src/utils/zip-writer.js';
import { readEpub } from '../../src/parsers/epub-reader.js';
import { readZipText } from '../../src/utils/zip-utils.js';
import { resolveEffectiveSources, runCorrectAndMergeWorkflow } from '../../src/features/orchestration/full-workflow.js';

test('M7 effective source gate only allows fixed and already_clean', () => {
  const result = resolveEffectiveSources([
    { sourceFile: 'a.epub', sourcePath: '/a.epub', status: 'fixed', outputFile: '/fixed/a.epub' },
    { sourceFile: 'b.epub', sourcePath: '/b.epub', status: 'already_clean' },
    { sourceFile: 'c.epub', sourcePath: '/c.epub', status: 'no_boundary' },
    { sourceFile: 'd.epub', sourcePath: '/d.epub', status: 'ambiguous' },
    { sourceFile: 'e.epub', sourcePath: '/e.epub', status: 'unsupported' },
    { sourceFile: 'f.epub', sourcePath: '/f.epub', status: 'failed', error: 'boom' }
  ]);

  assert.deepEqual(result.sources.map((source) => [source.sourceFile, source.effectiveKind]), [
    ['a.epub', 'fixed-copy'],
    ['b.epub', 'original']
  ]);
  assert.deepEqual(result.blockers.map((blocker) => blocker.status), ['no_boundary', 'ambiguous', 'unsupported', 'failed']);
});

test('M7 orchestration merges safe already_clean sources and normalizes final titles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm7-orchestration-'));
  const input = path.join(root, 'input');
  fs.ensureDirSync(input);
  const part1 = path.join(input, 'novel capitulos 1 a 1.epub');
  const part2 = path.join(input, 'novel capitulos 2 a 2.epub');
  createCleanPart(part1, 1, 'Capítulo 1 Sem Dois Pontos');
  createCleanPart(part2, 2, 'Capítulo 2 Também Sem Dois Pontos');

  const report = await runCorrectAndMergeWorkflow([
    { name: path.basename(part1), path: part1 },
    { name: path.basename(part2), path: part2 }
  ], { root, title: 'Novel', normalizeTitles: true });

  assert.equal(report.status, 'success');
  assert.equal(report.steps.prechapterApply.summary.alreadyClean, 2);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.steps.merge.chapterCount, 2);
  assert.equal(report.steps.integrityAudit.status, 'OK_WITH_WARNINGS');
  assert.equal(report.steps.titleNormalization.status, 'success');
  assert.ok(report.finalOutputFile.endsWith('.epub'));
  assert.ok(fs.existsSync(report.reportPath));

  const epub = readEpub(report.finalOutputFile);
  assert.equal(epub.spineItems.length, 2);
  assert.match(readZipText(epub.zip, 'OEBPS/text/chapter_001.xhtml'), /Capítulo 1: Sem Dois Pontos/);
  assert.match(readZipText(epub.zip, 'OEBPS/nav.xhtml'), /Capítulo 2: Também Sem Dois Pontos/);
  assert.match(readZipText(epub.zip, 'OEBPS/toc.ncx'), /Capítulo 2: Também Sem Dois Pontos/);
});

function createCleanPart(filePath, chapterNumber, heading) {
  const fileName = `chapter_${String(chapterNumber).padStart(3, '0')}.xhtml`;
  writeZipFile(filePath, [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml()) },
    { name: 'OEBPS/content.opf', data: Buffer.from(opfXml(chapterNumber, fileName)) },
    { name: 'OEBPS/toc.ncx', data: Buffer.from(ncxXml(chapterNumber, fileName, heading)) },
    { name: `OEBPS/${fileName}`, data: Buffer.from(chapterXhtml(heading, `Texto do capítulo ${chapterNumber}.`)) }
  ]);
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
}

function opfXml(chapterNumber, fileName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Novel</dc:title><dc:language>pt-BR</dc:language></metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch${chapterNumber}" href="${fileName}" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch${chapterNumber}"/></spine>
</package>`;
}

function ncxXml(chapterNumber, fileName, heading) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap><navPoint id="nav-${chapterNumber}" playOrder="1"><navLabel><text>${heading}</text></navLabel><content src="${fileName}"/></navPoint></navMap>
</ncx>`;
}

function chapterXhtml(heading, body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${heading}</title></head>
<body><h1 id="toc_id_1">${heading}</h1><p>${body}</p></body>
</html>`;
}
