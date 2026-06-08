import fs from 'fs';
import path from 'path';
import { compact, stripChapterNumber } from './textUtils.js';

function chapterRangeFromFilename(filename) {
  const match = String(filename || '').match(/(?:ch|audit-ch)-(\d+(?:-\d+)?)\.md$/i);
  if (!match) return null;
  return match[1].split('-').map((item) => Number(item)).filter(Number.isInteger);
}

function chapterRangeFromMetadata(lines, fallback = []) {
  const line = lines.find((item) => /^Audit chapters?:\s*/i.test(item)) || '';
  const numbers = line
    .replace(/^Audit chapters?:\s*/i, '')
    .split(/\s*(?:,|-|\/|e|and)\s*/i)
    .map((item) => Number(item))
    .filter(Number.isInteger);
  return numbers.length ? numbers : fallback;
}

function readMetadata(lines) {
  const titleLine = lines.find((line) => /^#\s+/.test(line)) || '';
  const sourceLine = lines.find((line) => /^Source:\s*/i.test(line)) || '';
  const rawTitle = compact(titleLine.replace(/^#\s+/, ''));
  const title = rawTitle
    .replace(/^chapter\s+\d+(?:-\d+)?\s*:\s*/i, '')
    .replace(/^\d+[.)]?\s*/, '')
    .trim();
  return {
    rawTitle,
    title: title || stripChapterNumber(rawTitle),
    source: compact(sourceLine.replace(/^Source:\s*/i, '')),
  };
}

function bodyFromMarkdown(lines) {
  const bodyStart = lines.findIndex((line) => /^Alignment:\s*/i.test(line));
  let bodyLines = bodyStart >= 0 ? lines.slice(bodyStart + 1) : lines.slice(1);
  bodyLines = bodyLines.filter((line, index) =>
    index > 4 || !/^(Audit chapter|Source site chapter|Chapter title|Source|Alignment|Usage):\s*/i.test(line)
  );
  return bodyLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphsFromBody(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map(compact)
    .filter(Boolean);
}

export function readEnglishSourceChapters(sourceDir) {
  const alignedDir = sourceDir ? path.join(sourceDir, 'aligned') : '';
  const inputDir = alignedDir && fs.existsSync(alignedDir) ? alignedDir : sourceDir;

  if (!inputDir || !fs.existsSync(inputDir)) {
    return {
      sourceDir,
      chapters: [],
    };
  }

  const chapters = fs.readdirSync(inputDir)
    .filter((filename) => /^accidental-baby-en-(?:audit-)?ch-\d+(?:-\d+)?\.md$/i.test(filename))
    .map((filename) => {
      const filePath = path.join(inputDir, filename);
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
      const auditChapters = chapterRangeFromMetadata(lines, chapterRangeFromFilename(filename) || []);
      const chapter = auditChapters.at(-1) || null;
      const chapterLabel = auditChapters.length > 1
        ? auditChapters.map((item) => String(item).padStart(3, '0')).join('-')
        : String(chapter || '-').padStart(3, '0');
      const metadata = readMetadata(lines);
      const body = bodyFromMarkdown(lines);
      const paragraphs = paragraphsFromBody(body);
      return {
        chapter,
        chapterLabel,
        auditChapters,
        title: metadata.title || metadata.rawTitle || `Chapter ${chapter || '-'}`,
        rawTitle: metadata.rawTitle,
        source: metadata.source,
        relativePath: path.relative(path.resolve(sourceDir, '../../..'), filePath).replaceAll('\\', '/'),
        paragraphCount: paragraphs.length,
        text: body,
      };
    })
    .sort((a, b) => Number(a.chapter || 9999) - Number(b.chapter || 9999));

  return {
    sourceDir,
    chapters,
  };
}

export function englishChapterTitleMap(englishSource) {
  const titles = new Map();
  for (const chapter of englishSource?.chapters || []) {
    for (const auditChapter of chapter.auditChapters || [chapter.chapter]) {
      if (Number.isInteger(auditChapter)) titles.set(auditChapter, chapter.title);
    }
  }
  return titles;
}
