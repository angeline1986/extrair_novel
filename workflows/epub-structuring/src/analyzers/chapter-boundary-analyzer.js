import * as cheerio from 'cheerio';
import { readZipText } from '../utils/zip-utils.js';
import { cleanText } from '../utils/text-utils.js';
import { parseChapterHeading, normalizeChapterTitle } from '../utils/chapter-parser.js';
import { collectDomChapterCandidates, isBibliographicNumberedText } from '../utils/dom-chapter-candidates.js';

export function analyzeChapterBoundaries(epub, chapterReport) {
  const canonicalChapters = chapterReport.chapters;
  if (!canonicalChapters.length) {
    return { ok: false, expectedCount: 0, foundCount: 0, averageConfidence: 0, missingChapters: [], warnings: [], rejectedCandidates: [], chapters: [] };
  }
  
  // Filtrar documentos do spine (excluir frontmatter)
  const spineDocs = epub.spineItems
    .filter(item => isHtml(item.mediaType) && !isFrontmatter(item.href))
    .map((item, index) => ({
      ...item,
      spineIndex: index,
      html: readZipText(epub.zip, item.fullPath)
    }));
  
  // Identificar títulos repetidos nos capítulos canônicos
  const titleFrequency = new Map();
  for (const chapter of canonicalChapters) {
    const title = extractTitleOnly(chapter.finalTitle || chapter.title);
    titleFrequency.set(title, (titleFrequency.get(title) || 0) + 1);
  }
  
  // Coletar todos os candidatos (incluindo títulos compostos)
  const allCandidates = [];
  for (const doc of spineDocs) {
    const $ = cheerio.load(doc.html, { xmlMode: true, decodeEntities: true });
    const docCandidates = findChapterStartCandidates($, doc.href, doc.spineIndex);
    allCandidates.push(...docCandidates);
  }
  
  // Matcher estrito: número + título normalizado
  const matches = new Map(); // chapterNumber -> best match
  const duplicateMatches = [];
  const ambiguousMatches = [];
  const rejectedCandidates = [];

  for (const chapter of canonicalChapters) {
    if (chapter.detectionSource !== 'book-structure-override' || !chapter.domPath) continue;
    matches.set(chapter.chapterNumber, {
      chapterNumber: chapter.chapterNumber,
      title: chapter.finalTitle || chapter.title,
      candidate: {
        href: chapter.sourceHref || chapter.href,
        spineIndex: chapter.spineIndex,
        node: 'book-structure-override',
        nodeIndex: chapter.index,
        domPath: chapter.domPath,
        text: chapter.overrideBoundaryText || chapter.overrideMatchedText || chapter.detectedTitle || chapter.title,
        previousText: '',
        nextText: '',
        confidence: 1,
        combined: false,
        titleDomPath: null
      }
    });
  }
  
  for (const candidate of allCandidates) {
    const matched = matchToCanonicalStrict(candidate, canonicalChapters, titleFrequency);
    if (matched) {
      const existing = matches.get(matched.chapterNumber);
      if (existing) {
        // Capítulo já tem match - manter o de maior confidence
        if (candidate.confidence > existing.candidate.confidence) {
          duplicateMatches.push({ chapterNumber: matched.chapterNumber, replaced: existing.candidate, kept: candidate });
          matches.set(matched.chapterNumber, { ...matched, candidate });
        } else {
          duplicateMatches.push({ chapterNumber: matched.chapterNumber, replaced: candidate, kept: existing.candidate });
        }
      } else {
        matches.set(matched.chapterNumber, { ...matched, candidate });
      }
    } else {
      // Candidato rejeitado
      rejectedCandidates.push({
        href: candidate.href,
        spineIndex: candidate.spineIndex,
        node: candidate.node,
        nodeIndex: candidate.nodeIndex,
        domPath: candidate.domPath,
        text: candidate.text,
        confidence: candidate.confidence,
        reason: 'no-canonical-match'
      });
    }
  }
  
  // Verificar matches ambíguos (mesmo texto em múltiplos capítulos)
  const textToChapters = new Map();
  for (const [chapterNumber, match] of matches) {
    const normalizedText = normalizeText(match.candidate.text);
    if (!textToChapters.has(normalizedText)) {
      textToChapters.set(normalizedText, []);
    }
    textToChapters.get(normalizedText).push(chapterNumber);
  }
  
  for (const [text, chapters] of textToChapters) {
    if (chapters.length > 1) {
      ambiguousMatches.push({ text, chapters });
    }
  }
  
  // Construir relatório final
  const chapters = [];
  let totalConfidence = 0;
  
  for (const [chapterNumber, match] of matches) {
    totalConfidence += match.candidate.confidence;
    chapters.push({
      chapterNumber,
      title: match.title,
      startFile: match.candidate.href,
      spineIndex: match.candidate.spineIndex,
      node: match.candidate.node,
      nodeIndex: match.candidate.nodeIndex,
      domPath: match.candidate.domPath,
      matchedText: match.candidate.text,
      previousText: match.candidate.previousText,
      nextText: match.candidate.nextText,
      confidence: match.candidate.confidence
    });
  }
  
  // Identificar capítulos não encontrados
  const missingChapters = canonicalChapters
    .filter(ch => !matches.has(ch.chapterNumber))
    .map(ch => ({ chapterNumber: ch.chapterNumber, title: ch.finalTitle || ch.title }));
  
  chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  
  const expectedCount = canonicalChapters.length;
  const foundCount = chapters.length;
  const averageConfidence = foundCount > 0 ? totalConfidence / foundCount : 0;
  const ok = foundCount === expectedCount;
  const warnings = [];
  
  if (duplicateMatches.length > 0) {
    warnings.push({ code: 'DUPLICATE_MATCHES', count: duplicateMatches.length, details: duplicateMatches });
  }
  
  if (ambiguousMatches.length > 0) {
    warnings.push({ code: 'AMBIGUOUS_MATCHES', count: ambiguousMatches.length, details: ambiguousMatches });
  }
  
  return {
    ok,
    expectedCount,
    foundCount,
    averageConfidence,
    missingChapters,
    warnings,
    rejectedCandidates,
    chapters
  };
}

function findChapterStartCandidates($, href, spineIndex) {
  let nodeIndex = 0;
  return collectDomChapterCandidates($, 'body', { sourceHref: href, spineIndex })
    .filter((candidate) => hasChapterNumber(candidate.text))
    .filter((candidate) => {
      const parsed = parseChapterHeading(candidate.text);
      return candidate.combined || parsed.format !== 'numbered-punctuation' || !isBibliographicNumberedText(candidate.text);
    })
    .map((candidate) => {
      const target = $(candidate.domPath).get(0);
      const context = target ? getContext($, target) : { previous: '', next: '' };
      return {
        href,
        spineIndex,
        node: candidate.combined ? `${candidate.tagName}+sibling` : candidate.tagName,
        nodeIndex: nodeIndex++,
        domPath: candidate.domPath,
        text: candidate.text,
        previousText: context.previous,
        nextText: candidate.titleText || context.next,
        confidence: calculateConfidence(candidate.text, candidate.tagName),
        combined: candidate.combined || false,
        titleDomPath: candidate.titleDomPath || null
      };
    });
}

function getContext($, el) {
  const $el = $(el);
  const $prev = $el.prev();
  const $next = $el.next();
  
  return {
    previous: $prev.length ? cleanText($prev.text().substring(0, 100)) : '',
    next: $next.length ? cleanText($next.text().substring(0, 100)) : ''
  };
}

function getDomPath($, el) {
  const path = [];
  let current = el;
  
  while (current && current.type !== 'root') {
    let selector = current.tagName;
    if (current.attribs && current.attribs.id) {
      selector += `#${current.attribs.id}`;
    } else if (current.parent && current.parent.children) {
      const siblings = current.parent.children.filter(sibling => sibling.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    path.unshift(selector);
    current = current.parent;
  }
  
  return path.join(' > ');
}

function matchToCanonicalStrict(candidate, canonicalChapters, titleFrequency) {
  const candidateText = candidate.text;
  const candidateNumber = extractChapterNumber(candidateText);
  
  if (candidateNumber === null) return null;
  
  for (const chapter of canonicalChapters) {
    const canonicalTitle = chapter.finalTitle || chapter.title;
    const canonicalNumber = extractChapterNumber(canonicalTitle);
    
    // Matcher: número do capítulo deve bater exatamente
    if (canonicalNumber !== candidateNumber) continue;
    
    // Título normalizado deve ser compatível (ou aceitar apenas número se título não bater)
    const candidateNormalized = normalizeText(candidateText);
    const canonicalNormalized = normalizeText(canonicalTitle);
    
    if (candidateNormalized === canonicalNormalized) {
      const titleOnly = extractTitleOnly(canonicalTitle);
      if (titleFrequency.get(titleOnly) > 1) {
        if (candidateNumber !== null) {
          return { chapterNumber: chapter.chapterNumber, title: canonicalTitle };
        }
        continue;
      }
      
      return { chapterNumber: chapter.chapterNumber, title: canonicalTitle };
    }
    
    // Fallback: aceitar correspondência apenas por número se título não bater
    // (para casos onde o título no HTML difere do canônico)
    const titleOnly = extractTitleOnly(canonicalTitle);
    if (titleFrequency.get(titleOnly) <= 1) {
      return { chapterNumber: chapter.chapterNumber, title: canonicalTitle };
    }
  }
  
  return null;
}

function normalizeText(text) {
  return normalizeChapterTitle(text);
}

function extractChapterNumber(text) {
  const parsed = parseChapterHeading(text);
  return parsed.matched ? parsed.chapterNumber : null;
}

function extractTitleOnly(text) {
  const parsed = parseChapterHeading(text);
  return parsed.matched ? parsed.title : text.trim();
}

function hasChapterNumber(text) {
  return parseChapterHeading(text).matched;
}

function isChapterNumberFragment(text) {
  return /^\d{1,3}[\.\)]?\s*$/.test(text);
}

function calculateConfidence(text, nodeType) {
  let score = 0.5;
  if (nodeType === 'h1') score += 0.4;
  else if (nodeType === 'h2') score += 0.3;
  else if (nodeType === 'h3') score += 0.2;
  else if (nodeType === 'p' || nodeType === 'div') score += 0.1;
  if (hasChapterNumber(text)) score += 0.2;
  if (text.length >= 3 && text.length <= 80) score += 0.1;
  return Math.min(score, 1.0);
}

function isGenericText(text) {
  return /^\*+$/.test(text) ||
         /^bsj$/i.test(text) ||
         /^converted ebook$/i.test(text) ||
         text.length < 3 ||
         text.length > 150;
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}

function isFrontmatter(href) {
  return /titlepage|cover|copyright|dedication|toc|nav/.test(href);
}
