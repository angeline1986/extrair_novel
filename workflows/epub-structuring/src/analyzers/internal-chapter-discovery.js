import * as cheerio from 'cheerio';
import { validateChapterSequence } from './chapter-sequence-validator.js';
import { parseChapterHeading, normalizeChapterTitle } from '../utils/chapter-parser.js';
import { readZipText } from '../utils/zip-utils.js';
import { collectDomChapterCandidates } from '../utils/dom-chapter-candidates.js';

const TAG_PRIORITY = new Map([
  ['h1', 8],
  ['h2', 7],
  ['h3', 6],
  ['p', 5],
  ['div', 4],
  ['strong', 3],
  ['b', 2],
  ['span', 1]
]);

export function detectInternalChapters(epub, htmlDocs = []) {
  const spineDocs = epub.spineItems
    .filter((item) => isHtml(item.mediaType) && !isFrontmatter(item.href))
    .map((item, spineIndex) => ({
      ...item,
      spineIndex,
      html: readZipText(epub.zip, item.fullPath),
      doc: htmlDocs.find((doc) => doc.fullPath === item.fullPath)
    }));

  const rawCandidates = [];
  for (const doc of spineDocs) {
    rawCandidates.push(...collectCandidates(doc));
  }

  const { candidates, duplicateCandidates } = dedupeLocalCandidates(rawCandidates);
  const { accepted, conflicts, globalDuplicates } = dedupeGlobalCandidates(candidates);
  const chapters = accepted.map((candidate, index) => buildChapter(candidate, index));
  const sequence = validateChapterSequence(chapters);
  const diagnostics = buildDiagnostics({
    rawCandidates,
    accepted,
    duplicateCandidates: [...duplicateCandidates, ...globalDuplicates],
    conflicts,
    sequence,
    spineDocs
  });

  return {
    generatedAt: new Date().toISOString(),
    source: 'internal-dom',
    canonicalMapActive: false,
    canonicalMapSource: null,
    totalDocuments: spineDocs.length,
    chapterCount: chapters.length,
    documents: buildDocuments(epub, htmlDocs),
    chapters,
    sequence,
    issues: buildIssues(sequence, conflicts),
    diagnostics,
    ok: chapters.length > 0 && conflicts.length === 0
  };
}

function collectCandidates(doc) {
  const $ = cheerio.load(doc.html, { xmlMode: true, decodeEntities: true });
  return collectDomChapterCandidates($, 'body', { sourceHref: doc.href, spineIndex: doc.spineIndex })
    .map((candidate) => {
      const parsed = parseChapterHeading(candidate.text, { tagName: candidate.tagName });
      if (!parsed.matched) return null;
      if (!candidate.combined && parsed.format === 'numbered-punctuation') return null;
      return {
      ...parsed,
      href: doc.href,
      fullPath: doc.fullPath,
      sourceHref: doc.href,
      sourceFullPath: doc.fullPath,
      spineIndex: doc.spineIndex,
      position: candidate.position,
      tagName: candidate.tagName,
      domPath: candidate.domPath,
      titleDomPath: candidate.titleDomPath || null,
      combined: candidate.combined,
      headingText: candidate.headingText || null,
      titleText: candidate.titleText || null,
      normalizedTitle: normalizeChapterTitle(parsed.title),
      normalizedTextHash: normalizeChapterTitle(parsed.originalText)
      };
    })
    .filter(Boolean);
}

function dedupeLocalCandidates(candidates) {
  const byKey = new Map();
  const duplicateCandidates = [];

  for (const candidate of candidates) {
    const key = [
      candidate.sourceHref,
      candidate.chapterNumber,
      candidate.normalizedTitle,
      candidate.normalizedTextHash
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    const kept = chooseBetterCandidate(existing, candidate);
    const rejected = kept === existing ? candidate : existing;
    duplicateCandidates.push({ reason: 'local-duplicate', kept: summarizeCandidate(kept), rejected: summarizeCandidate(rejected) });
    byKey.set(key, kept);
  }

  return {
    candidates: [...byKey.values()].sort(comparePhysicalOrder),
    duplicateCandidates
  };
}

function dedupeGlobalCandidates(candidates) {
  const accepted = [];
  const byNumber = new Map();
  const conflicts = [];
  const globalDuplicates = [];

  for (const candidate of candidates.sort(comparePhysicalOrder)) {
    const existing = byNumber.get(candidate.chapterNumber);
    if (!existing) {
      byNumber.set(candidate.chapterNumber, candidate);
      accepted.push(candidate);
      continue;
    }

    if (existing.normalizedTitle === candidate.normalizedTitle) {
      globalDuplicates.push({ reason: 'global-duplicate-same-title', kept: summarizeCandidate(existing), rejected: summarizeCandidate(candidate) });
      continue;
    }

    conflicts.push({
      reason: 'global-duplicate-conflicting-title',
      chapterNumber: candidate.chapterNumber,
      first: summarizeCandidate(existing),
      second: summarizeCandidate(candidate)
    });
  }

  return { accepted, conflicts, globalDuplicates };
}

function buildChapter(candidate, index) {
  return {
    index,
    idref: null,
    href: candidate.href,
    fullPath: candidate.fullPath,
    title: candidate.displayTitle,
    detectedTitle: candidate.originalText,
    finalTitle: candidate.displayTitle,
    role: 'chapter',
    confidence: candidate.confidence,
    confidenceScore: candidate.confidenceScore,
    confidenceReasons: candidate.confidenceReasons,
    titleScore: 100,
    titleQuality: { quality: 'valid', reason: 'INTERNAL_CHAPTER_PATTERN' },
    wordCount: 0,
    textLength: 0,
    tocLabel: null,
    chapterNumber: candidate.chapterNumber,
    titleSource: 'internal-dom',
    sourceHref: candidate.sourceHref,
    spineIndex: candidate.spineIndex,
    domPath: candidate.domPath,
    detectionSource: 'internal-dom'
  };
}

function buildDocuments(epub, htmlDocs) {
  const byPath = new Map(htmlDocs.map((doc) => [doc.fullPath, doc]));
  return epub.spineItems.filter((item) => isHtml(item.mediaType)).map((item, index) => {
    const doc = byPath.get(item.fullPath);
    return {
      index,
      idref: item.idref || '',
      href: item.href,
      fullPath: item.fullPath,
      title: doc?.heading || doc?.title || item.href,
      detectedTitle: doc?.heading || doc?.title || item.href,
      finalTitle: null,
      role: isFrontmatter(item.href) ? 'frontmatter' : 'source-document',
      confidence: 0,
      titleScore: 0,
      titleQuality: { quality: 'valid', reason: 'SOURCE_DOCUMENT' },
      wordCount: doc?.wordCount || 0,
      textLength: doc?.textLength || 0,
      tocLabel: null,
      titleSource: 'source-document'
    };
  });
}

function buildDiagnostics({ rawCandidates, accepted, duplicateCandidates, conflicts, sequence, spineDocs }) {
  const confidenceValues = accepted.map((candidate) => candidate.confidence);
  const averageConfidence = confidenceValues.length
    ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
    : 0;

  return {
    totalCandidates: rawCandidates.length,
    acceptedCandidates: accepted.length,
    rejectedCandidates: [],
    duplicateCandidates,
    conflicts,
    sequenceReport: sequence,
    confidenceSummary: {
      averageConfidence,
      minConfidence: confidenceValues.length ? Math.min(...confidenceValues) : 0,
      maxConfidence: confidenceValues.length ? Math.max(...confidenceValues) : 0
    },
    affectedFiles: [...new Set(accepted.map((candidate) => candidate.sourceHref))],
    composedCandidates: rawCandidates.filter((candidate) => candidate.combined).length,
    sourceDocumentCount: spineDocs.length,
    firstChapter: accepted[0] ? summarizeCandidate(accepted[0]) : null,
    lastChapter: accepted.at(-1) ? summarizeCandidate(accepted.at(-1)) : null
  };
}

function buildIssues(sequence, conflicts) {
  const issues = [];
  if (sequence.missingChapters.length) {
    issues.push({ code: 'INTERNAL_MISSING_CHAPTERS', missingChapters: sequence.missingChapters });
  }
  if (sequence.duplicateChapters.length) {
    issues.push({ code: 'INTERNAL_DUPLICATE_CHAPTERS', duplicateChapters: sequence.duplicateChapters });
  }
  if (sequence.outOfOrderChapters.length) {
    issues.push({ code: 'INTERNAL_OUT_OF_ORDER_CHAPTERS', outOfOrderChapters: sequence.outOfOrderChapters });
  }
  if (conflicts.length) {
    issues.push({ code: 'INTERNAL_CONFLICTING_DUPLICATES', conflicts });
  }
  return issues;
}

function chooseBetterCandidate(a, b) {
  const priorityA = TAG_PRIORITY.get(a.tagName) || 0;
  const priorityB = TAG_PRIORITY.get(b.tagName) || 0;
  if (priorityA !== priorityB) return priorityA > priorityB ? a : b;
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
  return comparePhysicalOrder(a, b) <= 0 ? a : b;
}

function comparePhysicalOrder(a, b) {
  return a.spineIndex - b.spineIndex || a.position - b.position;
}

function summarizeCandidate(candidate) {
  return {
    chapterNumber: candidate.chapterNumber,
    title: candidate.displayTitle,
    originalText: candidate.originalText,
    sourceHref: candidate.sourceHref,
    spineIndex: candidate.spineIndex,
    position: candidate.position,
    tagName: candidate.tagName,
    domPath: candidate.domPath,
    confidence: candidate.confidence
  };
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}

function isFrontmatter(href) {
  return /titlepage|cover|copyright|dedication|toc|nav/.test(href);
}
