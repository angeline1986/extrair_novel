import { splitParagraphs } from '../utils/text-utils.js';

const CHAPTER_LABELS = ['chapter', 'capítulo', 'prologue', 'epilogue', 'prólogo', 'epílogo'];

export function detectChapters(pdfAnalysis) {
  const warnings = [];
  const headings = [];
  const chapterMatches = [];

  for (const page of pdfAnalysis.pages) {
    const lines = page.text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const match = matchHeading(line);
      if (match) {
        headings.push({
          page: page.index,
          lineIndex: index,
          title: match.title,
          raw: line,
        });
      }
    }
  }

  if (headings.length === 0) {
    warnings.push('Nenhum capítulo detectado com base em padrões conhecidos. A divisão será feita por páginas.');
    for (const page of pdfAnalysis.pages) {
      chapterMatches.push({
        title: `Página ${page.index}`,
        pageStart: page.index,
        pageEnd: page.index,
        content: page.text,
      });
    }
  } else {
    for (let i = 0; i < headings.length; i += 1) {
      const current = headings[i];
      const next = headings[i + 1];
      const startPage = current.page;
      const endPage = next ? next.page - 1 : pdfAnalysis.pages.length;

      const content = extractContentBetweenPages(pdfAnalysis.pages, startPage, endPage, current.lineIndex);
      chapterMatches.push({
        title: current.title,
        pageStart: startPage,
        pageEnd: endPage,
        content,
      });
    }
  }

  const chapters = chapterMatches.map((chapter, index) => ({
    id: `chapter-${String(index + 1).padStart(3, '0')}`,
    href: `chapter-${String(index + 1).padStart(3, '0')}.xhtml`,
    title: chapter.title,
    pageStart: chapter.pageStart,
    pageEnd: chapter.pageEnd,
    content: chapter.content,
  }));

  return {
    pdf: pdfAnalysis.filePath,
    pageCount: pdfAnalysis.pageCount,
    chapterCount: chapters.length,
    chapters,
    warnings,
  };
}

function matchHeading(line) {
  const prefix = line.replace(/^[\-•*\s]+/, '');
  const normalized = prefix.replace(/\s+/g, ' ').trim();

  const patterns = [
    /^(chapter|cap[ií]tulo|prologue|epilogue|pr[oó]logo|ep[ií]logo)\s*[:\-]?\s*([0-9]{1,3}|[ivxlcdm]+|[A-Za-zÁÉÍÓÚáéíóúÇç]+)$/i,
    /^(chapter|cap[ií]tulo|prologue|epilogue|pr[oó]logo|ep[ií]logo)\s*[:\-]?\s*([0-9]{1,3}|[ivxlcdm]+)\s*[-:]?\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const label = match[1] || '';
      const suffix = match[2] || '';
      const title = normalizeTitle(label, suffix, match[3]);
      if (title) return { title };
    }
  }

  return null;
}

function normalizeTitle(label, suffix, extra) {
  const baseLabel = label.toLowerCase();
  if (CHAPTER_LABELS.includes(baseLabel)) {
    if (suffix) {
      return `${capitalize(label)} ${suffix}`;
    }
    if (extra) {
      return `${capitalize(label)} ${extra}`;
    }
    return capitalize(label);
  }
  return null;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function extractContentBetweenPages(pages, startPage, endPage, lineIndex) {
  const start = Math.max(startPage - 1, 0);
  const end = Math.max(endPage - 1, start);
  const segments = [];

  for (let i = start; i <= end; i += 1) {
    const pageText = pages[i]?.text || '';
    const pageLines = pageText.split('\n');
    const trimmedLines = i === start
      ? pageLines.slice(lineIndex + 1)
      : pageLines;

    const text = trimmedLines.join('\n').trim();
    if (text) segments.push(text);
  }

  return segments.join('\n\n');
}
