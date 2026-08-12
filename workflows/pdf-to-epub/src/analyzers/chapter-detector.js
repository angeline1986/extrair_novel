const TOC_MIN_HEADINGS_PER_PAGE = 4;

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
      });
    }
  } else {
    for (let i = 0; i < headings.length; i += 1) {
      const current = headings[i];
      const next = headings[i + 1];

      const content = extractContentBetweenHeadings(
        pdfAnalysis.pages,
        current,
        next,
      );

      chapterMatches.push({
        title: current.title,
        pageStart: current.page,
        pageEnd: next ? next.page : pdfAnalysis.pages.length,
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

      headings.push({
        page: page.index,
        lineIndex: index,
        title: match.title,
        raw: line,
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
  const prefix = line.replace(/^[\-•*\s]+/, '');
  const normalized = prefix.replace(/\s+/g, ' ').trim();

  const patterns = [
    /^(chapter|cap[ií]tulo)\s*[:\-]?\s*([0-9]{1,4}|[ivxlcdm]+)\s*[-:]?\s*(.*)$/i,
    /^(prologue|epilogue|pr[oó]logo|ep[ií]logo)(?:\s*[-:]\s*(.*))?$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const label = match[1] || '';
    const suffix = match[2] || '';
    const extra = match[3] || '';

    if (/^(prologue|epilogue|pr[oó]logo|ep[ií]logo)$/i.test(label)) {
      return {
        title: extra ? `${capitalize(label)}: ${extra.trim()}` : capitalize(label),
      };
    }

    return {
      title: extra.trim()
        ? `${capitalize(label)} ${suffix}: ${extra.trim()}`
        : `${capitalize(label)} ${suffix}`,
    };
  }

  return null;
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

    // When both headings are on the same page, both limits apply.
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
