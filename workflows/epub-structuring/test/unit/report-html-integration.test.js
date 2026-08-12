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
      'epub_analysis_report.json': { title: 'Livro', spineItems: 3, htmlDocuments: 3 },
      'language_report.json': { match: true, detectedLanguage: 'pt-BR' }
    }
  });

  assert.match(html, /Analisar EPUB/);
  assert.match(html, /Idioma coerente/);
  assert.doesNotMatch(html, /Precheck de merge/);
  assert.doesNotMatch(html, /Conteúdo pré-capítulo detectado/);
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
