const TOC_MIN_HEADINGS_PER_PAGE = 4;

const NUMBER_WORDS_PT = new Map([
  ['um', 1], ['uma', 1], ['dois', 2], ['duas', 2], ['tres', 3],
  ['quatro', 4], ['cinco', 5], ['seis', 6], ['sete', 7], ['oito', 8], ['nove', 9],
  ['dez', 10], ['onze', 11], ['doze', 12], ['treze', 13], ['quatorze', 14],
  ['catorze', 14], ['quinze', 15], ['dezesseis', 16], ['dezessete', 17],
  ['dezoito', 18], ['dezenove', 19], ['vinte', 20], ['trinta', 30],
  ['quarenta', 40], ['cinquenta', 50], ['sessenta', 60], ['setenta', 70],
  ['oitenta', 80], ['noventa', 90], ['cem', 100], ['cento', 100],
]);

export function detectChapters(pdfAnalysis) {
  const warnings = [];
  const allHeadings = collectHeadings(pdfAnalysis.pages);
  const tocPages = detectTocPages(allHeadings);
  const headings = allHeadings.filter((heading) => !tocPages.has(heading.page));

  if (tocPages.size > 0) {
    warnings.push(
      `Foram ignoradas ${tocPages.size} página(s) com alta densidade de headings, `
      + 'provavelmente pertencentes ao sumário.',
    );
  }

  const chapterMatches = [];

  if (headings.length === 0) {
    warnings.push('Nenhum capítulo detectado com base em padrões conhecidos. A divisão será feita por páginas.');

    for (const page of pdfAnalysis.pages) {
      chapterMatches.push({
        title: `Página ${page.index}`,
        pageStart: page.index,
        pageEnd: page.index,
        content: page.text,
        number: null,
      });
    }
  } else {
    for (let i = 0; i < headings.length; i += 1) {
      const current = headings[i];
      const next = headings[i + 1];

      chapterMatches.push({
        title: current.title,
        pageStart: current.page,
        pageEnd: next ? next.page : pdfAnalysis.pages.length,
        content: extractContentBetweenHeadings(pdfAnalysis.pages, current, next),
        number: current.number,
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
    number: chapter.number,
  }));

  warnings.push(...auditSequence(chapters));

  const emptyChapters = chapters.filter((chapter) => !chapter.content.trim());
  if (emptyChapters.length > 0) {
    warnings.push(`${emptyChapters.length} capítulo(s) foram detectados sem conteúdo.`);
  }

  const veryLargeChapters = chapters.filter(
    (chapter) => chapter.content.length > Math.max(250000, pdfAnalysis.textLength * 0.15),
  );
  if (veryLargeChapters.length > 0) {
    warnings.push(
      `${veryLargeChapters.length} capítulo(s) têm tamanho anormalmente grande e devem ser revisados.`,
    );
  }

  return {
    pdf: pdfAnalysis.filePath,
    pageCount: pdfAnalysis.pageCount,
    headingsFound: allHeadings.length,
    headingsIgnoredAsToc: allHeadings.length - headings.length,
    tocPages: [...tocPages].sort((a, b) => a - b),
    chapterCount: chapters.length,
    chapters,
    warnings,
  };
}

function collectHeadings(pages) {
  const headings = [];

  for (const page of pages) {
    const lines = page.text.split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;

      const match = matchHeading(line);
      if (!match) continue;

      // V4 intentionally does NOT consume following lines as part of the title.
      // This is conservative: preserving body text is more important than guessing
      // whether the next visual PDF line belongs to a wrapped heading.
      headings.push({
        page: page.index,
        lineIndex: index,
        title: match.title,
        raw: line,
        number: match.number,
        consumedLines: 0,
      });
    }
  }

  return headings;
}

function detectTocPages(headings) {
  const counts = new Map();

  for (const heading of headings) {
    counts.set(heading.page, (counts.get(heading.page) || 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= TOC_MIN_HEADINGS_PER_PAGE)
      .map(([page]) => page),
  );
}

function matchHeading(line) {
  const normalized = line.replace(/^[\-•*\s]+/, '').replace(/\s+/g, ' ').trim();

  const special = normalized.match(
    /^(prologue|epilogue|pr[oó]logo|ep[ií]logo)(?:\s*[-:]\s*(.*))?$/i,
  );

  if (special) {
    const label = capitalize(special[1]);
    const extra = (special[2] || '').trim();

    return {
      title: extra ? `${label}: ${extra}` : label,
      number: null,
    };
  }

  const chapterPrefix = normalized.match(/^(cap[ií]tulo|chapter)\s+(.+)$/i);
  if (!chapterPrefix) return null;

  const label = /^chapter$/i.test(chapterPrefix[1]) ? 'Chapter' : 'Capítulo';
  const split = splitNumberAndExtra(chapterPrefix[2]);
  const number = parseChapterNumber(split.numberToken);

  if (number == null) return null;

  const extra = split.extra.trim();

  return {
    title: extra ? `${label} ${number}: ${extra}` : `${label} ${number}`,
    number,
  };
}

function splitNumberAndExtra(value) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();

  const numeric = normalized.match(/^([0-9]{1,4}|[ivxlcdm]+)\b\s*[:\-]?\s*(.*)$/i);
  if (numeric) {
    return {
      numberToken: numeric[1],
      extra: numeric[2] || '',
    };
  }

  const words = normalized.split(' ');

  // Try the longest valid Portuguese number prefix first.
  // The connector "e" must remain part of the candidate so
  // "Noventa e Quatro" is parsed as 94, not 90 + title "Quatro".
  for (let len = Math.min(7, words.length); len >= 1; len -= 1) {
    const candidate = words.slice(0, len).join(' ');
    const parsed = parsePortugueseNumber(candidate);

    if (parsed != null) {
      return {
        numberToken: candidate,
        extra: words.slice(len).join(' ').replace(/^[:\-]\s*/, ''),
      };
    }
  }

  return { numberToken: normalized, extra: '' };
}

function parseChapterNumber(token) {
  const value = String(token || '').trim();

  if (/^\d{1,4}$/.test(value)) return Number(value);
  if (/^[ivxlcdm]+$/i.test(value)) return romanToInt(value);

  return parsePortugueseNumber(value);
}

function parsePortugueseNumber(value) {
  const tokens = normalizePortugueseNumber(value)
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return null;

  let total = 0;
  let expectsNumberAfterE = false;

  for (const token of tokens) {
    if (token === 'e') {
      if (total === 0 || expectsNumberAfterE) return null;
      expectsNumberAfterE = true;
      continue;
    }

    const mapped = NUMBER_WORDS_PT.get(token);
    if (mapped == null) return null;

    total += mapped;
    expectsNumberAfterE = false;
  }

  if (expectsNumberAfterE) return null;
  return total || null;
}

function normalizePortugueseNumber(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function romanToInt(value) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const chars = String(value).toUpperCase().split('');
  let total = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const current = map[chars[i]];
    const next = map[chars[i + 1]] || 0;
    total += current < next ? -current : current;
  }

  return total;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function extractContentBetweenHeadings(pages, current, next) {
  const segments = [];
  const startPageArrayIndex = findPageArrayIndex(pages, current.page);

  if (startPageArrayIndex < 0) return '';

  const endPageArrayIndex = next
    ? findPageArrayIndex(pages, next.page)
    : pages.length - 1;

  if (endPageArrayIndex < 0) return '';

  for (let i = startPageArrayIndex; i <= endPageArrayIndex; i += 1) {
    const pageLines = (pages[i]?.text || '').split('\n');
    let from = 0;
    let to = pageLines.length;

    if (i === startPageArrayIndex) {
      from = current.lineIndex + 1;
    }

    if (next && i === endPageArrayIndex) {
      to = next.lineIndex;
    }

    if (i === startPageArrayIndex && next && i === endPageArrayIndex) {
      from = current.lineIndex + 1;
      to = next.lineIndex;
    }

    const text = pageLines.slice(from, to).join('\n').trim();
    if (text) segments.push(text);
  }

  return segments.join('\n\n');
}

function findPageArrayIndex(pages, pageNumber) {
  return pages.findIndex((page) => page.index === pageNumber);
}

function auditSequence(chapters) {
  const warnings = [];
  let previous = null;

  for (const chapter of chapters) {
    if (!Number.isInteger(chapter.number)) continue;

    if (previous != null) {
      if (chapter.number === previous) {
        warnings.push(`Sequência: capítulo duplicado ${chapter.number}.`);
      } else if (chapter.number < previous) {
        warnings.push(`Sequência: fora de ordem ${previous} -> ${chapter.number}.`);
      } else if (chapter.number > previous + 1) {
        warnings.push(`Sequência: lacuna ${previous} -> ${chapter.number}.`);
      }
    }

    previous = chapter.number;
  }

  return warnings;
}
