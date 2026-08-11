import * as cheerio from 'cheerio';
import { findBookStructureOverride } from '../config/book-structure-overrides.js';
import { readZipText } from './zip-utils.js';
import { cleanText } from './text-utils.js';
import { normalizeChapterTitle } from './chapter-parser.js';
import { validateChapterSequence } from '../analyzers/chapter-sequence-validator.js';

const SCAN_SELECTOR = 'h1, h2, h3, h4, p, div, strong, b, span';

export function applyBookStructureOverrides(epub, chapterReport) {
  const override = findBookStructureOverride(epub);
  if (!override) {
    return {
      chapterReport,
      report: emptyOverrideReport(),
      teaserRange: null
    };
  }

  const spineDocs = buildSpineDocs(epub);
  const existingNumbers = new Set(chapterReport.chapters.map((chapter) => chapter.chapterNumber));
  const additions = [];
  const missingOverrides = [];

  for (const entry of [...override.implicitChapters, ...override.irregularChapters]) {
    if (existingNumbers.has(entry.chapterNumber)) continue;
    const located = locateOverrideBoundary(spineDocs, entry);
    if (!located) {
      missingOverrides.push({ chapterNumber: entry.chapterNumber, title: entry.title, startText: entry.startText });
      continue;
    }
    additions.push(buildOverrideChapter(entry, located, chapterReport.chapters.length + additions.length));
  }

  const chapters = [...chapterReport.chapters, ...additions].sort(comparePhysicalOrder);
  const reindexedChapters = chapters.map((chapter, index) => ({ ...chapter, index }));
  const sequence = validateChapterSequence(reindexedChapters);
  const teaserRange = buildTeaserRange(override, spineDocs, additions);

  const updatedChapterReport = {
    ...chapterReport,
    source: `${chapterReport.source}+book-structure-override`,
    chapterCount: reindexedChapters.length,
    chapters: reindexedChapters,
    sequence,
    supplementalItems: teaserRange ? [{
      role: 'teaser',
      title: override.teaser.navTitle,
      href: override.teaser.outputHref,
      outputFile: override.teaser.outputHref,
      sourceHref: teaserRange.startFile,
      startFile: teaserRange.startFile,
      endFile: teaserRange.endFile
    }] : [],
    diagnostics: {
      ...chapterReport.diagnostics,
      bookStructureOverride: {
        bookId: override.bookId,
        addedImplicitChapters: additions.filter((chapter) => chapter.overrideKind === 'implicit').map((chapter) => chapter.chapterNumber),
        addedIrregularChapters: additions.filter((chapter) => chapter.overrideKind === 'irregular').map((chapter) => chapter.chapterNumber),
        missingOverrides
      }
    },
    issues: buildIssues(sequence, missingOverrides)
  };

  return {
    chapterReport: updatedChapterReport,
    teaserRange,
    report: {
      generatedAt: new Date().toISOString(),
      applied: true,
      bookId: override.bookId,
      detectedExplicitChapters: chapterReport.chapterCount,
      addedImplicitChapters: additions.filter((chapter) => chapter.overrideKind === 'implicit').map((chapter) => chapter.chapterNumber),
      addedIrregularChapters: additions.filter((chapter) => chapter.overrideKind === 'irregular').map((chapter) => chapter.chapterNumber),
      finalChapterCount: reindexedChapters.length,
      missingChapters: sequence.missingChapters,
      duplicateChapters: sequence.duplicateChapters,
      outOfOrderChapters: sequence.outOfOrderChapters,
      teaserPreserved: Boolean(teaserRange),
      missingOverrides,
      chapters: additions.map(summarizeOverrideChapter)
    }
  };
}

function buildSpineDocs(epub) {
  return epub.spineItems
    .filter((item) => isHtml(item.mediaType) && !isFrontmatter(item.href))
    .map((item, spineIndex) => ({
      ...item,
      spineIndex,
      html: readZipText(epub.zip, item.fullPath)
    }));
}

function locateOverrideBoundary(spineDocs, entry) {
  const sourceDocs = entry.sourceFile
    ? spineDocs.filter((doc) => doc.href === entry.sourceFile || doc.fullPath === entry.sourceFile)
    : spineDocs;

  const marker = entry.markerText ? normalizeForMatch(entry.markerText) : null;
  const target = normalizeForMatch(entry.startText);

  for (const doc of sourceDocs) {
    const $ = cheerio.load(doc.html, { xmlMode: true, decodeEntities: true });
    let markerSeen = !marker;
    let markerMatch = null;
    let position = 0;
    const nodes = $(SCAN_SELECTOR).toArray();
    for (const node of nodes) {
      const text = cleanText($(node).text());
      const normalized = normalizeForMatch(text);
      if (!markerSeen && normalized === marker) {
        markerSeen = true;
        markerMatch = {
          domPath: getDomPath($, node),
          tagName: String(node.tagName || '').toLowerCase(),
          matchedText: text,
          position
        };
        position++;
        continue;
      }
      if (markerSeen && normalized === target) {
        return {
          href: doc.href,
          fullPath: doc.fullPath,
          sourceHref: doc.href,
          sourceFullPath: doc.fullPath,
          spineIndex: doc.spineIndex,
          domPath: markerMatch?.domPath || getDomPath($, node),
          titleDomPath: getDomPath($, node),
          tagName: markerMatch?.tagName || String(node.tagName || '').toLowerCase(),
          matchedText: text,
          markerText: entry.markerText || null,
          boundaryText: markerMatch?.matchedText || text,
          position: markerMatch?.position ?? position
        };
      }
      position++;
    }
  }

  return null;
}

function buildOverrideChapter(entry, located, index) {
  const displayTitle = `${entry.chapterNumber}. ${entry.title}`;
  return {
    index,
    idref: null,
    href: located.href,
    fullPath: located.fullPath,
    title: displayTitle,
    detectedTitle: located.matchedText,
    finalTitle: displayTitle,
    role: 'chapter',
    confidence: 1,
    confidenceScore: 100,
    confidenceReasons: ['BOOK_STRUCTURE_OVERRIDE'],
    titleScore: 100,
    titleQuality: { quality: 'valid', reason: 'BOOK_STRUCTURE_OVERRIDE' },
    wordCount: 0,
    textLength: 0,
    tocLabel: null,
    chapterNumber: entry.chapterNumber,
    titleSource: 'book-structure-override',
    sourceHref: located.sourceHref,
    spineIndex: located.spineIndex,
    domPath: located.domPath,
    titleDomPath: located.titleDomPath || located.domPath,
    detectionSource: 'book-structure-override',
    overrideKind: entry.chapterNumber <= 4 ? 'implicit' : 'irregular',
    overrideMarkerText: located.markerText,
    overrideMatchedText: located.matchedText,
    overrideBoundaryText: located.boundaryText || located.matchedText
  };
}

function buildTeaserRange(override, spineDocs, additions) {
  if (!override.teaser) return null;
  const firstChapter = additions.find((chapter) => chapter.chapterNumber === 1);
  if (!firstChapter) return null;
  const doc = spineDocs.find((candidate) => candidate.href === override.teaser.sourceFile || candidate.fullPath === override.teaser.sourceFile);
  if (!doc) return null;
  return {
    role: 'teaser',
    title: override.teaser.navTitle,
    outputFile: override.teaser.outputHref,
    startFile: doc.href,
    startSpineIndex: doc.spineIndex,
    startDomPath: null,
    endFile: firstChapter.href,
    endSpineIndex: firstChapter.spineIndex,
    endDomPath: firstChapter.domPath,
    ok: true
  };
}

function summarizeOverrideChapter(chapter) {
  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    sourceHref: chapter.sourceHref,
    spineIndex: chapter.spineIndex,
    domPath: chapter.domPath,
    matchedText: chapter.overrideMatchedText,
    boundaryText: chapter.overrideBoundaryText,
    markerText: chapter.overrideMarkerText,
    kind: chapter.overrideKind
  };
}

function buildIssues(sequence, missingOverrides) {
  const issues = [];
  if (sequence.missingChapters.length) issues.push({ code: 'OVERRIDE_MISSING_CHAPTERS', missingChapters: sequence.missingChapters });
  if (sequence.duplicateChapters.length) issues.push({ code: 'OVERRIDE_DUPLICATE_CHAPTERS', duplicateChapters: sequence.duplicateChapters });
  if (sequence.outOfOrderChapters.length) issues.push({ code: 'OVERRIDE_OUT_OF_ORDER_CHAPTERS', outOfOrderChapters: sequence.outOfOrderChapters });
  if (missingOverrides.length) issues.push({ code: 'OVERRIDE_BOUNDARY_NOT_FOUND', missingOverrides });
  return issues;
}

function comparePhysicalOrder(a, b) {
  return a.spineIndex - b.spineIndex || compareDomPath(a.domPath, b.domPath) || a.chapterNumber - b.chapterNumber;
}

function compareDomPath(a, b) {
  const left = domPathNumbers(a);
  const right = domPathNumbers(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function domPathNumbers(value) {
  return String(value || '').split('>').map((part) => {
    const match = part.match(/nth-of-type\((\d+)\)/);
    return match ? Number(match[1]) : 0;
  });
}

function normalizeForMatch(value) {
  return normalizeChapterTitle(value);
}

function getDomPath($, el) {
  const path = [];
  let current = el;
  while (current && current.type !== 'root') {
    let selector = current.tagName;
    if (current.attribs && current.attribs.id) {
      selector += `#${current.attribs.id}`;
    } else if (current.parent && current.parent.children) {
      const siblings = current.parent.children.filter((sibling) => sibling.tagName === current.tagName);
      if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    path.unshift(selector);
    current = current.parent;
  }
  return path.join(' > ');
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}

function isFrontmatter(href) {
  return /titlepage|cover|copyright|dedication|toc|nav/.test(href);
}

function emptyOverrideReport() {
  return {
    generatedAt: new Date().toISOString(),
    applied: false,
    detectedExplicitChapters: 0,
    addedImplicitChapters: [],
    addedIrregularChapters: [],
    finalChapterCount: 0,
    missingChapters: [],
    duplicateChapters: [],
    teaserPreserved: false
  };
}
