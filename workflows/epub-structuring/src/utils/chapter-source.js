export function chooseChapterReport({
  pdfCanonicalReport,
  internalChapterReport,
  spineChapterReport,
  tocReport,
  htmlCount,
  boundaryReports = {},
  pdfOptions = {}
}) {
  const internalQuality = summarizeInternalQuality(internalChapterReport);
  const spineQuality = summarizeSpineQuality(spineChapterReport, htmlCount);
  const candidates = buildSourceCandidates({
    pdfCanonicalReport,
    internalChapterReport,
    spineChapterReport,
    boundaryReports,
    pdfOptions,
    htmlCount
  });
  const accepted = candidates.filter((candidate) => candidate.accepted);
  const selected = selectBestCandidate(accepted, candidates);
  const rejectedSources = candidates
    .filter((candidate) => candidate.source !== selected.source)
    .map((candidate) => ({
      source: candidate.source,
      reason: candidate.rejectionReasons.join(';') || 'lower-quality-than-selected-source',
      quality: candidate
    }));
  const warnings = [];

  if (pdfOptions.noPdf) warnings.push({ code: 'PDF_DISABLED_BY_CLI' });
  return {
    source: selected.source,
    reason: selected.selectionReason,
    chapterReport: selected.chapterReport,
    boundaryReport: selected.boundaryReport || null,
    candidates,
    rejectedSources,
    warnings,
    comparison: { internal: internalQuality, spine: spineQuality, toc: summarizeToc(tocReport), pdf: summarizePdf(pdfCanonicalReport) }
  };
}

export function isUsableInternalReport(internalReport, spineReport) {
  const averageConfidence = internalReport.diagnostics?.confidenceSummary?.averageConfidence || 0;
  const conflicts = internalReport.diagnostics?.conflicts?.length || 0;
  const duplicates = internalReport.sequence?.duplicateChapters?.length || 0;
  const outOfOrder = internalReport.sequence?.outOfOrderChapters?.length || 0;
  return internalReport.chapterCount > spineReport.chapterCount &&
    averageConfidence >= 0.65 &&
    conflicts === 0 &&
    duplicates === 0 &&
    outOfOrder === 0;
}

function summarizeInternalQuality(report) {
  return {
    chapterCount: report.chapterCount,
    ok: report.ok,
    averageConfidence: report.diagnostics?.confidenceSummary?.averageConfidence || 0,
    conflicts: report.diagnostics?.conflicts?.length || 0,
    duplicates: report.sequence?.duplicateChapters?.length || 0,
    missing: report.sequence?.missingChapters?.length || 0,
    outOfOrder: report.sequence?.outOfOrderChapters?.length || 0
  };
}

function summarizeSpineQuality(report, htmlCount) {
  return {
    chapterCount: report.chapterCount,
    htmlCount,
    canonicalMapActive: report.canonicalMapActive,
    canonicalMapSource: report.canonicalMapSource,
    missing: report.sequence?.missingChapters?.length || 0,
    duplicates: report.sequence?.duplicateChapters?.length || 0,
    outOfOrder: report.sequence?.outOfOrderChapters?.length || 0
  };
}

function summarizeToc(report) {
  return {
    hasNcx: report.hasNcx,
    hasNav: report.hasNav,
    entryCount: report.entryCount || report.entries?.length || 0
  };
}

function summarizePdf(report) {
  return {
    source: report.source,
    pdfPath: report.pdfPath,
    mapSource: report.mapSource,
    chapterCount: report.chapterCount,
    canonicalBookId: report.canonicalBookId,
    identityValid: report.identityValid,
    matchReason: report.matchReason
  };
}

export function buildSourceCandidates({
  pdfCanonicalReport,
  internalChapterReport,
  spineChapterReport,
  boundaryReports = {},
  pdfOptions = {},
  htmlCount
}) {
  const canonicalSource = spineChapterReport.canonicalMapSource === 'known-book-map' ? 'known-canonical' : 'pdf-canonical';
  const candidates = [];

  if (spineChapterReport.canonicalMapActive) {
    const identityValid = Boolean(pdfCanonicalReport?.identityValid);
    const boundary = boundaryReports.canonical || boundaryReports.spine || null;
    candidates.push(buildCandidate({
      source: canonicalSource,
      chapterReport: { ...spineChapterReport, source: spineChapterReport.canonicalMapSource || 'canonical' },
      boundaryReport: boundary,
      identityValid,
      identityEvidence: pdfCanonicalReport?.identityEvidence || [],
      priority: canonicalSource === 'known-canonical' ? 3 : 2,
      rejectionReasons: [
        ...(!identityValid ? ['external-source-identity-not-validated'] : []),
        ...(pdfOptions.noPdf && canonicalSource === 'pdf-canonical' ? ['pdf-disabled-by-cli'] : [])
      ]
    }));
  }

  candidates.push(buildCandidate({
    source: 'internal-dom',
    chapterReport: internalChapterReport,
    boundaryReport: boundaryReports.internal || null,
    identityValid: true,
    identityEvidence: [{ type: 'same-epub-dom' }],
    priority: 1,
    rejectionReasons: internalRejectionReasons(internalChapterReport, spineChapterReport)
  }));

  candidates.push(buildCandidate({
    source: 'spine',
    chapterReport: { ...spineChapterReport, source: 'spine' },
    boundaryReport: boundaryReports.spine || null,
    identityValid: true,
    identityEvidence: [{ type: 'same-epub-spine' }],
    priority: htmlCount && spineChapterReport.chapterCount === htmlCount ? 2 : 0,
    rejectionReasons: spineRejectionReasons(spineChapterReport)
  }));

  return candidates;
}

function buildCandidate({ source, chapterReport, boundaryReport, identityValid, identityEvidence, priority, rejectionReasons }) {
  const chapterCount = chapterReport?.chapterCount || chapterReport?.chapters?.length || 0;
  const boundaryCoverage = boundaryCoverageFor(boundaryReport, chapterCount);
  const conflicts = chapterReport?.diagnostics?.conflicts?.length || 0;
  const duplicates = chapterReport?.sequence?.duplicateChapters?.length || 0;
  const outOfOrder = chapterReport?.sequence?.outOfOrderChapters?.length || 0;
  const sequenceValid = duplicates === 0 && outOfOrder === 0;
  const reasons = [
    ...rejectionReasons,
    ...(!chapterCount ? ['no-chapters'] : []),
    ...(boundaryReport && boundaryCoverage < 1 ? ['boundary-coverage-below-100'] : [])
  ];
  return {
    source,
    identityValid,
    identityEvidence,
    chapterCount,
    boundaryCoverage,
    conflicts,
    duplicates,
    sequenceValid,
    accepted: identityValid && reasons.length === 0,
    rejectionReasons: reasons,
    priority,
    score: scoreCandidate({ priority, chapterCount, boundaryCoverage, conflicts, duplicates, outOfOrder }),
    chapterReport,
    boundaryReport
  };
}

function selectBestCandidate(accepted, candidates) {
  const pool = accepted.length ? accepted : candidates.filter((candidate) => candidate.source === 'spine');
  const selected = [...pool].sort((a, b) => b.score - a.score || b.priority - a.priority || b.chapterCount - a.chapterCount)[0];
  return {
    ...selected,
    selectionReason: accepted.length
      ? `selected-best-valid-source:${selected.source}`
      : `fallback-no-valid-source:${selected.source}`
  };
}

function scoreCandidate({ priority, chapterCount, boundaryCoverage, conflicts, duplicates, outOfOrder }) {
  return Number((
    boundaryCoverage * 1000 +
    Math.min(chapterCount, 999) +
    priority * 10 -
    conflicts * 100 -
    duplicates * 100 -
    outOfOrder * 100
  ).toFixed(3));
}

function boundaryCoverageFor(boundaryReport, fallbackExpected) {
  if (!boundaryReport) return 0;
  const expected = boundaryReport.expectedCount || fallbackExpected || 0;
  const found = boundaryReport.foundCount || 0;
  return expected ? found / expected : 0;
}

function internalRejectionReasons(internalReport, spineReport) {
  const averageConfidence = internalReport?.diagnostics?.confidenceSummary?.averageConfidence || 0;
  const conflicts = internalReport?.diagnostics?.conflicts?.length || 0;
  const duplicates = internalReport?.sequence?.duplicateChapters?.length || 0;
  const outOfOrder = internalReport?.sequence?.outOfOrderChapters?.length || 0;
  return [
    ...(internalReport.chapterCount <= spineReport.chapterCount ? ['internal-dom-not-richer-than-spine'] : []),
    ...(averageConfidence < 0.65 ? ['internal-confidence-below-policy'] : []),
    ...(conflicts ? ['internal-conflicts'] : []),
    ...(duplicates ? ['internal-duplicates'] : []),
    ...(outOfOrder ? ['internal-out-of-order'] : [])
  ];
}

function spineRejectionReasons(spineReport) {
  const duplicates = spineReport?.sequence?.duplicateChapters?.length || 0;
  const outOfOrder = spineReport?.sequence?.outOfOrderChapters?.length || 0;
  return [
    ...(duplicates ? ['spine-duplicates'] : []),
    ...(outOfOrder ? ['spine-out-of-order'] : [])
  ];
}
