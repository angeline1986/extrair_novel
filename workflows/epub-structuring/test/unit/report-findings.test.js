import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportPresentation, formatFindingForTerminal } from '../../src/utils/report-findings.js';

test('report presentation derives shared findings and suggested actions from existing reports', () => {
  const presentation = buildReportPresentation({
    run: { status: 'success' },
    reports: {
      'chapter_report.json': { chapterCount: 3 },
      'toc_report.json': { entryCount: 3, hasNav: false, hasNcx: true },
      'validation_report.json': { ok: true, issues: [] },
      'final_regression_report.json': { ok: false, errors: [{ code: 'TOC_HREFS' }] }
    }
  });

  assert.equal(presentation.result.status, 'PROBLEMA');
  assert.ok(presentation.findings.some((finding) => finding.severity === 'ok' && finding.title === 'Capítulos detectados'));
  assert.ok(presentation.findings.some((finding) => finding.severity === 'warning' && finding.title === 'NAV ausente'));
  assert.ok(presentation.findings.some((finding) => finding.severity === 'problem' && finding.title === 'Regressão final'));
  assert.ok(presentation.actions.some((action) => /corrija os erros/i.test(action)));
});

test('terminal formatter uses the same severity labels as report presentation', () => {
  const presentation = buildReportPresentation({
    reports: {
      'menu_epub_validation_report.json': {
        checks: [
          { label: 'NAV', ok: false, warningOnly: true, source: 'analyzeToc' },
          { label: 'NCX', ok: true, source: 'analyzeToc' }
        ]
      }
    }
  });

  const lines = presentation.findings.map(formatFindingForTerminal);
  assert.ok(lines.some((line) => line.startsWith('⚠ ATENÇÃO: NAV')));
  assert.ok(lines.some((line) => line.startsWith('✓ OK: NCX')));
});
