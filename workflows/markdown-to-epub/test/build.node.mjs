import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { discoverChapters, renderChapter, buildBook } from '../src/build.js';

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-epub-test-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

test('ordena números com zeros e conserva texto, ênfase e notas', (t) => {
  const dir = fixture({
    'capitulo_002_traducao_validada.md': '# Capítulo 2 — Fim\n\nSegundo.',
    'capitulo_01_traducao_revisada.md': '# Capítulo 1 — A & B\n\n— Olá, <amigo>! **Forte** e *calmo~*.\n\n## Notas de tradução\n\n- **Termo:** explicação.'
  });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const chapters = discoverChapters(dir);
  assert.deepEqual(chapters.map((chapter) => chapter.chapterNumber), [1, 2]);
  const { xml } = renderChapter(chapters[0], 'pt-BR');
  assert.match(xml, /— Olá, &lt;amigo&gt;!/);
  assert.match(xml, /<strong>Forte<\/strong>/);
  assert.match(xml, /<em>calmo~<\/em>/);
  assert.match(xml, /<h2>Notas de tradução<\/h2>/);
  assert.match(xml, /<li><strong>Termo:<\/strong> explicação\.<\/li>/);
});

test('título sem marcação vira H1 apenas no XHTML', (t) => {
  const dir = fixture({ 'capitulo_1_traducao_revisada.md': 'Capítulo 1 — Título\n\nTexto.' });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const chapter = discoverChapters(dir)[0];
  assert.match(renderChapter(chapter, 'pt-BR').xml, /<h1>Capítulo 1 — Título<\/h1>/);
  assert.equal(fs.readFileSync(chapter.sourcePath, 'utf8'), chapter.markdown);
});

test('bloqueia duplicação, lacuna e capítulo vazio', (t) => {
  const duplicate = fixture({ 'capitulo_1_traducao_revisada.md': '# Capítulo 1\n\nTexto', 'capitulo_01_traducao_validada.md': '# Capítulo 1\n\nTexto' });
  const gap = fixture({ 'capitulo_1_traducao_revisada.md': '# Capítulo 1\n\nTexto', 'capitulo_3_traducao_revisada.md': '# Capítulo 3\n\nTexto' });
  const empty = fixture({ 'capitulo_1_traducao_revisada.md': '  \n' });
  t.after(() => [duplicate, gap, empty].forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
  assert.throws(() => discoverChapters(duplicate), /duplicados 1/);
  assert.throws(() => discoverChapters(gap), /ausentes 2/);
  assert.throws(() => discoverChapters(empty), /Capítulo vazio/);
});

test('integração: EPUB, OPF, NAV, NCX e EPUBCheck oficial', { skip: !process.env.EPUBCHECK_JAR }, (t) => {
  const dir = fixture({
    'capitulo_02_traducao_validada.md': 'Capítulo 2 — Último\n\nDiálogo: — Sim.',
    'capitulo_1_traducao_revisada.md': '# Capítulo 1 — Primeiro\n\nTexto & *itálico*.\n\n## Notas de tradução\n\n- Nota um.'
  });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-epub-output-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const output = path.join(outDir, 'test.epub');
  const report = path.join(outDir, 'validation.json');
  const cover = path.join(outDir, 'cover.png');
  fs.writeFileSync(cover, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p/kAAAAASUVORK5CYII=', 'base64'));
  const result = buildBook({ input: dir, title: 'Teste', author: 'Autora', language: 'pt-br', cover, output, report, epubcheck: process.env.EPUBCHECK_JAR });
  assert.equal(result.ok, true);
  assert.deepEqual([result.internalValidation.chapterCount, result.internalValidation.navEntries, result.internalValidation.ncxEntries, result.internalValidation.spineEntries], [2, 2, 2, 2]);
  assert.equal(result.internalValidation.coverPage, true);
  assert.equal(result.metadata.language, 'pt-BR');
  assert.equal(result.epubcheck.exitCode, 0);
  const zip = new AdmZip(output);
  assert.match(zip.readAsText('OEBPS/content.opf'), /version="3\.0"/);
  assert.match(zip.readAsText('OEBPS/content.opf'), /idref="cover-page"/);
  assert.match(zip.readAsText('OEBPS/cover.xhtml'), /alt="Capa de Teste"/);
  assert.match(zip.readAsText('OEBPS/chapter_001.xhtml'), /Texto &amp; <em>itálico<\/em>/);
  assert.match(zip.readAsText('OEBPS/nav.xhtml'), /chapter_002.xhtml/);
  assert.match(zip.readAsText('OEBPS/toc.ncx'), /chapter_002.xhtml/);
});

test('não publica EPUB quando EPUBCheck falha', (t) => {
  const dir = fixture({ 'capitulo_1_traducao_revisada.md': '# Capítulo 1\n\nTexto.' });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-epub-output-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const output = path.join(outDir, 'blocked.epub');
  const report = path.join(outDir, 'validation.json');
  assert.throws(() => buildBook({ input: dir, title: 'Teste', author: 'Autora', output: path.join(dir, 'subdir', 'book.epub'), report }), /fora do diretório de entrada/);
  assert.throws(() => buildBook({ input: dir, title: 'Teste', author: 'Autora', output, report, epubcheck: path.join(dir, 'missing.jar') }), /EPUBCheck falhou/);
  assert.equal(fs.existsSync(output), false);
  assert.equal(JSON.parse(fs.readFileSync(report, 'utf8')).ok, false);
});
