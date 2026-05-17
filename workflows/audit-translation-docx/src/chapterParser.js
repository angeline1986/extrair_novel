// src/chapterParser.js
// Parse de capítulos e títulos

import { normalizeText } from './utils.js';

export function parseChapterMeta(title, options = {}) {
  const text = normalizeText(title);
  const isTolerant = options.tolerant || true;
  
  // IGNORAR: Chapter Group, Group, etc. (não são capítulos reais)
  if (/^chapter\s+group\s+\d+/i.test(text) || 
      /^group\s+\d+/i.test(text) ||
      /^chapter group/i.test(text)) {
    return null;
  }
  
  // Prologue (inglês)
  if (/^prologue$/i.test(text)) {
    return {
      type: 'prologue',
      number: 'Prologue',
      title: 'Prologue',
      originalTitle: title,
      isFallback: false,
      confidence: 1.0,
    };
  }
  
  // Prólogo (português)
  if (/^pr[oó]logo$/i.test(text)) {
    return {
      type: 'prologue',
      number: 'Prólogo',
      title: 'Prólogo',
      originalTitle: title,
      isFallback: false,
      confidence: 1.0,
    };
  }
  
  // Epilogue (inglês)
  if (/^epilogue$/i.test(text)) {
    return {
      type: 'epilogue',
      number: 'Epilogue',
      title: 'Epilogue',
      originalTitle: title,
      isFallback: false,
      confidence: 1.0,
    };
  }
  
  // Epílogo (português)
  if (/^ep[ií]logo$/i.test(text)) {
    return {
      type: 'epilogue',
      number: 'Epílogo',
      title: 'Epílogo',
      originalTitle: title,
      isFallback: false,
      confidence: 1.0,
    };
  }
  
  // Chapter X: Title (inglês)
  let match = text.match(/^chapter\s+(\d+(?:\.\d+)?)\s*:\s*(.+)$/i);
  if (!match && isTolerant) {
    match = text.match(/^(\d+(?:\.\d+)?)\.\s+(.+)$/);
  }
  
  if (match) {
    return {
      type: 'chapter',
      number: normalizeText(match[1]),
      title: titleCase(match[2]),
      originalTitle: title,
      isFallback: false,
      confidence: 0.95,
    };
  }
  
  // Capítulo X: Título (português)
  match = text.match(/^cap[ií]tulo\s+(\d+(?:\.\d+)?)\s*:\s*(.+)$/i);
  if (match) {
    return {
      type: 'chapter',
      number: normalizeText(match[1]),
      title: titleCase(match[2]),
      originalTitle: title,
      isFallback: false,
      confidence: 0.95,
    };
  }
  
  return null;
}

function titleCase(str) {
  if (!str) return '';
  const lowerWords = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from',
    'in', 'into', 'nor', 'of', 'on', 'or', 'over', 'the', 'to', 'with',
    'da', 'de', 'do', 'das', 'dos', 'e', 'em', 'um', 'uma'
  ]);
  
  return normalizeText(str)
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function detectChaptersFromParagraphs(paragraphs, options = {}) {
  const chapters = [];
  let currentChapter = null;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    
    // Pular títulos de grupo completamente
    if (/^chapter\s+group\s+\d+/i.test(para) || 
        /^group\s+\d+/i.test(para)) {
      continue;
    }
    
    const meta = parseChapterMeta(para, options);
    
    if (meta) {
      if (currentChapter && currentChapter.paragraphs.length > 0) {
        chapters.push(currentChapter);
      }
      currentChapter = {
        title: meta.title || para,
        meta,
        originalTitle: meta.originalTitle || para,
        paragraphs: [],
        startIndex: i,
      };
    } else if (currentChapter) {
      currentChapter.paragraphs.push(para);
    } else {
      currentChapter = {
        title: null,
        meta: { type: 'fallback', isFallback: true, confidence: 0.5 },
        originalTitle: null,
        paragraphs: [para],
        startIndex: i,
      };
    }
  }
  
  if (currentChapter && currentChapter.paragraphs.length > 0) {
    chapters.push(currentChapter);
  }
  
  if (chapters.length === 0 && paragraphs.length > 0) {
    chapters.push({
      title: null,
      meta: { type: 'fallback', isFallback: true, confidence: 0.5 },
      originalTitle: null,
      paragraphs: [...paragraphs],
      startIndex: 0,
    });
  }
  
  return chapters;
}

export function getChapterGroup(chapterNumber) {
  if (!chapterNumber) return null;
  return String(chapterNumber).split('.')[0];
}