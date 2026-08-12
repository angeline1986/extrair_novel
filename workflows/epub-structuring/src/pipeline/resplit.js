import path from 'path';
import { analyzeChapterBoundaries } from '../analyzers/chapter-boundary-analyzer.js';
import { buildChapterRanges } from '../analyzers/chapter-range-builder.js';
import { performCanonicalResplit } from '../segmenters/canonical-resplitter.js';

export function prepareResplitPrecheck({ epub, chapterReport, chapterSourceDecision }) {
  const boundaryReport = chapterSourceDecision.boundaryReport || analyzeChapterBoundaries(epub, chapterReport);
  const resplitPrecheckReport = buildResplitPrecheckReport({ chapterReport, boundaryReport, chapterSourceDecision });
  return { boundaryReport, resplitPrecheckReport };
}

export function runResplit({ root, epub, chapterReport, boundaryReport, chapterSourceDecision, teaserRange }, options = {}) {
  const { log = () => {} } = options;

  assertSafeForResplit({ chapterReport, boundaryReport, chapterSourceDecision });

  log('Construindo ranges de capítulos...');
  const rangeReport = buildChapterRanges(boundaryReport, epub);
  if (teaserRange && chapterSourceDecision.source === 'internal-dom') {
    rangeReport.supplementalRanges = [teaserRange];
  }
  log(`Ranges construídos: ${rangeReport.rangeCount}`);

  log('Executando resplit dos capítulos...');
  const chaptersDir = path.join(root, 'output', 'chapters');
  const resplitReport = performCanonicalResplit(rangeReport, boundaryReport, epub, chaptersDir);
  if (resplitReport.ok !== true) {
    throw new Error(`Resplit inseguro: ${resplitReport.chapterCount}/${rangeReport.rangeCount} capítulos gerados corretamente.`);
  }
  log(`Resplit concluído: ${resplitReport.chapterCount} capítulos gerados.`);

  return { rangeReport, chaptersDir, resplitReport };
}

function assertSafeForResplit({ chapterReport, boundaryReport, chapterSourceDecision }) {
  const reportHint = 'Consulte reports/internal_chapter_report.json, reports/chapter_source_report.json, reports/boundary_report.json e reports/resplit_precheck_report.json.';
  if (!chapterReport?.chapters?.length) {
    throw new Error(`Resplit bloqueado: nenhum capítulo foi selecionado. ${reportHint}`);
  }
  if (chapterSourceDecision.source === 'internal-dom') {
    const conflicts = chapterReport.diagnostics?.conflicts?.length || 0;
    const averageConfidence = chapterReport.diagnostics?.confidenceSummary?.averageConfidence || 0;
    if (conflicts > 0) throw new Error(`Resplit bloqueado: ${conflicts} conflitos fortes na descoberta interna. ${reportHint}`);
    if (averageConfidence < 0.65) throw new Error(`Resplit bloqueado: confiança média interna ${averageConfidence} abaixo da política. ${reportHint}`);
  }

  const expected = boundaryReport.expectedCount || chapterReport.chapters.length;
  const found = boundaryReport.foundCount || 0;
  const coverage = expected ? found / expected : 0;
  if (coverage < 1) {
    throw new Error(`Resplit bloqueado: cobertura de boundaries ${(coverage * 100).toFixed(2)}% (${found}/${expected}). ${reportHint}`);
  }
}

function buildResplitPrecheckReport({ chapterReport, boundaryReport, chapterSourceDecision }) {
  const expected = boundaryReport.expectedCount || chapterReport.chapters?.length || 0;
  const found = boundaryReport.foundCount || 0;
  const boundaryCoverage = expected ? found / expected : 0;
  return {
    generatedAt: new Date().toISOString(),
    ok: Boolean(chapterReport.chapters?.length) && boundaryCoverage >= 1,
    selectedSource: chapterSourceDecision.source,
    selectedReason: chapterSourceDecision.reason,
    expectedChapterCount: expected,
    locatedBoundaryCount: found,
    boundaryCoverage,
    blockingIssues: [
      ...(!chapterReport.chapters?.length ? [{ code: 'NO_SELECTED_CHAPTERS' }] : []),
      ...(boundaryCoverage < 1 ? [{ code: 'BOUNDARY_COVERAGE_BELOW_POLICY', expectedChapterCount: expected, locatedBoundaryCount: found, boundaryCoverage }] : [])
    ],
    reportFiles: [
      'reports/internal_chapter_report.json',
      'reports/chapter_source_report.json',
      'reports/boundary_report.json',
      'reports/resplit_precheck_report.json'
    ]
  };
}
