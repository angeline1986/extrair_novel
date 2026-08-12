import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';

export function runFinalRegressionValidation(reportsDir, epubPath) {
  const checks = [];
  const errors = [];
  const warnings = [];

  // 1. Relatórios existem
  const reports = {
    chapterReport: loadReport(reportsDir, 'chapter_report.json', checks, errors),
    tocReport: loadReport(reportsDir, 'toc_report.json', checks, errors),
    structureReport: loadReport(reportsDir, 'structure_report.json', checks, errors),
    validationReport: loadReport(reportsDir, 'validation_report.json', checks, errors),
    resplitReport: loadReport(reportsDir, 'chapter_resplit_report.json', checks, errors)
  };

  const expectation = buildApprovedExpectation(reports, checks, errors);

  // 2. Contagens esperadas pela estrutura aprovada da execução
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

  // 3. TOC entryCount esperado pela estrutura aprovada da execução
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
  
  const allCountsEqual = Boolean(expectation) && counts.length > 0 && counts.every(c => c.count === expectation.chapterCount);
  checks.push({ code: 'COUNT_CONSISTENCY', ok: allCountsEqual, message: allCountsEqual ? `Todos os relatórios concordam sobre ${expectation.chapterCount} capítulos.` : 'Relatórios não concordam sobre contagem de capítulos.' });
  if (!allCountsEqual) errors.push({ code: 'COUNT_CONSISTENCY', message: `Contagens inconsistentes: ${JSON.stringify(counts)}.` });

  // 6. TOC aponta para os XHTMLs gerados no resplit aprovado
  if (reports.tocReport && reports.tocReport.entries && expectation) {
    const expectedHrefs = expectation.hrefs;
    const actualHrefs = reports.tocReport.entries.map(e => path.basename(e.src));
    const missing = expectedHrefs.filter(h => !actualHrefs.includes(h));
    const unexpected = actualHrefs.filter(h => !expectedHrefs.includes(h));
    const ok = missing.length === 0 && unexpected.length === 0;
    checks.push({ code: 'TOC_HREFS', ok, message: ok ? 'TOC aponta para os XHTMLs gerados no resplit aprovado.' : `TOC hrefs incorretos. Faltam: ${missing.join(', ')}. Extras: ${unexpected.join(', ')}.` });
    if (!ok) errors.push({ code: 'TOC_HREFS', message: `TOC hrefs incorretos. Faltam: ${missing.join(', ')}. Extras: ${unexpected.join(', ')}.` });
  }

  // 7. Structure aponta para os XHTMLs gerados no resplit aprovado
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

  // 9. EPUB contém nav.xhtml
  if (epubExists) {
    try {
      const zip = new AdmZip(epubPath);
      const hasNav = zip.getEntries().some(e => e.entryName.endsWith('nav.xhtml'));
      checks.push({ code: 'EPUB_HAS_NAV', ok: hasNav, message: hasNav ? 'EPUB contém nav.xhtml.' : 'EPUB não contém nav.xhtml.' });
      if (!hasNav) errors.push({ code: 'EPUB_HAS_NAV', message: 'EPUB não contém nav.xhtml.' });
    } catch (e) {
      checks.push({ code: 'EPUB_HAS_NAV', ok: false, message: `Erro ao verificar nav.xhtml: ${e.message}.` });
      errors.push({ code: 'EPUB_HAS_NAV', message: `Erro ao verificar nav.xhtml: ${e.message}.` });
    }
  }

  // 10. EPUB contém toc.ncx
  if (epubExists) {
    try {
      const zip = new AdmZip(epubPath);
      const hasNcx = zip.getEntries().some(e => e.entryName.endsWith('toc.ncx'));
      checks.push({ code: 'EPUB_HAS_NCX', ok: hasNcx, message: hasNcx ? 'EPUB contém toc.ncx.' : 'EPUB não contém toc.ncx.' });
      if (!hasNcx) errors.push({ code: 'EPUB_HAS_NCX', message: 'EPUB não contém toc.ncx.' });
    } catch (e) {
      checks.push({ code: 'EPUB_HAS_NCX', ok: false, message: `Erro ao verificar toc.ncx: ${e.message}.` });
      errors.push({ code: 'EPUB_HAS_NCX', message: `Erro ao verificar toc.ncx: ${e.message}.` });
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

function loadReport(reportsDir, fileName, checks, errors) {
  const reportPath = path.join(reportsDir, fileName);
  if (!fs.existsSync(reportPath)) {
    checks.push({ code: `REPORT_${fileName}`, ok: false, message: `${fileName} não encontrado.` });
    errors.push({ code: `REPORT_${fileName}`, message: `${fileName} não encontrado.` });
    return null;
  }
  
  try {
    return fs.readJsonSync(reportPath);
  } catch (e) {
    checks.push({ code: `REPORT_${fileName}`, ok: false, message: `Erro ao ler ${fileName}: ${e.message}.` });
    errors.push({ code: `REPORT_${fileName}`, message: `Erro ao ler ${fileName}: ${e.message}.` });
    return null;
  }
}

function buildApprovedExpectation(reports, checks, errors) {
  const chapterCount = reports.chapterReport?.chapterCount;
  const selectedChapters = reports.chapterReport?.chapters || [];
  const resplitChapters = reports.resplitReport?.chapters || [];
  const resplitCount = reports.resplitReport?.chapterCount;
  const hrefs = resplitChapters
    .filter((chapter) => chapter?.outputFile)
    .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))
    .map((chapter) => path.basename(chapter.outputFile));

  const ok = Number.isInteger(chapterCount) &&
    chapterCount > 0 &&
    selectedChapters.length === chapterCount &&
    resplitCount === chapterCount &&
    hrefs.length === chapterCount;

  checks.push({
    code: 'APPROVED_EXPECTATION',
    ok,
    message: ok
      ? `Expectativa aprovada da execução: ${chapterCount} capítulos.`
      : `Expectativa aprovada indisponível ou inconsistente: chapterCount=${chapterCount}, selected=${selectedChapters.length}, resplitCount=${resplitCount}, hrefs=${hrefs.length}.`
  });

  if (!ok) {
    errors.push({
      code: 'APPROVED_EXPECTATION',
      message: `Não foi possível derivar expectativa aprovada sem circularidade. chapterCount=${chapterCount}, selected=${selectedChapters.length}, resplitCount=${resplitCount}, hrefs=${hrefs.length}.`
    });
    return null;
  }

  return { chapterCount, hrefs };
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
