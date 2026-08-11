import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { detectInternalChapters } from '../../src/analyzers/internal-chapter-discovery.js';
import { analyzeChapterBoundaries } from '../../src/analyzers/chapter-boundary-analyzer.js';
import { buildChapterRanges } from '../../src/analyzers/chapter-range-builder.js';
import { performCanonicalResplit } from '../../src/segmenters/canonical-resplitter.js';
import { buildNavXhtml } from '../../src/builders/nav-builder.js';
import { buildNcx } from '../../src/builders/ncx-builder.js';
import { buildEpub3Opf } from '../../src/builders/opf-builder.js';

test('internal discovery drives boundaries, ranges, resplit and builders for 2 files / 6 chapters', async () => {
  const epub = fakeEpub([
    ['index_split_001.xhtml', htmlWithChapters([
      [1, 'Primeiro'],
      [2, 'Segundo'],
      [3, 'Terceiro']
    ])],
    ['index_split_002.xhtml', htmlWithChapters([
      [4, 'Quarto'],
      [5, 'Quinto'],
      [6, 'Sexto']
    ])]
  ]);

  const chapterReport = detectInternalChapters(epub, []);
  assert.equal(chapterReport.chapterCount, 6);

  const boundaryReport = analyzeChapterBoundaries(epub, chapterReport);
  assert.equal(boundaryReport.expectedCount, 6);
  assert.equal(boundaryReport.foundCount, 6);
  assert.equal(boundaryReport.ok, true);

  const rangeReport = buildChapterRanges(boundaryReport, epub);
  assert.equal(rangeReport.rangeCount, 6);
  assert.equal(rangeReport.ok, true);

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-structuring-resplit-'));
  const resplitReport = performCanonicalResplit(rangeReport, boundaryReport, epub, outputDir);
  assert.equal(resplitReport.ok, true);
  assert.equal(resplitReport.chapterCount, 6);
  for (const chapter of resplitReport.chapters) {
    assert.equal(await fs.pathExists(path.join(outputDir, chapter.outputFile)), true);
  }

  const updatedReport = updateChapterHrefs(chapterReport, resplitReport);
  const nav = buildNavXhtml(updatedReport, 'pt');
  const ncx = buildNcx(updatedReport, epub.opf.metadata);
  const opf = buildEpub3Opf(epub, 'nav.xhtml', 'toc.ncx', updatedReport);

  assert.equal((nav.match(/<li>/g) || []).length, 6);
  assert.equal((ncx.match(/<navPoint/g) || []).length, 6);
  assert.match(opf, /href="chapter_001.xhtml"/);
  assert.match(opf, /idref="chapter-006"/);
  assert.doesNotMatch(opf, /idref="item-1"/);
  assert.doesNotMatch(opf, /idref="item-2"/);

  await fs.remove(outputDir);
});

function updateChapterHrefs(chapterReport, resplitReport) {
  const hrefMap = new Map(resplitReport.chapters.map((chapter) => [chapter.chapterNumber, chapter.outputFile]));
  return {
    ...chapterReport,
    chapters: chapterReport.chapters.map((chapter) => ({
      ...chapter,
      href: hrefMap.get(chapter.chapterNumber) || chapter.href,
      fullPath: hrefMap.get(chapter.chapterNumber) || chapter.fullPath
    }))
  };
}

function htmlWithChapters(chapters) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Fixture</title></head>
<body>
${chapters.map(([number, title]) => `
<h2>Capítulo ${number} ${title}</h2>
<p>Texto do capítulo ${number}. Esta frase dá corpo suficiente para o recorte.</p>
<p>Mais conteúdo do capítulo ${number}, preservado no XHTML final.</p>
`).join('\n')}
</body>
</html>`;
}

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
    manifestItems: [
      ...entries.map(([href], index) => ({
        id: `item-${index + 1}`,
        href,
        fullPath: `OEBPS/${href}`,
        mediaType: 'application/xhtml+xml'
      })),
      { id: 'style', href: 'style.css', fullPath: 'OEBPS/style.css', mediaType: 'text/css' }
    ],
    ncxItems: [],
    navItems: [],
    opf: {
      directory: 'OEBPS',
      metadata: { title: 'Fixture', identifier: 'fixture-id', language: 'pt' },
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixture</dc:title>
    <dc:identifier id="BookId">fixture-id</dc:identifier>
    <dc:language>pt</dc:language>
  </metadata>
  <manifest>
    ${entries.map(([href], index) => `<item id="item-${index + 1}" href="${href}" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>
    ${entries.map((_, index) => `<itemref idref="item-${index + 1}"/>`).join('\n    ')}
  </spine>
</package>`
    },
    zip: {
      getEntry(entryPath) {
        if (!files.has(entryPath)) return null;
        return {
          getData() {
            return Buffer.from(files.get(entryPath), 'utf8');
          }
        };
      }
    }
  };
}
