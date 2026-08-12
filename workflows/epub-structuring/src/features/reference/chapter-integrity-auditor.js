import * as cheerio from 'cheerio';
import { readEpub } from '../../parsers/epub-reader.js';
import { readZipText } from '../../utils/zip-utils.js';
import { parseChapterHeading } from '../../utils/chapter-parser.js';
import { cleanText } from '../../utils/text-utils.js';
import { firstWords, lastWords, normalizeAuditText } from './reference-document.js';

export function auditChapterIntegrity(targetEpubPath, referenceDocument = null, options = {}) {
  const target = extractTargetChapters(targetEpubPath);
  const structural = auditStructure(target);
  const referenceIssues = referenceDocument ? auditAgainstReference(target, referenceDocument) : emptyReferenceAudit();
  const warnings = [
    ...structural.warnings,
    ...referenceIssues.warnings,
    ...(!referenceDocument ? [{ code: 'NO_REFERENCE_SOURCE', message: 'Auditoria limitada à estrutura interna.' }] : [])
  ];
  const errors = [...structural.errors, ...referenceIssues.errors];
  const reviewItems = [
    ...referenceIssues.boundaryIssues,
    ...referenceIssues.missingContent,
    ...referenceIssues.duplicatedContent,
    ...referenceIssues.chapterMismatches
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: chooseStatus({ errors, warnings, reviewItems }),
    reference: referenceDocument ? summarizeReference(referenceDocument) : null,
    targetEpub: targetEpubPath,
    chapterCount: target.length,
    checkedChapters: referenceDocument ? Math.min(target.length, referenceDocument.chapters.length) : target.length,
    mode: options.mode || (referenceDocument ? 'reference' : 'structural-only'),
    boundaryIssues: referenceIssues.boundaryIssues,
    missingContent: referenceIssues.missingContent,
    duplicatedContent: referenceIssues.duplicatedContent,
    chapterMismatches: referenceIssues.chapterMismatches,
    structuralIssues: structural.issues,
    warnings,
    errors,
    confidence: chooseConfidence({ referenceDocument, reviewItems, warnings, errors }),
    chapters: target.map((chapter) => ({
      number: chapter.number,
      title: chapter.title,
      href: chapter.href,
      firstText: chapter.firstText,
      lastText: chapter.lastText
    }))
  };
}

export function extractTargetChapters(epubPath) {
  const epub = readEpub(epubPath);
  return epub.spineItems
    .filter((item) => ['application/xhtml+xml', 'text/html'].includes(item.mediaType))
    .map((item, index) => {
      const html = readZipText(epub.zip, item.fullPath);
      const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
      const heading = cleanText($('h1,h2,h3').first().text());
      const parsed = parseChapterHeading(heading);
      const number = parsed.chapterNumber || numberFromHref(item.href);
      const text = cleanText($('body').text());
      return {
        index,
        number,
        title: parsed.title || heading || item.href,
        heading,
        href: item.href,
        fullPath: item.fullPath,
        text,
        normalizedText: normalizeAuditText(text),
        firstText: firstWords(text),
        lastText: lastWords(text)
      };
    })
    .filter((chapter) => Number.isInteger(chapter.number))
    .sort((a, b) => a.number - b.number);
}

function auditStructure(chapters) {
  const issues = [];
  const warnings = [];
  const errors = [];
  const seen = new Set();
  const duplicates = [];
  const missing = [];

  for (const chapter of chapters) {
    if (seen.has(chapter.number)) duplicates.push(chapter.number);
    seen.add(chapter.number);
  }

  const first = chapters[0]?.number;
  const last = chapters.at(-1)?.number;
  if (Number.isInteger(first) && Number.isInteger(last)) {
    for (let number = first; number <= last; number++) {
      if (!seen.has(number)) missing.push(number);
    }
  }

  if (duplicates.length) {
    const issue = { code: 'DUPLICATED_TARGET_CHAPTERS', chapters: duplicates };
    issues.push(issue);
    errors.push(issue);
  }
  if (missing.length) {
    const issue = { code: 'MISSING_TARGET_CHAPTERS', chapters: missing };
    issues.push(issue);
    errors.push(issue);
  }
  if (!chapters.length) {
    const issue = { code: 'NO_TARGET_CHAPTERS' };
    issues.push(issue);
    errors.push(issue);
  }

  return { issues, warnings, errors };
}

function auditAgainstReference(targetChapters, referenceDocument) {
  if (referenceDocument.adapterStatus === 'unsupported') {
    return {
      ...emptyReferenceAudit(),
      warnings: [{ code: 'REFERENCE_ADAPTER_UNSUPPORTED', sourceType: referenceDocument.sourceType, error: referenceDocument.error }]
    };
  }

  const byNumber = new Map(targetChapters.map((chapter) => [chapter.number, chapter]));
  const boundaryIssues = [];
  const missingContent = [];
  const duplicatedContent = [];
  const chapterMismatches = [];
  const warnings = [];
  const errors = [];

  for (const reference of referenceDocument.chapters) {
    const target = byNumber.get(reference.number);
    if (!target) {
      chapterMismatches.push({ code: 'TARGET_CHAPTER_MISSING', chapter: reference.number });
      continue;
    }

    if (!containsSignal(target.normalizedText, reference.firstText)) {
      missingContent.push({ code: 'FIRST_TEXT_NOT_FOUND', chapter: reference.number, expected: reference.firstText, href: target.href });
    }
    if (!containsSignal(target.normalizedText, reference.lastText)) {
      missingContent.push({ code: 'LAST_TEXT_NOT_FOUND', chapter: reference.number, expected: reference.lastText, href: target.href });
    }

    const previous = byNumber.get(reference.number - 1);
    const next = byNumber.get(reference.number + 1);
    if (previous && containsSignal(previous.normalizedText, reference.firstText)) {
      boundaryIssues.push({ code: 'NEXT_CHAPTER_START_IN_PREVIOUS', chapter: reference.number, previousChapter: previous.number, signal: reference.firstText });
    }
    if (next && containsSignal(next.normalizedText, reference.lastText)) {
      boundaryIssues.push({ code: 'CHAPTER_END_IN_NEXT', chapter: reference.number, nextChapter: next.number, signal: reference.lastText });
    }

    for (const other of targetChapters) {
      if (other.number === target.number) continue;
      if (reference.firstText && containsSignal(other.normalizedText, reference.firstText)) {
        duplicatedContent.push({ code: 'REFERENCE_START_DUPLICATED', chapter: reference.number, alsoInChapter: other.number, signal: reference.firstText });
      }
    }
  }

  if (referenceDocument.chapters.length !== targetChapters.length) {
    warnings.push({ code: 'CHAPTER_COUNT_DIFFERS', referenceCount: referenceDocument.chapters.length, targetCount: targetChapters.length });
  }

  return { boundaryIssues, missingContent, duplicatedContent, chapterMismatches, warnings, errors };
}

function containsSignal(normalizedText, signal) {
  const normalizedSignal = normalizeAuditText(signal);
  if (!normalizedSignal) return true;
  return normalizedText.includes(normalizedSignal);
}

function emptyReferenceAudit() {
  return { boundaryIssues: [], missingContent: [], duplicatedContent: [], chapterMismatches: [], warnings: [], errors: [] };
}

function chooseStatus({ errors, warnings, reviewItems }) {
  if (errors.length) return 'FAILED';
  if (reviewItems.length) return 'REVIEW_REQUIRED';
  if (warnings.length) return 'OK_WITH_WARNINGS';
  return 'OK';
}

function chooseConfidence({ referenceDocument, reviewItems, warnings, errors }) {
  if (errors.length || reviewItems.length) return 'low';
  if (!referenceDocument || warnings.length) return 'medium';
  return 'high';
}

function summarizeReference(referenceDocument) {
  return {
    sourceType: referenceDocument.sourceType,
    sourceFile: referenceDocument.sourceFile,
    chapterCount: referenceDocument.chapters?.length || 0,
    language: referenceDocument.language || null,
    title: referenceDocument.title || null,
    adapterStatus: referenceDocument.adapterStatus || 'ok'
  };
}

function numberFromHref(href) {
  const match = String(href || '').match(/(?:chapter|capitulo|cap)[_-]?(\d{1,4})/i);
  return match ? Number(match[1]) : null;
}
