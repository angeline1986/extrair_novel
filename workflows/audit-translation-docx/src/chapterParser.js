// src/chapterParser.js
import { normalizeText } from './utils.js';

export function parseChapterMeta(title, options = {}) {
  const text = normalizeText(title);
  const isTolerant = options.tolerant || true;
  
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
  
  // Interlude / Extra / Fallback
  if (/^interlude|^extra|^bloco sem título|^chapter group/i.test(text)) {
    // Chapter Group é ignorado (não é um capítulo real)
    if (/^chapter group/i.test(text)) {
      return null; // Ignorar títulos de grupo
    }
    
    return {
      type: 'interlude',
      number: null,
      title: text,
      originalTitle: title,
      isFallback: true,
      confidence: 0.7,
    };
  }
  
  return null;
}

export function detectChaptersFromParagraphs(paragraphs, options = {}) {
  const chapters = [];
  let currentChapter = null;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const meta = parseChapterMeta(para, options);
    
    // Ignorar "Chapter Group" (não criar capítulo para ele)
    if (meta === null && /^chapter group/i.test(para)) {
      continue;
    }
    
    if (meta) {
      // Salvar capítulo anterior
      if (currentChapter && currentChapter.paragraphs.length > 0) {
        chapters.push(currentChapter);
      }
      
      // Iniciar novo capítulo
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
      // Primeiro parágrafo sem título - criar capítulo fallback
      currentChapter = {
        title: null,
        meta: { type: 'fallback', isFallback: true, confidence: 0.5 },
        originalTitle: null,
        paragraphs: [para],
        startIndex: i,
      };
    }
  }
  
  // Adicionar último capítulo
  if (currentChapter && currentChapter.paragraphs.length > 0) {
    chapters.push(currentChapter);
  }
  
  // Se não encontrou nenhum capítulo, tratar como um único bloco
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

export function getChapterGroup(chapterNumber) {
  if (!chapterNumber) return null;
  return String(chapterNumber).split('.')[0];
}