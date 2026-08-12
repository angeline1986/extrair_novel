import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import { getValidationBaselinePath, readValidationBaseline } from './validation-baseline.js';

export function runFinalRegressionValidation(reportsDir, epubPath, options = {}) {
  const checks = [];
  const errors = [];
  const warnings = [];
  const baselinePath = options.baselinePath || getValidationBaselinePath(path.dirname(reportsDir));

  const expectation = loadApprovedExpectation(baselinePath, checks, errors);

  // 1. Relatórios existentes são evidência complementar, não fonte de expectativa.
  const reports = {
    chapterReport: loadOptionalReport(reportsDir, 'chapter_report.json', warnings),
    tocReport: loadOptionalReport(reportsDir, 'toc_report.json', warnings),
    structureReport: loadOptionalReport(reportsDir, 'structure_report.json', warnings),
    validationReport: loadOptionalReport(reportsDir, 'validation_report.json', warnings),
    resplitReport: loadOptionalReport(reportsDir, 'chapter_resplit_report.json', warnings)
  };

  // 2. Contagens esperadas pelo baseline persistente aprovado.
  if (reports.chapterReport && expectation) {
    const actual = reports.chapterReport.chapterCount;
    const ok = actual === expectation.chapterCount;
    checks.push({ code: 'CHAPTER_COUNT', ok, message: ok ? `chapter_report.json chapterCount = ${expectation.chapterCount}.` : `chapter_report.json chapterCount = ${actual}, esperado ${expectation.chapterCount}.` });
    if (!ok) errors.push({ code: 'CHAPTER_COUNT', message: `chapter_report.json chapterCount = ${actual}, esperado ${expectation.chapterCount}.` });
  }

  if (reports.structureReport) {
    const actual = reports.structureReport.summary?.chapterCount;
    const ok = expectation ? actual === expectation.chapterCount : false;
    checks.push({ code: 'STRUCTURE_CHAPTER_COUNT', ok, message: ok ? `structure_report.json chapterCount = ${expectation.chapterCount}.` : `structure_report.json chapterCount = ${actual}, esperado ${expectation?.chapterCount ?? 'indisponível'}.` });
    if (!ok) errors.push({ code: 'STRUCTURE_CHAPTER_COUNT', message: `structure_report.json chapterCount = ${actual}, esperado ${expectation?.chapterCount ?? 'indisponível'}.` });
  }

  // 3. TOC entryCount esperado pelo baseline persistente aprovado.
  if (reports.tocReport) {
    const actual = reports.tocReport.entryCount;
    const ok = expectation ? actual === expectation.chapterCount : false;
    checks.push({ code: 'TOC_ENTRY_COUNT', ok, message: ok ? `toc_report.json entryCount = ${expectation.chapterCount}.` : `toc_report.json entryCount = ${actual}, esperado ${expectation?.chapterCount ?? 'indisponível'}.` });
    if (!ok) errors.push({ code: 'TOC_ENTRY_COUNT', message: `toc_report.json entryCount = ${actual}, esperado ${expectation?.chapterCount ?? 'indisponível'}.` });
  }

  // 4. validation ok = true
  if (reports.validationReport) {
    const ok = reports.validationReport.ok === true;
    checks.push({ code: 'VALIDATION_OK', ok, message: ok ? 'validation_report.json ok = true.' : `validation_report.json ok = ${reports.validationReport.ok}.` });
    if (!ok) errors.push({ code: 'VALIDATION_OK', message: `validation_report.json ok = ${reports.validationReport.ok}.` });

    // Permitir LANGUAGE_MISMATCH warning
    if (reports.validationReport.issues) {
      const languageMismatch = reports.validationReport.issues.find(i => i.code === 'LANGUAGE_MISMATCH');
      if (languageMismatch) {
        warnings.push({ code: 'LANGUAGE_MISMATCH', message: languageMismatch.message });
      }
    }
  }

  // 5. Concordância de contagem
  const counts = [];
  if (reports.chapterReport) counts.push({ name: 'chapterReport', count: reports.chapterReport.chapterCount });
  if (reports.structureReport) counts.push({ name: 'structureReport', count: reports.structureReport.summary.chapterCount });
  if (reports.tocReport) counts.push({ name: 'tocReport', count: reports.tocReport.entryCount });
  if (reports.resplitReport) counts.push({ name: 'resplitReport', count: reports.resplitReport.chapterCount });
  
  if (counts.length > 0) {
    const allCountsEqual = Boolean(expectation) && counts.every(c => c.count === expectation.chapterCount);
    checks.push({ code: 'COUNT_CONSISTENCY', ok: allCountsEqual, message: allCountsEqual ? `Todos os relatórios disponíveis concordam sobre ${expectation.chapterCount} capítulos.` : 'Relatórios disponíveis não concordam sobre contagem de capítulos.' });
    if (!allCountsEqual) errors.push({ code: 'COUNT_CONSISTENCY', message: `Contagens inconsistentes: ${JSON.stringify(counts)}.` });
  } else {
    warnings.push({ code: 'REPORTS_UNAVAILABLE', message: 'Relatórios complementares ausentes; validação seguirá pelo baseline persistente e pelo EPUB final.' });
  }

  // 6. TOC aponta para os XHTMLs aprovados no baseline.
  if (reports.tocReport && reports.tocReport.entries && expectation) {
    const expectedHrefs = expectation.hrefs;
    const actualHrefs = reports.tocReport.entries.map(e => path.basename(e.src));
    const missing = expectedHrefs.filter(h => !actualHrefs.includes(h));
    const unexpected = actualHrefs.filter(h => !expectedHrefs.includes(h));
    const ok = missing.length === 0 && unexpected.length === 0;
    checks.push({ code: 'TOC_HREFS', ok, message: ok ? 'TOC aponta para os XHTMLs gerados no resplit aprovado.' : `TOC hrefs incorretos. Faltam: ${missing.join(', ')}. Extras: ${unexpected.join(', ')}.` });
    if (!ok) errors.push({ code: 'TOC_HREFS', message: `TOC hrefs incorretos. Faltam: ${missing.join(', ')}. Extras: ${unexpected.join(', ')}.` });
  }

  // 7. Structure aponta para os XHTMLs aprovados no baseline.
  if (reports.structureReport && reports.structureReport.chapters && expectation) {
    const expectedHrefs = expectation.hrefs;
    const actualHrefs = reports.structureReport.chapters.map(c => path.basename(c.href));
    const missing = expectedHrefs.filter(h => !actualHrefs.includes(h));
    const unexpected = actualHrefs.filter(h => !expectedHrefs.includes(h));
    const ok = missing.length === 0 && unexpected.length === 0;
    checks.push({ code: 'STRUCTURE_HREFS', ok, message: ok ? 'Structure aponta para os XHTMLs gerados no resplit aprovado.' : `Structure hrefs incorretos. Faltam: ${missing.join(', ')}. Extras: ${unexpected.join(', ')}.` });
    if (!ok) errors.push({ code: 'STRUCTURE_HREFS', message: `Structure hrefs incorretos. Faltam: ${missing.join(', ')}. Extras: ${unexpected.join(', ')}.` });
  }

  // 8. EPUB final existe
  const epubExists = fs.existsSync(epubPath);
  checks.push({ code: 'EPUB_EXISTS', ok: epubExists, message: epubExists ? 'EPUB final existe.' : 'EPUB final não encontrado.' });
  if (!epubExists) errors.push({ code: 'EPUB_EXISTS', message: 'EPUB final não encontrado.' });

  // 9. EPUB contém nav.xhtml, toc.ncx e os XHTMLs esperados.
  if (epubExists) {
    try {
      const zip = new AdmZip(epubPath);
      const hasNav = zip.getEntries().some(e => e.entryName.endsWith('nav.xhtml'));
      checks.push({ code: 'EPUB_HAS_NAV', ok: hasNav, message: hasNav ? 'EPUB contém nav.xhtml.' : 'EPUB não contém nav.xhtml.' });
      if (!hasNav) errors.push({ code: 'EPUB_HAS_NAV', message: 'EPUB não contém nav.xhtml.' });

      const hasNcx = zip.getEntries().some(e => e.entryName.endsWith('toc.ncx'));
      checks.push({ code: 'EPUB_HAS_NCX', ok: hasNcx, message: hasNcx ? 'EPUB contém toc.ncx.' : 'EPUB não contém toc.ncx.' });
      if (!hasNcx) errors.push({ code: 'EPUB_HAS_NCX', message: 'EPUB não contém toc.ncx.' });

      if (expectation) {
        const entryBasenames = zip.getEntries().map((entry) => path.basename(entry.entryName));
        const missing = expectation.hrefs.filter((href) => !entryBasenames.includes(path.basename(href)));
        const ok = missing.length === 0;
        checks.push({ code: 'EPUB_CHAPTER_HREFS', ok, message: ok ? 'EPUB contém todos os XHTMLs aprovados no baseline.' : `EPUB não contém XHTMLs esperados: ${missing.join(', ')}.` });
        if (!ok) errors.push({ code: 'EPUB_CHAPTER_HREFS', message: `EPUB não contém XHTMLs esperados: ${missing.join(', ')}.` });
      }
    } catch (e) {
      checks.push({ code: 'EPUB_PACKAGE', ok: false, message: `Erro ao verificar pacote EPUB: ${e.message}.` });
      errors.push({ code: 'EPUB_PACKAGE', message: `Erro ao verificar pacote EPUB: ${e.message}.` });
    }
  }

  const ok = errors.length === 0;
  const summary = buildSummary(reports);

  return {
    ok,
    checkedAt: new Date().toISOString(),
    summary,
    checks,
    errors,
    warnings
  };
}

function loadApprovedExpectation(baselinePath, checks, errors) {
  if (!fs.existsSync(baselinePath)) {
    checks.push({ code: 'VALIDATION_BASELINE', ok: false, message: `Baseline de validação não encontrado: ${baselinePath}.` });
    errors.push({ code: 'VALIDATION_BASELINE', message: `Baseline de validação não encontrado: ${baselinePath}.` });
    return null;
  }

  try {
    const baseline = readValidationBaseline(baselinePath);
    const expected = baseline.expected || {};
    const hrefs = expected.chapterHrefs || [];
    const chapterCount = expected.chapterCount;
    const ok = baseline.schemaVersion === 1 &&
      expected.consistent === true &&
      Number.isInteger(chapterCount) &&
      chapterCount > 0 &&
      hrefs.length === chapterCount;

    checks.push({
      code: 'VALIDATION_BASELINE',
      ok,
      message: ok
        ? `Baseline persistente aprovado: ${chapterCount} capítulos.`
        : `Baseline persistente inválido: schemaVersion=${baseline.schemaVersion}, chapterCount=${chapterCount}, hrefs=${hrefs.length}, consistent=${expected.consistent}.`
    });

    if (!ok) {
      errors.push({ code: 'VALIDATION_BASELINE', message: 'Baseline persistente ausente, inválido ou inconsistente.' });
      return null;
    }

    return { chapterCount, hrefs };
  } catch (e) {
    checks.push({ code: 'VALIDATION_BASELINE', ok: false, message: `Erro ao ler baseline de validação: ${e.message}.` });
    errors.push({ code: 'VALIDATION_BASELINE', message: `Erro ao ler baseline de validação: ${e.message}.` });
    return null;
  }
}

function loadOptionalReport(reportsDir, fileName, warnings) {
  const reportPath = path.join(reportsDir, fileName);
  if (!fs.existsSync(reportPath)) {
    warnings.push({ code: `REPORT_${fileName}`, message: `${fileName} não encontrado.` });
    return null;
  }

  try {
    return fs.readJsonSync(reportPath);
  } catch (e) {
    warnings.push({ code: `REPORT_${fileName}`, message: `Erro ao ler ${fileName}: ${e.message}.` });
    return null;
  }
}

function buildSummary(reports) {
  return {
    chapterCount: reports.chapterReport?.chapterCount || 0,
    tocEntryCount: reports.tocReport?.entryCount || 0,
    structureChapterCount: reports.structureReport?.summary?.chapterCount || 0,
    validationOk: reports.validationReport?.ok || false,
    hasNav: reports.tocReport?.hasNav || false,
    hasNcx: reports.tocReport?.hasNcx || false
  };
}
