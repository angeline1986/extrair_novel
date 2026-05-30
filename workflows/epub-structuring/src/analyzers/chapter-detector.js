import { detectFrontmatter } from './frontmatter-detector.js';
import { extractBestTitle } from './title-extractor.js';
import { analyzeTitleQuality } from './title-quality-analyzer.js';
import { validateChapterSequence } from './chapter-sequence-validator.js';
import { applyCanonicalChapters, normalizeDocument } from './canonical-chapter-mapper.js';

export function detectChapters(epub, htmlDocs, tocReport, pdfTocReport = null) {
  const tocByPath = new Map(tocReport.entries.map((entry) => [stripAnchor(entry.src), entry]));
  const documents = epub.spineItems.filter((item) => isHtml(item.mediaType))
    .map((item) => buildDocument(item, htmlDocs, tocByPath));
  const canonical = applyCanonicalChapters(documents, pdfTocReport);
  const finalDocuments = canonical?.documents || documents.map(normalizeDocument);
  const chapters = canonical?.chapters || finalDocuments
    .filter((item) => item.role === 'chapter')
    .map((item, index) => ({ ...item, chapterNumber: index + 1, titleSource: item.titleSource || 'auto' }));
  const sequence = validateChapterSequence(chapters);
  const issues = buildIssues(finalDocuments, sequence, Boolean(canonical));
  return {
    generatedAt: new Date().toISOString(),
    canonicalMapActive: Boolean(canonical),
    canonicalMapSource: pdfTocReport?.mapSource || null,
    totalDocuments: finalDocuments.length,
    chapterCount: chapters.length,
    documents: finalDocuments,
    chapters,
    sequence,
    issues
  };
}

function buildDocument(item, htmlDocs, tocByPath) {
  const doc = htmlDocs.find((candidate) => candidate.fullPath === item.fullPath);
  const tocEntry = tocByPath.get(item.href) || tocByPath.get(item.fullPath);
  const extracted = extractBestTitle(doc, tocEntry, item);
  const titleQuality = analyzeTitleQuality(extracted.title, doc, extracted.score);
  const frontmatter = detectFrontmatter(item, doc, extracted.title);
  const role = getRole(frontmatter, titleQuality, doc);
  const confidence = scoreChapter(doc, extracted, role, titleQuality);
  return {
    index: item.index,
    idref: item.idref,
    href: item.href,
    fullPath: item.fullPath,
    title: extracted.title,
    detectedTitle: extracted.title,
    role,
    confidence,
    titleScore: extracted.score,
    titleQuality,
    wordCount: doc?.wordCount || 0,
    textLength: doc?.textLength || 0,
    tocLabel: tocEntry?.label || null
  };
}

function getRole(frontmatter, titleQuality, doc) {
  if (frontmatter) return 'frontmatter';
  if (titleQuality.quality === 'invalid' && (doc?.wordCount || 0) > 100) return 'broken-chapter';
  if (titleQuality.quality === 'invalid') return 'ignored';
  return 'chapter';
}

function scoreChapter(doc, extracted, role, titleQuality) {
  if (role !== 'chapter') return 0;
  let score = 0.35;
  if (extracted.score >= 100) score += 0.45;
  if (titleQuality.quality === 'suspicious') score -= 0.2;
  if ((doc?.wordCount || 0) > 100) score += 0.2;
  return Number(Math.max(0, Math.min(score, 1)).toFixed(2));
}

function buildIssues(documents, sequence, canonicalMapActive) {
  const titleIssues = documents.filter((doc) => doc.titleQuality.quality !== 'valid' && doc.titleSource !== 'canonical')
    .map((doc) => ({ code: 'TITLE_QUALITY', href: doc.href, title: doc.title, role: doc.role, ...doc.titleQuality }));
  const broken = documents.filter((doc) => doc.role === 'broken-chapter')
    .map((doc) => ({ code: 'BROKEN_CHAPTER', href: doc.href, title: doc.title, wordCount: doc.wordCount }));
  const sequenceIssues = !canonicalMapActive && sequence.missingChapters.length
    ? [{ code: 'MISSING_CHAPTERS', missingChapters: sequence.missingChapters }]
    : [];
  return [...titleIssues, ...broken, ...sequenceIssues];
}

function stripAnchor(value) {
  return String(value || '').split('#')[0];
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}
