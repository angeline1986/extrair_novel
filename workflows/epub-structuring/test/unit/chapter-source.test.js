import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseChapterReport } from '../../src/utils/chapter-source.js';

test('chooseChapterReport rejects EPUB A with PDF from another book and selects internal-dom', () => {
  const spine = spineReport({ chapterCount: 33, canonicalMapActive: true, canonicalMapSource: 'pdf-text' });
  const internal = internalReport({ chapterCount: 481, averageConfidence: 0.9 });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    pdf: pdfReport({ chapterCount: 33, identityValid: false }),
    boundaryReports: { spine: boundary(33, 27), canonical: boundary(33, 27), internal: boundary(481, 481) }
  }));

  assert.equal(decision.source, 'internal-dom');
  assert.equal(decision.chapterReport, internal);
  assert.equal(decision.candidates.find((candidate) => candidate.source === 'pdf-canonical').accepted, false);
});

test('chooseChapterReport can select matching complete PDF canonical source', () => {
  const spine = spineReport({ chapterCount: 25, canonicalMapActive: true, canonicalMapSource: 'known-book-map' });
  const internal = internalReport({ chapterCount: 260, averageConfidence: 0.9 });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    pdf: pdfReport({ chapterCount: 25, identityValid: true, mapSource: 'known-book-map', canonicalBookId: 'book-a' }),
    boundaryReports: { spine: boundary(25, 25), canonical: boundary(25, 25), internal: boundary(260, 200) }
  }));

  assert.equal(decision.source, 'known-canonical');
  assert.equal(decision.chapterReport.chapterCount, 25);
});

test('chooseChapterReport lets structurally superior internal-dom beat matching low-coverage PDF', () => {
  const spine = spineReport({ chapterCount: 33, canonicalMapActive: true, canonicalMapSource: 'pdf-text' });
  const internal = internalReport({ chapterCount: 481, averageConfidence: 0.9 });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    pdf: pdfReport({ chapterCount: 33, identityValid: true }),
    boundaryReports: { spine: boundary(33, 27), canonical: boundary(33, 27), internal: boundary(481, 481) }
  }));

  assert.equal(decision.source, 'internal-dom');
});

test('chooseChapterReport selects internal discovery when it is coherent and richer than spine', () => {
  const spine = spineReport({ chapterCount: 51 });
  const internal = internalReport({ chapterCount: 260, averageConfidence: 0.88 });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    boundaryReports: { spine: boundary(51, 51), internal: boundary(260, 260) }
  }));

  assert.equal(decision.source, 'internal-dom');
  assert.equal(decision.chapterReport, internal);
});

test('chooseChapterReport keeps spine for one HTML per chapter compatibility', () => {
  const spine = spineReport({ chapterCount: 3 });
  const internal = internalReport({ chapterCount: 3, averageConfidence: 0.9 });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    htmlCount: 3,
    boundaryReports: { spine: boundary(3, 3), internal: boundary(3, 3) }
  }));

  assert.equal(decision.source, 'spine');
});

test('chooseChapterReport rejects internal reports with conflicts', () => {
  const spine = spineReport({ chapterCount: 51 });
  const internal = internalReport({ chapterCount: 260, averageConfidence: 0.9, conflicts: [{}] });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    boundaryReports: { spine: boundary(51, 51), internal: boundary(260, 260) }
  }));

  assert.equal(decision.source, 'spine');
  assert.equal(decision.rejectedSources[0].source, 'internal-dom');
});

test('chooseChapterReport records --no-pdf and ignores pdf candidate when none is active', () => {
  const spine = spineReport({ chapterCount: 51 });
  const internal = internalReport({ chapterCount: 260, averageConfidence: 0.88 });

  const decision = chooseChapterReport(baseInput({
    spine,
    internal,
    pdfOptions: { noPdf: true },
    boundaryReports: { spine: boundary(51, 51), internal: boundary(260, 260) }
  }));

  assert.equal(decision.source, 'internal-dom');
  assert.equal(decision.warnings[0].code, 'PDF_DISABLED_BY_CLI');
});

function baseInput({ spine, internal, htmlCount = 51, pdf = null, boundaryReports = {}, pdfOptions = {} }) {
  return {
    pdfCanonicalReport: pdf || pdfReport({ chapterCount: 0, identityValid: false, source: null }),
    internalChapterReport: internal,
    spineChapterReport: spine,
    tocReport: { hasNcx: true, hasNav: false, entryCount: 1, entries: [{ label: 'Start' }] },
    htmlCount,
    boundaryReports,
    pdfOptions
  };
}

function spineReport({ chapterCount, canonicalMapActive = false, canonicalMapSource = null }) {
  return {
    chapterCount,
    canonicalMapActive,
    canonicalMapSource,
    sequence: { missingChapters: [], duplicateChapters: [], outOfOrderChapters: [] },
    chapters: Array.from({ length: chapterCount }, (_, index) => ({ chapterNumber: index + 1 }))
  };
}

function internalReport({ chapterCount, averageConfidence, conflicts = [] }) {
  return {
    source: 'internal-dom',
    ok: conflicts.length === 0,
    chapterCount,
    sequence: { missingChapters: [], duplicateChapters: [], outOfOrderChapters: [] },
    diagnostics: {
      confidenceSummary: { averageConfidence },
      conflicts
    },
    chapters: Array.from({ length: chapterCount }, (_, index) => ({ chapterNumber: index + 1 }))
  };
}

function pdfReport({ chapterCount, identityValid, source = 'book.pdf', mapSource = 'pdf-text', canonicalBookId = null }) {
  return {
    source,
    pdfPath: source,
    mapSource,
    canonicalBookId,
    chapterCount,
    identityValid,
    identityEvidence: identityValid ? [{ type: 'test-match' }] : [],
    matchReason: identityValid ? 'test-match' : 'test-mismatch',
    chapters: Array.from({ length: chapterCount }, (_, index) => ({ chapterNumber: index + 1 }))
  };
}

function boundary(expectedCount, foundCount) {
  return {
    expectedCount,
    foundCount,
    ok: expectedCount === foundCount,
    chapters: Array.from({ length: foundCount }, (_, index) => ({ chapterNumber: index + 1 }))
  };
}
