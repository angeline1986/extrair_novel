import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { readEpub } from '../../src/parsers/epub-reader.js';
import { readZipText } from '../../src/utils/zip-utils.js';
import { writeZipFile } from '../../src/utils/zip-writer.js';
import { buildMergePrecheck } from '../../src/features/merge/merge-precheck.js';
import { mergeEpubs } from '../../src/features/merge/epub-merge.js';

test('merge builds one EPUB from two source EPUBs using precheck order', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-merge-flow-'));
  const part1 = path.join(dir, 'novel capitulos 1 a 2.epub');
  const part2 = path.join(dir, 'novel capitulos 3 a 4.epub');
  createFixtureEpub(part1, { title: 'Novel capítulos 1 a 2', chapters: [1, 2], imageData: 'same-cover' });
  createFixtureEpub(part2, { title: 'Novel capítulos 3 a 4', chapters: [3, 4], imageData: 'same-cover' });

  const precheck = buildMergePrecheck([part2, part1]);
  assert.equal(precheck.status, 'ready_for_merge');
  assert.deepEqual(precheck.orderedSources.map((source) => source.firstChapter), [1, 3]);

  const outputFile = path.join(dir, 'merged.epub');
  const reportFile = path.join(dir, 'merge_report.json');
  const report = mergeEpubs(precheck, { title: 'Novel', outputFile, reportFile, modified: '2026-08-11T00:00:00Z' });
  assert.equal(report.status, 'success');
  assert.equal(report.sources, 2);
  assert.equal(report.chapterCount, 4);
  assert.equal(report.navigation.navEntries, 4);
  assert.equal(report.navigation.ncxEntries, 4);
  assert.equal(report.navigation.spineEntries, 4);

  const merged = readEpub(outputFile);
  assert.equal(merged.spineItems.length, 4);
  assert.equal(merged.navItems.length, 1);
  assert.equal(merged.ncxItems.length, 1);
  assert.deepEqual(merged.spineItems.map((item) => item.href), [
    'text/chapter_001.xhtml',
    'text/chapter_002.xhtml',
    'text/chapter_003.xhtml',
    'text/chapter_004.xhtml'
  ]);
  assert.match(readZipText(merged.zip, 'OEBPS/text/chapter_001.xhtml'), /Capítulo 1/);
  assert.match(readZipText(merged.zip, 'OEBPS/text/chapter_004.xhtml'), /Capítulo 4/);
  assert.ok(fs.existsSync(reportFile));
});

test('merge deduplicates identical resources and namespaces collisions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-merge-assets-'));
  const part1 = path.join(dir, 'novel capitulos 1 a 1.epub');
  const part2 = path.join(dir, 'novel capitulos 2 a 2.epub');
  createFixtureEpub(part1, { title: 'Novel', chapters: [1], imageData: 'image-a', cssData: 'p{color:red}', logoData: 'same-logo' });
  createFixtureEpub(part2, { title: 'Novel', chapters: [2], imageData: 'image-b', cssData: 'p{color:blue}', logoData: 'same-logo' });

  const precheck = buildMergePrecheck([part1, part2]);
  assert.equal(precheck.status, 'ready_for_merge');
  assert.ok(precheck.resourceCollisions.some((collision) => collision.path === 'OEBPS/images/pic.png' && collision.type === 'samePathDifferentHash'));
  assert.ok(precheck.resourceCollisions.some((collision) => collision.path === 'OEBPS/images/logo.png' && collision.type === 'samePathSameHash'));

  const report = mergeEpubs(precheck, {
    title: 'Novel',
    outputFile: path.join(dir, 'merged-assets.epub'),
    reportFile: path.join(dir, 'merge_report.json')
  });
  assert.equal(report.status, 'success');
  assert.ok(report.resources.namespaced >= 2);
  assert.ok(report.resources.deduplicated >= 1);

  const merged = readEpub(report.outputFile);
  const resourcePaths = merged.manifestItems.map((item) => item.fullPath);
  assert.ok(resourcePaths.includes('OEBPS/assets/part_001/images/pic.png'));
  assert.ok(resourcePaths.includes('OEBPS/assets/part_002/images/pic.png'));
  assert.equal(resourcePaths.filter((item) => item === 'OEBPS/images/logo.png').length, 1);
  assert.equal(merged.manifestItems.filter((item) => String(item.properties).split(/\s+/).includes('cover-image')).length, 1);
  assert.match(readZipText(merged.zip, 'OEBPS/text/chapter_001.xhtml'), /\.\.\/assets\/part_001\/images\/pic\.png/);
  assert.match(readZipText(merged.zip, 'OEBPS/text/chapter_002.xhtml'), /\.\.\/assets\/part_002\/images\/pic\.png/);
});

test('merge refuses blocked precheck and existing output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-merge-blocked-'));
  const part1 = path.join(dir, 'novel capitulos 1 a 2.epub');
  const part2 = path.join(dir, 'novel capitulos 2 a 3.epub');
  createFixtureEpub(part1, { title: 'Novel', chapters: [1, 2] });
  createFixtureEpub(part2, { title: 'Novel', chapters: [2, 3] });

  const blocked = buildMergePrecheck([part1, part2]);
  assert.equal(blocked.status, 'blocked');
  assert.throws(() => mergeEpubs(blocked, { outputFile: path.join(dir, 'blocked.epub') }), /MERGE_PRECHECK_BLOCKED/);

  const ready = buildMergePrecheck([part1]);
  const outputFile = path.join(dir, 'existing.epub');
  fs.writeFileSync(outputFile, 'exists');
  assert.throws(() => mergeEpubs(ready, { outputFile }), /OUTPUT_EXISTS/);
});

function createFixtureEpub(filePath, options) {
  const chapters = options.chapters;
  const manifestChapterItems = chapters.map((chapter) =>
    `    <item id="ch${chapter}" href="ch${chapter}.xhtml" media-type="application/xhtml+xml"/>`
  ).join('\n');
  const spineItems = chapters.map((chapter) => `    <itemref idref="ch${chapter}"/>`).join('\n');
  const cssData = options.cssData || 'body{font-family:serif} .logo{background:url("images/logo.png")}';
  const imageData = options.imageData || `image-${chapters[0]}`;
  const logoData = options.logoData || 'logo';
  const entries = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml()) },
    { name: 'OEBPS/content.opf', data: Buffer.from(opfXml({ ...options, manifestChapterItems, spineItems })) },
    { name: 'OEBPS/toc.ncx', data: Buffer.from(ncxXml(chapters, options.title)) },
    { name: 'OEBPS/style.css', data: Buffer.from(cssData) },
    { name: 'OEBPS/images/pic.png', data: Buffer.from(imageData) },
    { name: 'OEBPS/images/logo.png', data: Buffer.from(logoData) },
    ...chapters.map((chapter) => ({
      name: `OEBPS/ch${chapter}.xhtml`,
      data: Buffer.from(chapterXhtml(chapter))
    }))
  ];
  writeZipFile(filePath, entries);
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
}

function opfXml({ title, manifestChapterItems, spineItems }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${title}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>Autor</dc:creator>
    <dc:language>pt-BR</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="pic" href="images/pic.png" media-type="image/png" properties="cover-image"/>
    <item id="logo" href="images/logo.png" media-type="image/png"/>
${manifestChapterItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
}

function ncxXml(chapters, title) {
  const navPoints = chapters.map((chapter, index) => `    <navPoint id="nav-${chapter}" playOrder="${index + 1}">
      <navLabel><text>Capítulo ${chapter}</text></navLabel>
      <content src="ch${chapter}.xhtml"/>
    </navPoint>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${title}"/></head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

function chapterXhtml(chapter) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Capítulo ${chapter}</title>
  <link rel="stylesheet" href="style.css"/>
</head>
<body>
  <h1>Capítulo ${chapter} Título ${chapter}</h1>
  <p>Texto do capítulo ${chapter}.</p>
  <p><img src="images/pic.png" alt="pic"/></p>
  <p><img src="images/logo.png" alt="logo"/></p>
</body>
</html>`;
}
