import fs from 'fs';
import path from 'path';

const CHAPTER_SPECS = [
  {
    label: '001',
    auditChapters: [1],
    title: 'Pregnancy',
    spanishTitle: 'Embarazo',
    parts: [
      { from: 1 },
      { from: 2 },
      { from: 3, before: /\[2\.\s*Reunion\]/i, label: 'ch-003 before [2. Reunion]' },
    ],
    boundaries: 'starts at ch-001; ends before [2. Reunion] inside ch-003.',
  },
  {
    label: '002',
    auditChapters: [2],
    title: 'Reunion',
    spanishTitle: 'Reunion',
    parts: [
      { from: 3, after: /\[2\.\s*Reunion\]/i, label: 'ch-003 after [2. Reunion]' },
      { from: 4 },
      { from: 5 },
      { from: 6 },
      { from: 7, before: /\[3\.\s*Misunderstanding\]/i, label: 'ch-007 before [3. Misunderstanding]' },
    ],
    boundaries: 'starts after [2. Reunion] inside ch-003; ends before [3. Misunderstanding] inside ch-007.',
  },
  {
    label: '003-004',
    auditChapters: [3, 4],
    title: 'Misunderstanding / Morning Sickness',
    spanishTitle: 'Malentendido / Enjoos matinais',
    parts: [
      { from: 7, after: /\[3\.\s*Misunderstanding\]/i, label: 'ch-007 after [3. Misunderstanding]' },
      ...rangeParts(8, 19),
      { from: 20, before: /\[5\.\s*Business Trip\]/i, label: 'ch-020 before [5. Business Trip]' },
    ],
    boundaries: 'starts after [3. Misunderstanding] inside ch-007; includes [4. Morning Sickness] inside ch-011; ends before [5. Business Trip] inside ch-020.',
  },
  {
    label: '005',
    auditChapters: [5],
    title: 'Business Trip',
    spanishTitle: 'Viaje de negocios',
    parts: [
      { from: 20, after: /\[5\.\s*Business Trip\]/i, label: 'ch-020 after [5. Business Trip]' },
      ...rangeParts(21, 30),
    ],
    boundaries: 'starts after [5. Business Trip] inside ch-020; ends at ch-030.',
  },
  {
    label: '006',
    auditChapters: [6],
    title: 'Flashback / Hotel Night',
    spanishTitle: 'Flashback / Hotel Night',
    parts: [
      ...rangeParts(31, 38),
      { from: 39, before: /\[7[:.]\s*The Truth\]/i, label: 'ch-039 before [7: The Truth]' },
    ],
    boundaries: 'starts at ch-031; includes pre-[7: The Truth] fragment from ch-039.',
  },
  {
    label: '007',
    auditChapters: [7],
    title: 'The Truth',
    spanishTitle: 'La verdad',
    parts: [
      { from: 39, after: /\[7[:.]\s*The Truth\]/i, label: 'ch-039 after [7: The Truth]' },
      ...rangeParts(40, 44),
      { from: 45, before: /\[8\.\s*Contract\]/i, label: 'ch-045 before [8. Contract]' },
    ],
    boundaries: 'starts after [7: The Truth] inside ch-039; ends before [8. Contract] inside ch-045.',
  },
  {
    label: '008',
    auditChapters: [8],
    title: 'Contract',
    spanishTitle: 'Contrato',
    parts: [
      { from: 45, after: /\[8\.\s*Contract\]/i, label: 'ch-045 after [8. Contract]' },
      ...rangeParts(46, 49),
      { from: 50, before: /\[9\.\s*Rumors\]/i, label: 'ch-050 before [9. Rumors]' },
    ],
    boundaries: 'starts after [8. Contract] inside ch-045; ends before [9. Rumors] inside ch-050.',
  },
  {
    label: '009',
    auditChapters: [9],
    title: 'Rumors',
    spanishTitle: 'Rumores',
    parts: [
      { from: 50, after: /\[9\.\s*Rumors\]/i, label: 'ch-050 after [9. Rumors]' },
      ...rangeParts(51, 55),
      { from: 56, before: /\[10\.\s*Treatment\]/i, label: 'ch-056 before [10. Treatment]' },
    ],
    boundaries: 'starts after [9. Rumors] inside ch-050; ends before [10. Treatment] inside ch-056.',
  },
  {
    label: '010',
    auditChapters: [10],
    title: 'Treatment',
    spanishTitle: 'Tratamiento',
    parts: [
      { from: 56, after: /\[10\.\s*Treatment\]/i, label: 'ch-056 after [10. Treatment]' },
      ...rangeParts(57, 60),
    ],
    boundaries: 'starts after [10. Treatment] inside ch-056; continues through ch-060.',
  },
];

function rangeParts(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => ({ from: start + index }));
}

function padChapter(value) {
  return String(value).padStart(3, '0');
}

function sourcePath(sourceDir, chapter) {
  return path.join(sourceDir, `accidental-baby-en-ch-${padChapter(chapter)}.md`);
}

function sourceBody(sourceDir, chapter) {
  const lines = fs.readFileSync(sourcePath(sourceDir, chapter), 'utf8').split(/\r?\n/);
  let index = lines.findIndex((line) => /^Usage:\s*/i.test(line));
  if (index >= 0) return lines.slice(index + 1).join('\n').trim();
  index = lines.findIndex((line) => /^Alignment:\s*/i.test(line));
  return (index >= 0 ? lines.slice(index + 1) : lines.slice(1)).join('\n').trim();
}

function slicePart(text, part) {
  if (part.before) {
    const match = part.before.exec(text);
    return match ? text.slice(0, match.index).trim() : text.trim();
  }
  if (part.after) {
    const match = part.after.exec(text);
    return match ? text.slice(match.index + match[0].length).trim() : '';
  }
  return text.trim();
}

function sourceLabel(part) {
  return part.label || `ch-${padChapter(part.from)}`;
}

function partText(sourceDir, part) {
  return {
    source: sourceLabel(part),
    text: slicePart(sourceBody(sourceDir, part.from), part),
  };
}

function chapterMarkdown(chapter) {
  const parts = chapter.parts.filter((part) => part.text);
  return [
    `# Chapter ${chapter.label}: ${chapter.title}`,
    '',
    `Audit chapters: ${chapter.auditChapters.join(', ')}`,
    `Spanish/PDF chapter: ${chapter.label}`,
    `Chapter title: ${chapter.title}`,
    `Spanish title: ${chapter.spanishTitle}`,
    `English fragments: ${parts.map((part) => part.source).join(', ')}`,
    `Boundary notes: ${chapter.boundaries}`,
    `Alignment: merged English fragments correspond to Spanish/PDF audit chapter ${chapter.label}.`,
    'Usage: auxiliary English source for double-checking terms, names, gender and meaning during audit.',
    '',
    parts.map((part) => part.text).join('\n\n').trim(),
  ].join('\n').trimEnd();
}

export function buildAlignedEnglishChapters(sourceDir, outputDir = path.join(sourceDir, 'aligned')) {
  fs.mkdirSync(outputDir, { recursive: true });

  const chapters = CHAPTER_SPECS.map((spec) => {
    const parts = spec.parts.map((part) => partText(sourceDir, part)).filter((part) => part.text);
    const filename = `accidental-baby-en-audit-ch-${spec.label}.md`;
    const chapter = { ...spec, filename, parts };
    fs.writeFileSync(path.join(outputDir, filename), `${chapterMarkdown(chapter)}\n`, 'utf8');
    return {
      label: chapter.label,
      auditChapters: chapter.auditChapters,
      title: chapter.title,
      spanishTitle: chapter.spanishTitle,
      filename,
      fragments: parts.map((part) => part.source),
      boundaries: chapter.boundaries,
    };
  });

  const manifest = {
    schemaVersion: '1.0',
    source: 'merged_english_fragments',
    alignment: 'spanish_pdf_chapter_boundaries',
    generatedAt: new Date().toISOString(),
    chapters,
  };

  fs.writeFileSync(
    path.join(outputDir, 'accidental-baby-en-audit-chapters-001-010.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(outputDir, 'accidental-baby-en-audit-chapters-001-010.md'),
    `${chapters.map((chapter) => fs.readFileSync(path.join(outputDir, chapter.filename), 'utf8').trim()).join('\n\n---\n\n')}\n`,
    'utf8'
  );

  return manifest;
}
