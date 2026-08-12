import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZipFile } from '../../src/utils/zip-writer.js';
import { readEpub } from '../../src/parsers/epub-reader.js';
import { runFullPipeline } from '../../src/pipeline/full-pipeline.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAIN = path.join(PROJECT_ROOT, 'src', 'main.js');

test('npm start contract fails when input has no EPUB', () => {
  const root = fixtureRoot();

  const result = runMain(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Iniciando EPUB structuring workflow/);
  assert.match(result.stdout, /Preparando diretórios/);
  assert.match(result.stderr, /Falha ao executar workflow/);
  assert.match(result.stderr, /Nenhum arquivo \.epub encontrado em input\/books\//);
  assert.equal(fs.existsSync(path.join(root, 'input')), true);
  assert.equal(fs.existsSync(path.join(root, 'input', 'books')), true);
  assert.equal(fs.existsSync(path.join(root, 'input', 'reference-files')), true);
  assert.equal(fs.existsSync(path.join(root, 'input', 'validation-baseline')), true);
  assert.equal(fs.existsSync(path.join(root, 'output')), true);
  assert.equal(fs.existsSync(path.join(root, 'reports')), true);
});

test('npm start contract fails when input has multiple EPUBs', () => {
  const root = fixtureRoot();
  createContractEpub(path.join(root, 'input', 'books', 'a.epub'), [1]);
  createContractEpub(path.join(root, 'input', 'books', 'b.epub'), [2]);

  const result = runMain(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Iniciando EPUB structuring workflow/);
  assert.match(result.stdout, /Preparando diretórios/);
  assert.match(result.stderr, /Mais de um EPUB encontrado em input\/books\/\. Deixe apenas um\./);
});

test('npm start contract rejects conflicting PDF options before reading input', () => {
  const root = fixtureRoot();

  const result = runMain(root, ['--no-pdf', '--pdf', path.join(root, 'input', 'ref.pdf')]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Falha ao executar workflow/);
  assert.match(result.stderr, /Use --no-pdf ou --pdf, não ambos\./);
});

test('npm start contract rejects explicit missing PDF', () => {
  const root = fixtureRoot();
  createContractEpub(path.join(root, 'input', 'books', 'contract.epub'), [1]);

  const result = runMain(root, ['--pdf', path.join(root, 'input', 'reference-files', 'missing.pdf')]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Iniciando EPUB structuring workflow/);
  assert.match(result.stdout, /Preparando diretórios/);
  assert.match(result.stderr, /Falha ao executar workflow/);
  assert.match(result.stderr, /PDF informado não encontrado:/);
});

test('npm start contract processes one EPUB without PDF and writes final outputs', () => {
  const root = fixtureRoot();
  createContractEpub(path.join(root, 'input', 'books', 'contract.epub'), [1, 2, 3]);

  const result = runMain(root, ['--no-pdf']);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PDF desativado por --no-pdf/);
  assert.match(result.stdout, /Lendo EPUB e documentos HTML/);
  assert.match(result.stdout, /Analisando TOC, idioma e PDF opcional/);
  assert.match(result.stdout, /Detectando capítulos por spine e por DOM interno/);
  assert.match(result.stdout, /Escolhendo fonte de capítulos/);
  assert.match(result.stdout, /Executando resplit dos capítulos/);
  assert.match(result.stdout, /Empacotando EPUB estruturado/);
  assert.match(result.stdout, /Executando validação final de regressão/);
  assert.match(result.stdout, /EPUB processado pela v7\.2 PDF canonical/);

  const outputFile = path.join(root, 'output', 'Contract-Fixture-structured-complete.epub');
  assert.equal(fs.existsSync(outputFile), true);
  assert.equal(fs.existsSync(path.join(root, 'output', 'chapters', 'chapter_001.xhtml')), true);

  const runDirs = fs.readdirSync(path.join(root, 'reports'))
    .filter((entry) => /^\d{8}_\d{6}(?:_\d+)?$/.test(entry));
  assert.equal(runDirs.length, 1);
  const dataDir = path.join(root, 'reports', runDirs[0], 'data');

  for (const report of [
    'chapter_report.json',
    'chapter_resplit_report.json',
    'toc_report.json',
    'validation_report.json',
    'final_regression_report.json',
    'final_epub_validation.json'
  ]) {
    assert.equal(fs.existsSync(path.join(dataDir, report)), true, report);
    assert.equal(fs.existsSync(path.join(root, 'reports', report)), false, report);
  }

  const finalEpub = readEpub(outputFile);
  assert.equal(finalEpub.navItems.length, 1);
  assert.equal(finalEpub.ncxItems.length, 1);
  assert.equal(finalEpub.spineItems.length, 3);

  const chapterReport = fs.readJsonSync(path.join(dataDir, 'chapter_report.json'));
  const resplitReport = fs.readJsonSync(path.join(dataDir, 'chapter_resplit_report.json'));
  const tocReport = fs.readJsonSync(path.join(dataDir, 'toc_report.json'));
  const validationReport = fs.readJsonSync(path.join(dataDir, 'validation_report.json'));
  const regressionReport = fs.readJsonSync(path.join(dataDir, 'final_regression_report.json'));
  const validationBaseline = fs.readJsonSync(path.join(root, 'input', 'validation-baseline', 'expected-structure.json'));
  assert.equal(chapterReport.chapterCount, 3);
  assert.equal(resplitReport.chapterCount, 3);
  assert.equal(tocReport.entryCount, 3);
  assert.equal(validationReport.ok, true);
  assert.equal(regressionReport.ok, true);
  assert.equal(validationBaseline.expected.chapterCount, 3);
  assert.deepEqual(validationBaseline.expected.chapterHrefs, ['chapter_001.xhtml', 'chapter_002.xhtml', 'chapter_003.xhtml']);
  const run = fs.readJsonSync(path.join(dataDir, 'run.json'));
  const htmlReport = fs.readFileSync(path.join(root, 'reports', runDirs[0], 'report.html'), 'utf8');
  assert.equal(run.runId, runDirs[0]);
  assert.equal(run.operation, 'full_pipeline');
  assert.equal(run.operationLabel, 'Processamento completo');
  assert.equal(run.status, 'success');
  assert.deepEqual(run.inputs, ['input/books/contract.epub']);
  assert.equal(run.output, 'output/Contract-Fixture-structured-complete.epub');
  assert.match(run.startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(run.finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(htmlReport, /Processamento completo/);
  assert.match(htmlReport, /chapter_report\.json/);
  assert.match(htmlReport, /Contract-Fixture-structured-complete\.epub/);
  assert.doesNotMatch(htmlReport, /https?:\/\//);
});

test('npm start contract selects optional PDF and fails on invalid PDF structure', () => {
  const root = fixtureRoot();
  createContractEpub(path.join(root, 'input', 'books', 'contract.epub'), [1, 2, 3]);
  fs.writeFileSync(path.join(root, 'input', 'reference-files', 'reference.pdf'), Buffer.from('%PDF-1.4\n%%EOF\n'));

  const result = runMain(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /PDF selecionado: input\/reference-files\/reference\.pdf/);
  assert.match(result.stdout, /Analisando TOC, idioma e PDF opcional/);
  assert.match(result.stderr, /Invalid PDF structure/);
  assert.equal(fs.existsSync(path.join(root, 'reports', 'chapter_source_identity.json')), false);
});

test('npm start contract ignores EPUB files in reference-files as processing books', () => {
  const root = fixtureRoot();
  createContractEpub(path.join(root, 'input', 'books', 'contract.epub'), [1, 2, 3]);
  createContractEpub(path.join(root, 'input', 'reference-files', 'reference.epub'), [1, 2, 3]);

  const result = runMain(root, ['--no-pdf']);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /EPUB encontrado: input\/books\/contract\.epub/);
});

test('full pipeline explicit EPUB path ignores other books in input/books', async () => {
  const root = fixtureRoot();
  const first = path.join(root, 'input', 'books', 'first.epub');
  const selected = path.join(root, 'input', 'books', 'selected.epub');
  createContractEpub(first, [1]);
  createContractEpub(selected, [1, 2]);

  const logs = [];
  const result = await runFullPipeline(root, {
    argv: ['--no-pdf'],
    epubPath: selected,
    log: (line) => logs.push(line)
  });

  assert.equal(result.context.inputFile, selected);
  assert.match(logs.join('\n'), /EPUB encontrado: input\/books\/selected\.epub/);
  assert.equal(fs.existsSync(path.join(root, 'output', 'Contract-Fixture-structured-complete.epub')), true);
  const run = fs.readJsonSync(result.reportContext.runFile);
  assert.deepEqual(run.inputs, ['input/books/selected.epub']);
});

test('full pipeline explicit EPUB path fails clearly when missing', async () => {
  const root = fixtureRoot();
  createContractEpub(path.join(root, 'input', 'books', 'other.epub'), [1]);

  await assert.rejects(
    () => runFullPipeline(root, {
      argv: ['--no-pdf'],
      epubPath: path.join(root, 'input', 'books', 'missing.epub')
    }),
    /EPUB informado não encontrado:/
  );
});

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-pipeline-contract-'));
  fs.ensureDirSync(path.join(root, 'input', 'books'));
  fs.ensureDirSync(path.join(root, 'input', 'reference-files'));
  fs.ensureDirSync(path.join(root, 'input', 'validation-baseline'));
  return root;
}

function runMain(root, args = []) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    cwd: root,
    encoding: 'utf8'
  });
}

function createContractEpub(filePath, chapters) {
  writeZipFile(filePath, [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml()) },
    { name: 'OEBPS/content.opf', data: Buffer.from(opfXml(chapters)) },
    { name: 'OEBPS/toc.ncx', data: Buffer.from(ncxXml(chapters)) },
    ...chapters.map((chapter) => ({
      name: `OEBPS/chapter-${chapter}.xhtml`,
      data: Buffer.from(chapterXhtml(chapter))
    }))
  ]);
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
}

function opfXml(chapters) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">contract-fixture</dc:identifier>
    <dc:title>Contract Fixture</dc:title>
    <dc:language>pt-BR</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${chapters.map((chapter) => `    <item id="ch${chapter}" href="chapter-${chapter}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine toc="ncx">
${chapters.map((chapter) => `    <itemref idref="ch${chapter}"/>`).join('\n')}
  </spine>
</package>`;
}

function ncxXml(chapters) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="contract-fixture"/></head>
  <docTitle><text>Contract Fixture</text></docTitle>
  <navMap>
${chapters.map((chapter, index) => `    <navPoint id="nav-${chapter}" playOrder="${index + 1}">
      <navLabel><text>Capítulo ${chapter}: Título ${chapter}</text></navLabel>
      <content src="chapter-${chapter}.xhtml"/>
    </navPoint>`).join('\n')}
  </navMap>
</ncx>`;
}

function chapterXhtml(chapter) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR" xml:lang="pt-BR">
<head><title>Capítulo ${chapter}: Título ${chapter}</title></head>
<body>
  <h1>Capítulo ${chapter}: Título ${chapter}</h1>
  <p>Texto do capítulo ${chapter} com conteúdo suficiente para preservar a narrativa e validar o recorte.</p>
  <p>Mais texto do capítulo ${chapter}, com palavras em português para a detecção de idioma.</p>
</body>
</html>`;
}
