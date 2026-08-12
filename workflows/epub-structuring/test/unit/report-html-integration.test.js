import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { createReportContext, finishReportContext } from '../../src/utils/report-context.js';

test('html report reflects analysis operation data without unrelated feature findings', async () => {
  const { html } = await renderOperation({
    operation: 'menu_option_1',
    operationLabel: 'Analisar EPUB',
    reports: {
      'epub_analysis_report.json': { title: 'Livro <script>alert(1)</script>', spineItems: 3, htmlDocuments: 3 },
      'language_report.json': { match: true, detectedLanguage: 'pt-BR' }
    }
  });

  assert.match(html, /Analisar EPUB/);
  assert.match(html, /Livro &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /Idioma coerente/);
  assert.doesNotMatch(html, /Precheck de merge/);
  assert.doesNotMatch(html, /Conteúdo pré-capítulo detectado/);
  assert.doesNotMatch(html, /data-page="navigation"/);
});

test('html report reflects prechapter operation data', async () => {
  const { html } = await renderOperation({
    operation: 'menu_option_8_prechapter_batch',
    operationLabel: 'Corrigir conteúdo pré-capítulo: batch',
    reports: {
      'batch_report.json': {
        summary: { fixed: 1, alreadyClean: 1, ambiguous: 0, noBoundary: 0, unsupported: 0, failed: 0 }
      }
    }
  });

  assert.match(html, /Correção pré-capítulo em lote/);
  assert.match(html, /1 corrigido/);
  assert.doesNotMatch(html, /Regressão final/);
  assert.doesNotMatch(html, /data-page="navigation"/);
});

test('html report reflects merge and title operation data', async () => {
  const { html } = await renderOperation({
    operation: 'menu_option_8_merge',
    operationLabel: 'Corrigir conteúdo pré-capítulo: merge',
    reports: {
      'merge_precheck_report.json': { status: 'ready_for_merge', sourceCount: 2 },
      'merge_report.json': { status: 'success', chapterCount: 120, validation: { ok: true } },
      'chapter_title_normalization_report.json': { status: 'success', changed: 69, unchanged: 51 }
    }
  });

  assert.match(html, /Precheck de merge/);
  assert.match(html, /Merge de EPUBs/);
  assert.match(html, /Títulos dos capítulos/);
  assert.match(html, /120 capítulo/);
  assert.match(html, /data-page="diagnosis"/);
});

test('html report reflects reference and full pipeline data', async () => {
  const { html } = await renderOperation({
    operation: 'full_pipeline',
    operationLabel: 'Processamento completo',
    reports: {
      'chapter_report.json': { chapterCount: 120 },
      'toc_report.json': { entryCount: 120, hasNav: true, hasNcx: true },
      'validation_report.json': { ok: true, issues: [] },
      'final_regression_report.json': { ok: true, errors: [] },
      'chapter_integrity_report.json': { status: 'STRUCTURAL_ONLY', errors: [], warnings: [] }
    }
  });

  assert.match(html, /Processamento completo/);
  assert.match(html, /Capítulos detectados/);
  assert.match(html, /Regressão final/);
  assert.match(html, /Auditoria sem referência/);
  assert.match(html, /data-page="navigation"/);
});

test('html report remains self-contained with dynamic sidebar matching pages', async () => {
  const { html } = await renderOperation({
    operation: 'menu_option_5',
    operationLabel: 'Analisar / reconstruir sumário',
    reports: {
      'toc_report.json': { entryCount: 4, hasNav: false, hasNcx: true }
    }
  });

  const pages = [...html.matchAll(/<section[^>]+data-page="([^"]+)"/g)].map((match) => match[1]);
  const buttons = [...html.matchAll(/<button[^>]+data-page="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(buttons, pages);
  assert.equal((html.match(/class="page active"/g) || []).length, 1);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /cdn/i);
});

test('html report exposes chapter detection specific data', async () => {
  const { html } = await renderOperation({
    operation: 'menu_option_2',
    operationLabel: 'Detectar capítulos',
    reports: {
      'spine_chapter_report.json': {
        chapterCount: 9,
        totalDocuments: 25,
        chapters: [{ chapterNumber: 1, title: 'Capítulo 1 spine', href: 'a.xhtml', confidence: 1 }],
        sequence: { missingChapters: [2], duplicateChapters: [], outOfOrderChapters: [] },
        issues: [{ code: 'TITLE_QUALITY', href: 'a.xhtml', reason: 'TEXT_FRAGMENT_TITLE' }]
      },
      'internal_chapter_report.json': {
        source: 'internal-dom',
        ok: true,
        chapterCount: 490,
        totalDocuments: 25,
        chapters: [{ chapterNumber: 1, title: 'Capítulo 1 internal', href: 'a.xhtml', confidenceScore: 75 }],
        sequence: { detectedNumbers: [1, 490], missingChapters: [], duplicateChapters: [], outOfOrderChapters: [] },
        diagnostics: { rejectedCandidates: [{ chapterNumber: 1 }] },
        issues: []
      }
    }
  });

  assert.match(html, /Fontes de detecção/);
  assert.match(html, /Divergências de detecção/);
  assert.match(html, /Internal DOM/);
  assert.match(html, />490</);
  assert.match(html, /spine/);
  assert.match(html, /internal-dom/);
  assert.match(html, /Capítulo 1 internal/);
  assert.match(html, /data-page="sources"/);
  assert.match(html, /data-page="divergences"/);
});

test('html report exposes reference audit details', async () => {
  const { html } = await renderOperation({
    operation: 'menu_option_7',
    operationLabel: 'Usar fonte de referência',
    reports: {
      'chapter_integrity_report.json': {
        status: 'FAILED',
        reference: {
          sourceType: 'epub',
          sourceFile: 'input/reference-files/reference.epub',
          chapterCount: 120,
          adapterStatus: 'ready'
        },
        targetEpub: 'input/books/book.epub',
        chapterCount: 120,
        checkedChapters: 118,
        mode: 'reference',
        confidence: 'medium',
        warnings: [{ code: 'TITLE_MISMATCH', chapterNumber: 83, expected: 'Esperado 83', found: 'Encontrado 83' }],
        errors: [{ code: 'MISSING_CONTENT', chapterNumber: 108, expected: 'Sinal esperado', found: '' }],
        structuralIssues: [],
        boundaryIssues: [],
        missingContent: [],
        duplicatedContent: [],
        chapterMismatches: [],
        chapters: [{ chapterNumber: 83, epubTitle: 'Encontrado 83', referenceTitle: 'Esperado 83', status: 'warning' }]
      }
    }
  });

  assert.match(html, /Fonte de referência/);
  assert.match(html, /Correspondências/);
  assert.match(html, /Divergências/);
  assert.match(html, /Capítulos EPUB/);
  assert.match(html, />118</);
  assert.match(html, /TITLE_MISMATCH/);
  assert.match(html, /Esperado 83/);
  assert.match(html, /Encontrado 83/);
  assert.match(html, /MISSING_CONTENT/);
});

async function renderOperation({ operation, operationLabel, reports }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-html-integration-'));
  const context = await createReportContext({
    root,
    operation,
    operationLabel,
    inputs: ['input/books/book.epub']
  });
  for (const [name, data] of Object.entries(reports)) {
    await fs.writeJson(path.join(context.dataDir, name), data, { spaces: 2 });
  }
  await finishReportContext(context, { status: 'success', output: 'output/book.epub' });
  return {
    context,
    html: await fs.readFile(path.join(context.runDir, 'report.html'), 'utf8')
  };
}
