import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { analyzePrechapterContent } from '../../src/features/prechapter/prechapter-analyzer.js';
import { analyzePrechapterBatch, applyPrechapterBatch } from '../../src/features/prechapter/prechapter-batch.js';
import { fixPrechapterContent } from '../../src/features/prechapter/prechapter-fixer.js';
import { listEpubs, parseEpubSelection } from '../../src/cli/input-selector.js';
import { readEpub } from '../../src/parsers/epub-reader.js';
import { readZipText } from '../../src/utils/zip-utils.js';
import { writePrechapterBatchReport } from '../../src/features/prechapter/prechapter-report.js';

test('prechapter analyzer finds high-confidence pre-boundary content', async () => {
  const file = await writeFixtureEpub({
    href: 'index_split_000.html',
    anchor: 'c1',
    label: 'Capítulo 1 O Tirano Injustiçado Lê Meu Coração',
    body: `
      <p>Título geral</p>
      <p>Capítulos 1 a 60</p>
      <h1 id="c1">Capítulo 1 O Tirano Injustiçado Lê Meu Coração</h1>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'candidate_found');
  assert.equal(result.confidence, 'high');
  assert.equal(result.boundarySource, 'toc-anchor');
  assert.equal(result.target.href, 'index_split_000.html');
  assert.equal(result.target.anchor, 'c1');
  assert.equal(result.target.chapterNumber, 1);
  assert.equal(result.preBoundary.elementCount, 2);
  assert.deepEqual(result.preBoundary.textElements, ['Título geral', 'Capítulos 1 a 60']);
});

test('prechapter analyzer reports already_clean when boundary starts the document', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'c61',
    label: 'Capítulo 61 Um novo começo',
    body: `
      <h1 id="c61">Capítulo 61 Um novo começo</h1>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'already_clean');
  assert.equal(result.confidence, 'high');
  assert.equal(result.target.chapterNumber, 61);
  assert.equal(result.preBoundary.elementCount, 0);
});

test('prechapter analyzer does not hardcode chapter 1', async () => {
  const file = await writeFixtureEpub({
    href: 'section001.xhtml',
    anchor: 'c121',
    label: 'Capítulo 121 A outra parte',
    body: `
      <p>Capítulos 121 a 180</p>
      <h2 id="c121">Capítulo 121 A outra parte</h2>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'candidate_found');
  assert.equal(result.confidence, 'high');
  assert.equal(result.target.href, 'section001.xhtml');
  assert.equal(result.target.chapterNumber, 121);
});

test('prechapter analyzer uses TOC document heading when NCX has no anchor', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: null,
    label: 'Capítulo 22 Sem âncora',
    body: `
      <p>Volume 2</p>
      <h1 id="c22">Capítulo 22 Sem âncora</h1>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'candidate_found');
  assert.equal(result.boundarySource, 'toc-document-heading');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.target.chapterNumber, 22);
  assert.equal(result.preBoundary.elementCount, 1);
});

test('prechapter analyzer falls back to internal-dom when TOC has no chapter anchor or label', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: null,
    label: 'Start',
    body: `
      <p>Volume 3</p>
      <h1 id="c61">Capítulo 61 Recomeço</h1>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'candidate_found');
  assert.equal(result.boundarySource, 'internal-dom');
  assert.equal(result.target.chapterNumber, 61);
});

test('prechapter analyzer does not silently choose when TOC document and internal-dom disagree', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: null,
    label: 'Capítulo 2 Segundo',
    body: `
      <p>Capítulo 1 Primeiro</p>
      <h1 id="c2">Capítulo 2 Segundo</h1>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.boundarySource, 'multiple-disagreement');
  assert.ok(result.signals.includes('boundary-source-disagreement'));
});

test('prechapter analyzer does not assume the first heading is a boundary', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: null,
    label: 'Start',
    body: `
      <h1>Prólogo</h1>
      <p>Texto sem capítulo reconhecível</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'no_boundary');
  assert.equal(result.boundarySource, null);
});

test('prechapter analyzer does not produce high candidate when anchor is missing', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'missing',
    label: 'Capítulo 1 Começo',
    body: `
      <p>Capítulos 1 a 60</p>
      <h1 id="c1">Capítulo 1 Começo</h1>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'no_boundary');
  assert.equal(result.confidence, 'low');
});

test('prechapter analyzer treats structurally weak prologue case as ambiguous', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `
      <h2>Prólogo</h2>
      <p>Texto legítimo</p>
      <p id="c1">Capítulo 1 Começo</p>
      <p>Texto</p>
    `
  });

  const result = analyzePrechapterContent(file);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.confidence, 'medium');
});

test('listEpubs supports multiple EPUBs without using findSingleEpub', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-list-'));
  await fs.writeFile(path.join(dir, 'parte 61 a 120.epub'), '');
  await fs.writeFile(path.join(dir, 'parte 1 a 60.epub'), '');

  const epubs = await listEpubs(dir);
  assert.deepEqual(epubs.map((epub) => epub.name), ['parte 1 a 60.epub', 'parte 61 a 120.epub']);
  await fs.remove(dir);
});

test('parseEpubSelection supports todos, lists, ranges and dedupe', () => {
  assert.deepEqual(parseEpubSelection('todos', 4).indexes, [1, 2, 3, 4]);
  assert.deepEqual(parseEpubSelection('5', 4).indexes, [1, 2, 3, 4]);
  assert.deepEqual(parseEpubSelection('1,2,3', 4).indexes, [1, 2, 3]);
  assert.deepEqual(parseEpubSelection('1-4', 4).indexes, [1, 2, 3, 4]);
  assert.deepEqual(parseEpubSelection('1,2,2,3', 4).indexes, [1, 2, 3]);
  assert.match(parseEpubSelection('5', 4, { allowAll: false }).error, /fora da lista/);
  assert.match(parseEpubSelection('9', 4).error, /fora da lista/);
  assert.match(parseEpubSelection('2-1', 4).error, /Intervalo inválido/);
});

test('prechapter batch handles mixed statuses and applies only eligible files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-batch-'));
  const inputDir = path.join(root, 'input');
  await fs.ensureDir(inputDir);
  const fixed = await writeFixtureEpub({
    dir: inputDir,
    fileName: 'fixed.epub',
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `<p>Antes</p><h1 id="c1">Capítulo 1 Começo</h1><p>Texto</p>`
  });
  const clean = await writeFixtureEpub({
    dir: inputDir,
    fileName: 'clean.epub',
    href: 'file.xhtml',
    anchor: 'c2',
    label: 'Capítulo 2 Limpo',
    body: `<h1 id="c2">Capítulo 2 Limpo</h1><p>Texto</p>`
  });
  const ambiguous = await writeFixtureEpub({
    dir: inputDir,
    fileName: 'ambiguous.epub',
    href: 'file.xhtml',
    anchor: 'c3',
    label: 'Capítulo 3 Ambíguo',
    body: `<h2>Prólogo</h2><p id="c3">Capítulo 3 Ambíguo</p><p>Texto</p>`
  });
  const noBoundary = await writeFixtureEpub({
    dir: inputDir,
    fileName: 'no-boundary.epub',
    href: 'file.xhtml',
    anchor: null,
    label: 'Start',
    body: `<h1>Prólogo</h1><p>Texto</p>`
  });
  const broken = path.join(inputDir, 'broken.epub');
  await fs.writeFile(broken, 'not an epub');

  const epubs = [
    { name: 'fixed.epub', path: fixed },
    { name: 'clean.epub', path: clean },
    { name: 'ambiguous.epub', path: ambiguous },
    { name: 'no-boundary.epub', path: noBoundary },
    { name: 'broken.epub', path: broken }
  ];
  const batch = await analyzePrechapterBatch(epubs, root);
  assert.equal(batch.summary.eligible, 1);
  assert.equal(batch.summary.alreadyClean, 1);
  assert.equal(batch.summary.ambiguous, 1);
  assert.equal(batch.summary.noBoundary, 1);
  assert.equal(batch.summary.unsupported, 1);
  assert.equal(batch.summary.failed, 0);

  const applied = await applyPrechapterBatch(batch, root);
  assert.equal(applied.summary.fixed, 1);
  assert.equal(applied.summary.alreadyClean, 1);
  assert.equal(applied.summary.unsupported, 1);
  const fixedItem = applied.items.find((item) => item.sourceFile === 'fixed.epub');
  assert.ok(fixedItem.outputFile);
  assert.equal(fixedItem.validation.ok, true);
  assert.deepEqual(fixedItem.result.unexpectedChangedEntries, []);
});

test('prechapter batch can be cancelled before applying fixes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-batch-cancel-'));
  const inputDir = path.join(root, 'input');
  await fs.ensureDir(inputDir);
  const file = await writeFixtureEpub({
    dir: inputDir,
    fileName: 'candidate.epub',
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `<p>Antes</p><h1 id="c1">Capítulo 1 Começo</h1><p>Texto</p>`
  });

  const batch = await analyzePrechapterBatch([{ name: 'candidate.epub', path: file }], root);
  assert.equal(batch.summary.eligible, 1);
  assert.equal(await fs.pathExists(path.join(root, 'output', 'fixes')), false);
});

test('prechapter batch report is written and existing outputs are not overwritten', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-batch-report-'));
  const inputDir = path.join(root, 'input');
  await fs.ensureDir(inputDir);
  const file = await writeFixtureEpub({
    dir: inputDir,
    fileName: 'candidate.epub',
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `<p>Antes</p><h1 id="c1">Capítulo 1 Começo</h1><p>Texto</p>`
  });

  const first = await applyPrechapterBatch(await analyzePrechapterBatch([{ name: 'candidate.epub', path: file }], root), root);
  const second = await applyPrechapterBatch(await analyzePrechapterBatch([{ name: 'candidate.epub', path: file }], root), root);
  const reportPath = await writePrechapterBatchReport(root, second);
  assert.equal(await fs.pathExists(reportPath), true);
  assert.notEqual(first.items[0].outputFile, second.items[0].outputFile);
  assert.match(path.basename(second.items[0].outputFile), /-2\.epub$/);
});

test('prechapter fixer creates a non-destructive corrected copy', async () => {
  const file = await writeFixtureEpub({
    href: 'index_split_000.html',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `
      <p>Volume 1</p>
      <p>Capítulos 1 a 60</p>
      <h1 id="c1">Capítulo 1 Começo</h1>
      <p>Primeira narrativa</p>
    `
  });
  const originalHash = hashFile(file);
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-fixes-'));
  const analysis = analyzePrechapterContent(file);

  const report = await fixPrechapterContent(file, analysis, { outputDir });
  assert.equal(report.status, 'fixed');
  assert.equal(report.result.removedElementCount, 2);
  assert.equal(report.result.boundaryPreserved, true);
  assert.equal(report.result.anchorPreserved, true);
  assert.equal(report.result.firstNarrativeContentPreserved, true);
  assert.deepEqual(report.result.unexpectedChangedEntries, []);
  assert.equal(hashFile(file), originalHash);

  const fixed = readEpub(report.outputFile);
  const html = readZipText(fixed.zip, 'OEBPS/index_split_000.html');
  assert.match(html, /id="c1"/);
  assert.match(html, /Capítulo 1 Começo/);
  assert.match(html, /Primeira narrativa/);
  assert.doesNotMatch(html, /Volume 1/);
  assert.doesNotMatch(html, /Capítulos 1 a 60/);
});

test('prechapter fixer blocks unsafe statuses and clean files', async () => {
  const ambiguous = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `<h2>Prólogo</h2><p id="c1">Capítulo 1 Começo</p><p>Texto</p>`
  });
  const clean = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'c61',
    label: 'Capítulo 61 Limpo',
    body: `<h1 id="c61">Capítulo 61 Limpo</h1><p>Texto</p>`
  });
  const noBoundary = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: null,
    label: 'Start',
    body: `<h1>Prólogo</h1><p>Texto</p>`
  });

  assert.equal((await fixPrechapterContent(ambiguous, analyzePrechapterContent(ambiguous))).status, 'blocked');
  assert.equal((await fixPrechapterContent(clean, analyzePrechapterContent(clean))).blockReason, 'status-already_clean');
  assert.equal((await fixPrechapterContent(noBoundary, analyzePrechapterContent(noBoundary))).status, 'blocked');
});

test('prechapter fixer is idempotent on its corrected output', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `<p>Antes</p><h1 id="c1">Capítulo 1 Começo</h1><p>Texto</p>`
  });
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-idempotent-'));
  const first = await fixPrechapterContent(file, analyzePrechapterContent(file), { outputDir });
  assert.equal(first.status, 'fixed');

  const secondAnalysis = analyzePrechapterContent(first.outputFile);
  assert.equal(secondAnalysis.status, 'already_clean');
  const second = await fixPrechapterContent(first.outputFile, secondAnalysis, { outputDir });
  assert.equal(second.status, 'blocked');
  assert.equal(second.blockReason, 'status-already_clean');
});

test('prechapter fixer does not overwrite an existing output file', async () => {
  const file = await writeFixtureEpub({
    href: 'file.xhtml',
    anchor: 'c1',
    label: 'Capítulo 1 Começo',
    body: `<p>Antes</p><h1 id="c1">Capítulo 1 Começo</h1><p>Texto</p>`
  });
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-output-name-'));
  const first = await fixPrechapterContent(file, analyzePrechapterContent(file), { outputDir });
  const second = await fixPrechapterContent(file, analyzePrechapterContent(file), { outputDir });
  assert.notEqual(first.outputFile, second.outputFile);
  assert.match(path.basename(second.outputFile), /-2\.epub$/);
});

async function writeFixtureEpub({ dir = null, fileName = 'fixture.epub', href, anchor, label, body }) {
  const targetDir = dir || await fs.mkdtemp(path.join(os.tmpdir(), 'prechapter-epub-'));
  await fs.ensureDir(targetDir);
  const file = path.join(targetDir, fileName);
  const zip = new AdmZip();

  zip.addFile('mimetype', Buffer.from('application/epub+zip'));
  zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`));
  zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixture</dc:title>
    <dc:language>pt-BR</dc:language>
    <dc:identifier id="bookid">fixture</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter" href="${href}" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter"/>
  </spine>
</package>`));
  zip.addFile(`OEBPS/${href}`, Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Fixture</title></head>
  <body>${body}</body>
</html>`));
  zip.addFile('OEBPS/style.css', Buffer.from('body { display: block; }'));
  zip.addFile('OEBPS/toc.ncx', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>${label}</text></navLabel>
      <content src="${anchor ? `${href}#${anchor}` : href}"/>
    </navPoint>
  </navMap>
</ncx>`));

  zip.writeZip(file);
  return file;
}

function hashFile(file) {
  return fs.readFileSync(file).toString('base64');
}
