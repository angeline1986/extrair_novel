import path from 'node:path';
import { readHtmlDocuments } from '../../parsers/html-reader.js';
import { detectInternalChapters } from '../../analyzers/internal-chapter-discovery.js';
import { applyBookStructureOverrides } from '../../utils/book-structure-overrides.js';

export function detectSourceRange(epub, sourceFile) {
  const internal = detectInternalRange(epub);
  if (internal.confidence !== 'low') return internal;

  const filename = detectFilenameRange(sourceFile);
  if (filename) return filename;

  return {
    firstChapter: null,
    lastChapter: null,
    chapterCount: 0,
    rangeSource: 'unknown',
    confidence: 'low',
    issues: ['range-not-detected']
  };
}

export function detectFilenameRange(sourceFile) {
  const name = path.basename(sourceFile || '');
  const match = name.match(/(?:cap[ií]tulos?|chapters?)\s*(\d{1,5})\s*(?:a|to|-|–|—)\s*(\d{1,5})/i);
  if (!match) return null;
  const firstChapter = Number(match[1]);
  const lastChapter = Number(match[2]);
  if (!Number.isInteger(firstChapter) || !Number.isInteger(lastChapter)) return null;
  return {
    firstChapter,
    lastChapter,
    chapterCount: lastChapter >= firstChapter ? lastChapter - firstChapter + 1 : 0,
    rangeSource: 'filename',
    confidence: 'low',
    issues: lastChapter < firstChapter ? ['invalid-filename-range'] : []
  };
}

function detectInternalRange(epub) {
  try {
    const htmlDocs = readHtmlDocuments(epub);
    const raw = detectInternalChapters(epub, htmlDocs);
    const overridden = applyBookStructureOverrides(epub, raw).chapterReport || raw;
    const chapters = (overridden.chapters || [])
      .filter((chapter) => Number.isInteger(chapter.chapterNumber))
      .map((chapter) => chapter.chapterNumber)
      .sort((a, b) => a - b);
    if (!chapters.length) return { confidence: 'low', issues: ['no-internal-chapters'] };

    const firstChapter = chapters[0];
    const lastChapter = chapters.at(-1);
    const unique = [...new Set(chapters)];
    const sequence = overridden.sequence || {};
    const missing = sequence.missingChapters || [];
    const duplicates = sequence.duplicateChapters || [];
    const outOfOrder = sequence.outOfOrderChapters || [];
    const sequenceConsistent = missing.length === 0 && duplicates.length === 0 && outOfOrder.length === 0;
    const expectedCount = lastChapter >= firstChapter ? lastChapter - firstChapter + 1 : 0;
    const countCompatible = expectedCount === unique.length;

    return {
      firstChapter,
      lastChapter,
      chapterCount: unique.length,
      rangeSource: 'internal-dom',
      confidence: sequenceConsistent && countCompatible ? 'high' : 'medium',
      issues: [
        ...(!sequenceConsistent ? ['internal-sequence-inconsistent'] : []),
        ...(!countCompatible ? ['chapter-count-not-contiguous'] : [])
      ],
      rawChapterCount: raw.chapterCount,
      internalChapterCount: overridden.chapterCount
    };
  } catch (error) {
    return { confidence: 'low', issues: [`internal-detection-failed:${error.message}`] };
  }
}
