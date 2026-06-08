import fs from 'fs';
import path from 'path';

export function markdownForChapter(chapter) {
  const auditChapter = chapter.auditChapter || chapter.siteChapter || '-';
  return [
    `# Chapter ${auditChapter}: ${chapter.title || `Site chapter ${chapter.siteChapter || '-'}`}`,
    '',
    `Audit chapter: ${auditChapter}`,
    `Source site chapter: ${chapter.siteChapter || '-'}`,
    `Chapter title: ${chapter.title || `Site chapter ${chapter.siteChapter || '-'}`}`,
    `Source: ${chapter.source}`,
    `Alignment: English source chapter ${chapter.siteChapter || '-'} corresponds to audit/report chapter ${auditChapter}.`,
    'Usage: auxiliary English source for double-checking terms, names, gender and meaning during audit.',
    '',
    ...chapter.paragraphs.flatMap((paragraph) => [paragraph, '']),
  ].join('\n').trimEnd();
}

function rangeLabel(chapters) {
  const numbers = chapters.map((chapter) => chapter.siteChapter).filter(Boolean);
  if (!numbers.length) return 'rendered';
  const min = String(Math.min(...numbers)).padStart(3, '0');
  const max = String(Math.max(...numbers)).padStart(3, '0');
  return `${min}-${max}`;
}

export function writeEnglishChapterOutputs(outputDir, chapters, failures = []) {
  fs.mkdirSync(outputDir, { recursive: true });
  const extractedChapters = chapters.filter((chapter) => chapter.paragraphCount > 0);
  const skippedEmptyChapters = chapters
    .filter((chapter) => chapter.paragraphCount === 0)
    .map((chapter) => ({ siteChapter: chapter.siteChapter, source: chapter.source }));
  const label = rangeLabel(extractedChapters);
  const chaptersWithAuditMapping = extractedChapters.map((chapter) => ({
    ...chapter,
    auditChapter: chapter.auditChapter || chapter.siteChapter || null,
    alignmentNote: `English source chapter ${chapter.siteChapter || '-'} corresponds to audit/report chapter ${chapter.auditChapter || chapter.siteChapter || '-'}.`,
  }));
  const payload = {
    schemaVersion: '1.0',
    source: 'borntobenovel',
    sourceLanguage: 'en',
    sourceKind: 'auxiliary_intermediate_translation',
    chapterNumberReliable: false,
    alignmentMode: 'text_similarity',
    extractedAt: new Date().toISOString(),
    selector: '#chapterContent p',
    titleSelector: '#chapterContent p:nth-child(1) strong',
    skippedEmptyChapters,
    failures,
    chapters: chaptersWithAuditMapping,
  };

  const jsonPath = path.join(outputDir, `accidental-baby-en-chapters-${label}.json`);
  const mdPath = path.join(outputDir, `accidental-baby-en-chapters-${label}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, `${extractedChapters.map(markdownForChapter).join('\n\n---\n\n')}\n`, 'utf8');

  for (const chapter of extractedChapters) {
    const number = String(chapter.siteChapter || extractedChapters.indexOf(chapter) + 1).padStart(3, '0');
    fs.writeFileSync(path.join(outputDir, `accidental-baby-en-ch-${number}.md`), `${markdownForChapter(chapter)}\n`, 'utf8');
  }

  return { jsonPath, mdPath, extractedCount: extractedChapters.length };
}
