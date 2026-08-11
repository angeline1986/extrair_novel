import path from 'node:path';
import * as cheerio from 'cheerio';
import { readEpub } from '../../parsers/epub-reader.js';
import { readHtmlDocuments } from '../../parsers/html-reader.js';
import { analyzeToc } from '../../analyzers/toc-analyzer.js';
import { detectInternalChapters } from '../../analyzers/internal-chapter-discovery.js';
import { readZipText } from '../../utils/zip-utils.js';
import { cleanText } from '../../utils/text-utils.js';
import { normalizeChapterTitle, parseChapterHeading } from '../../utils/chapter-parser.js';
import { collectDomChapterCandidates } from '../../utils/dom-chapter-candidates.js';
import { applyBookStructureOverrides } from '../../utils/book-structure-overrides.js';

export function analyzePrechapterContent(epubPath) {
  try {
    const epub = readEpub(epubPath);
    const htmlDocs = readHtmlDocuments(epub);
    const tocReport = analyzeToc(epub);

    const anchoredResult = analyzeTocAnchor(epubPath, epub, tocReport);
    if (anchoredResult) return anchoredResult;

    const tocDocumentResult = analyzeTocDocumentHeading(epubPath, epub, tocReport);
    const internalResult = analyzeInternalDomBoundary(epubPath, epub, htmlDocs);
    if (tocDocumentResult && internalResult && boundariesDisagree(tocDocumentResult, internalResult)) {
      return baseResult(epubPath, 'ambiguous', {
        target: tocDocumentResult.target,
        boundarySource: 'multiple-disagreement',
        confidence: 'low',
        signals: [...tocDocumentResult.signals, ...internalResult.signals, 'boundary-source-disagreement'],
        warnings: ['toc-document-heading-and-internal-dom-disagree'],
        preBoundary: tocDocumentResult.preBoundary,
        diagnostics: {
          tocDocument: summarizeBoundary(tocDocumentResult),
          internalDom: summarizeBoundary(internalResult)
        }
      });
    }
    if (isAcceptedBoundary(tocDocumentResult)) return tocDocumentResult;
    if (internalResult) return internalResult;
    if (tocDocumentResult) return tocDocumentResult;

    return baseResult(epubPath, 'no_boundary', {
      confidence: 'low',
      signals: [],
      warnings: ['no-usable-boundary-source']
    });
  } catch (error) {
    return baseResult(epubPath, 'unsupported', {
      confidence: 'low',
      signals: [],
      warnings: [error.message]
    });
  }
}

function analyzeTocAnchor(epubPath, epub, tocReport) {
  const tocEntry = findFirstAnchoredTocEntry(tocReport);
  if (!tocEntry) return null;

  const target = resolveTocTarget(epub, tocEntry);
  if (!target.item || !target.anchor) {
    return baseResult(epubPath, 'no_boundary', {
      target: { href: target.href, anchor: target.anchor, title: tocEntry.label || '' },
      boundarySource: 'toc-anchor',
      confidence: 'low',
      signals: ['toc-entry'],
      warnings: ['toc-target-not-resolved']
    });
  }

  const html = readZipText(epub.zip, target.item.fullPath);
  const domResult = inspectAnchorBoundary(html, target.anchor, tocEntry.label);
  if (!domResult.boundaryFound) {
    return baseResult(epubPath, 'no_boundary', {
      target: { href: target.item.href, anchor: target.anchor, title: tocEntry.label || '' },
      boundarySource: 'toc-anchor',
      confidence: 'low',
      signals: ['toc-anchor-reference'],
      warnings: ['anchor-not-found']
    });
  }

  return buildBoundaryResult(epubPath, {
    boundarySource: 'toc-anchor',
    href: target.item.href,
    anchor: target.anchor,
    title: domResult.title || tocEntry.label || '',
    chapterNumber: domResult.chapterNumber,
    domPath: domResult.domPath,
    confidence: calculateConfidence(domResult.signals),
    signals: domResult.signals,
    preBoundary: domResult.preBoundary,
    toc: { label: tocEntry.label || '', src: tocEntry.src }
  });
}

function analyzeTocDocumentHeading(epubPath, epub, tocReport) {
  const tocEntry = findFirstDocumentTocEntry(tocReport);
  if (!tocEntry) return null;

  const target = resolveTocTarget(epub, tocEntry);
  if (!target.item) return null;

  const html = readZipText(epub.zip, target.item.fullPath);
  const domResult = inspectDocumentHeading(html, tocEntry.label);
  if (!domResult.boundaryFound) return null;

  return buildBoundaryResult(epubPath, {
    boundarySource: 'toc-document-heading',
    href: target.item.href,
    anchor: domResult.anchor,
    title: domResult.title || tocEntry.label || '',
    chapterNumber: domResult.chapterNumber,
    domPath: domResult.domPath,
    confidence: calculateConfidence(domResult.signals),
    signals: domResult.signals,
    preBoundary: domResult.preBoundary,
    toc: { label: tocEntry.label || '', src: tocEntry.src }
  });
}

function analyzeInternalDomBoundary(epubPath, epub, htmlDocs) {
  const rawReport = detectInternalChapters(epub, htmlDocs);
  const overrideResult = applyBookStructureOverrides(epub, rawReport);
  const chapterReport = overrideResult.chapterReport || rawReport;
  const firstChapter = (chapterReport.chapters || [])
    .filter((chapter) => chapter.role === 'chapter' && chapter.domPath && chapter.href)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)[0];

  if (!firstChapter) return null;

  const href = firstChapter.sourceHref || firstChapter.href;
  const item = epub.manifestItems.find((candidate) => isHtml(candidate.mediaType) && sameHref(candidate.href, href));
  if (!item) return null;

  const html = readZipText(epub.zip, item.fullPath);
  const domResult = inspectDomPathBoundary(html, firstChapter.domPath, firstChapter.finalTitle || firstChapter.title);
  if (!domResult.boundaryFound) return null;

  const sequence = chapterReport.sequence || {};
  const missing = sequence.missingChapters || [];
  const duplicates = sequence.duplicateChapters || [];
  const outOfOrder = sequence.outOfOrderChapters || [];
  const sequenceConsistent = missing.length === 0 && duplicates.length === 0 && outOfOrder.length === 0;
  const signals = [
    'internal-chapter-candidate',
    ...(firstChapter.detectionSource === 'book-structure-override' ? ['book-structure-override'] : []),
    ...(sequenceConsistent ? ['chapter-sequence-consistent'] : []),
    ...domResult.signals
  ];

  return buildBoundaryResult(epubPath, {
    boundarySource: 'internal-dom',
    href: item.href,
    anchor: domResult.anchor,
    title: domResult.title || firstChapter.finalTitle || firstChapter.title,
    chapterNumber: firstChapter.chapterNumber,
    domPath: firstChapter.domPath,
    confidence: sequenceConsistent || firstChapter.detectionSource === 'book-structure-override' ? 'high' : 'medium',
    signals,
    preBoundary: domResult.preBoundary,
    diagnostics: {
      internalChapterCount: chapterReport.chapterCount,
      rawInternalChapterCount: rawReport.chapterCount,
      detectionSource: firstChapter.detectionSource || firstChapter.titleSource || 'internal-dom',
      sequence: {
        missingChapters: missing,
        duplicateChapters: duplicates,
        outOfOrderChapters: outOfOrder
      }
    }
  });
}

function buildBoundaryResult(epubPath, options) {
  return baseResult(epubPath, determineStatus(options.confidence, options.preBoundary.elements.length, options.boundarySource), {
    target: {
      href: options.href,
      anchor: options.anchor || null,
      title: options.title || '',
      chapterNumber: options.chapterNumber,
      domPath: options.domPath || null
    },
    boundarySource: options.boundarySource,
    confidence: options.confidence,
    signals: options.signals,
    preBoundary: options.preBoundary,
    toc: options.toc || null,
    diagnostics: options.diagnostics || null
  });
}

function inspectAnchorBoundary(html, anchor, tocLabel) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
  const target = findById($, anchor);
  if (!target) return { boundaryFound: false };

  const tagName = String(target.tagName || '').toLowerCase();
  const boundaryText = cleanText($(target).text());
  const parsed = parseChapterHeading(boundaryText || tocLabel, { tagName });
  const signals = ['toc-anchor-match'];
  if (isHeading(tagName)) signals.push('heading-element');
  if (labelsCompatible(tocLabel, boundaryText)) signals.push('toc-label-compatible');
  if (parsed.matched) signals.push('chapter-pattern');

  return {
    boundaryFound: true,
    title: boundaryText || cleanText(tocLabel),
    chapterNumber: parsed.matched ? parsed.chapterNumber : null,
    anchor,
    domPath: getDomPath($, target),
    signals,
    preBoundary: buildPreBoundary($, target)
  };
}

function inspectDocumentHeading(html, tocLabel) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
  const candidates = collectDomChapterCandidates($, 'body', { sourceHref: '', spineIndex: 0 })
    .filter((candidate) => ['h1', 'h2', 'h3'].includes(candidate.tagName))
    .map((candidate) => ({ candidate, parsed: parseChapterHeading(candidate.text, { tagName: candidate.tagName }) }))
    .filter(({ parsed, candidate }) => parsed.matched && labelsCompatible(tocLabel, candidate.text));
  const selected = candidates[0];
  if (!selected) return { boundaryFound: false };

  const target = selected.candidate.el;
  return {
    boundaryFound: true,
    title: cleanText($(target).text()),
    chapterNumber: selected.parsed.chapterNumber,
    anchor: target.attribs?.id || null,
    domPath: selected.candidate.domPath,
    signals: ['toc-document-match', 'heading-element', 'toc-label-compatible', 'chapter-pattern'],
    preBoundary: buildPreBoundary($, target)
  };
}

function inspectDomPathBoundary(html, domPath, title) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
  const target = selectByDomPath($, domPath);
  if (!target) return { boundaryFound: false };

  const tagName = String(target.tagName || '').toLowerCase();
  const boundaryText = cleanText($(target).text()) || cleanText(title);
  const parsed = parseChapterHeading(boundaryText || title, { tagName });
  return {
    boundaryFound: true,
    title: boundaryText,
    chapterNumber: parsed.matched ? parsed.chapterNumber : null,
    anchor: target.attribs?.id || null,
    domPath,
    signals: [
      ...(isHeading(tagName) ? ['heading-element'] : ['structural-element']),
      ...(parsed.matched ? ['chapter-pattern'] : [])
    ],
    preBoundary: buildPreBoundary($, target)
  };
}

function baseResult(epubPath, status, overrides = {}) {
  return {
    sourceFile: path.basename(epubPath),
    sourcePath: epubPath,
    status,
    boundarySource: overrides.boundarySource || null,
    target: overrides.target || null,
    confidence: overrides.confidence || 'low',
    signals: overrides.signals || [],
    warnings: overrides.warnings || [],
    preBoundary: overrides.preBoundary || { elementCount: 0, elements: [], textElements: [] },
    toc: overrides.toc || null,
    diagnostics: overrides.diagnostics || null,
    generatedAt: new Date().toISOString()
  };
}

function findFirstAnchoredTocEntry(tocReport) {
  return (tocReport.entries || []).find((entry) => {
    const { href, anchor } = splitTocSrc(entry.src);
    return href && anchor && looksLikeChapterLabel(entry.label);
  }) || null;
}

function findFirstDocumentTocEntry(tocReport) {
  return (tocReport.entries || []).find((entry) => {
    const { href, anchor } = splitTocSrc(entry.src);
    return href && !anchor && looksLikeChapterLabel(entry.label);
  }) || null;
}

function splitTocSrc(src) {
  const [href, anchor = ''] = String(src || '').split('#');
  return { href: normalizeHref(href), anchor: decodeURIComponent(anchor.trim()) };
}

function resolveTocTarget(epub, tocEntry) {
  const { href, anchor } = splitTocSrc(tocEntry.src);
  const candidates = epub.manifestItems.filter((item) => isHtml(item.mediaType));
  const item = candidates.find((candidate) =>
    sameHref(candidate.href, href) ||
    sameHref(candidate.fullPath, href) ||
    path.posix.basename(candidate.href) === path.posix.basename(href));
  return { href, anchor, item };
}

function buildPreBoundary($, target) {
  const elements = collectPreBoundaryElements($, target);
  return {
    elementCount: elements.length,
    elements,
    textElements: elements.map((element) => element.text).filter(Boolean)
  };
}

function collectPreBoundaryElements($, target) {
  const boundaryNode = topLevelBodyChild(target);
  const elements = [];
  let current = $(boundaryNode).prev();

  while (current.length) {
    const node = current.get(0);
    if (node?.type === 'tag') {
      elements.unshift({ tagName: node.tagName, text: cleanText(current.text()), html: $.html(node) });
    }
    current = current.prev();
  }

  return elements;
}

function topLevelBodyChild(node) {
  let current = node;
  while (current.parent && current.parent.tagName && current.parent.tagName.toLowerCase() !== 'body') {
    current = current.parent;
  }
  return current;
}

function findById($, id) {
  return $('body *').toArray().find((element) => element.attribs?.id === id) || null;
}

function getDomPath($, el) {
  const parts = [];
  let current = el;
  while (current && current.type !== 'root') {
    let selector = current.tagName;
    if (current.attribs?.id) {
      selector += `#${current.attribs.id}`;
    } else if (current.parent?.children) {
      const siblings = current.parent.children.filter((sibling) => sibling.tagName === current.tagName);
      if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(selector);
    current = current.parent;
  }
  return parts.join(' > ');
}

function selectByDomPath($, domPath) {
  try {
    return $(domPath).get(0) || null;
  } catch {
    return null;
  }
}

function calculateConfidence(signals) {
  const set = new Set(signals);
  if (set.has('toc-anchor-match') && set.has('heading-element') && set.has('toc-label-compatible') && set.has('chapter-pattern')) return 'high';
  if (set.has('toc-document-match') && set.has('heading-element') && set.has('toc-label-compatible') && set.has('chapter-pattern')) return 'medium';
  if (set.has('toc-anchor-match') && set.has('chapter-pattern')) return 'medium';
  return 'low';
}

function determineStatus(confidence, preBoundaryCount, boundarySource) {
  if (confidence === 'low') return 'ambiguous';
  if (confidence === 'medium' && boundarySource !== 'toc-document-heading') return 'ambiguous';
  return preBoundaryCount > 0 ? 'candidate_found' : 'already_clean';
}

function isAcceptedBoundary(result) {
  return ['candidate_found', 'already_clean'].includes(result?.status);
}

function boundariesDisagree(left, right) {
  if (!left?.target || !right?.target) return false;
  return left.target.href !== right.target.href ||
    left.target.anchor !== right.target.anchor ||
    left.target.chapterNumber !== right.target.chapterNumber;
}

function summarizeBoundary(result) {
  return {
    status: result.status,
    boundarySource: result.boundarySource,
    confidence: result.confidence,
    target: result.target
  };
}

function labelsCompatible(label, heading) {
  const normalizedLabel = normalizeForComparison(label);
  const normalizedHeading = normalizeForComparison(heading);
  if (!normalizedLabel || !normalizedHeading) return false;
  return normalizedLabel === normalizedHeading || normalizedLabel.includes(normalizedHeading) || normalizedHeading.includes(normalizedLabel);
}

function looksLikeChapterLabel(label) {
  return parseChapterHeading(label).matched;
}

function normalizeForComparison(value) {
  return normalizeChapterTitle(cleanText(value)).replace(/\s+/g, ' ').trim();
}

function normalizeHref(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function sameHref(left, right) {
  return normalizeHref(left) === normalizeHref(right);
}

function isHeading(tagName) {
  return /^h[1-6]$/.test(tagName);
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}
