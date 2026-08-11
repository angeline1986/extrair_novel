import path from 'path';
import fs from 'fs-extra';
import { buildNavXhtml } from './nav-builder.js';
import { buildNcx } from './ncx-builder.js';
import { buildEpub3Opf } from './opf-builder.js';
import { auditZipMimetype, writeZipFile } from '../utils/zip-writer.js';

export function buildStructuredEpub(epub, chapterReport, resplitReport, chaptersDir, outputFile) {
  // Atualizar chapterReport com novos hrefs usando resplitReport
  const updatedChapterReport = updateChapterHrefs(chapterReport, resplitReport);

  const navPath = joinOpf(epub, 'nav.xhtml');
  const ncxPath = epub.ncxItems[0]?.fullPath || joinOpf(epub, 'toc.ncx');
  const navHref = relativeToOpf(epub, navPath);
  const ncxHref = relativeToOpf(epub, ncxPath);
  const navXhtml = buildNavXhtml(updatedChapterReport, epub.opf.metadata.language || 'pt');
  const ncxXml = buildNcx(updatedChapterReport, epub.opf.metadata);
  const opfXml = buildEpub3Opf(epub, navHref, ncxHref, updatedChapterReport);
  const entries = [];
  const originalManifestPaths = new Set(epub.manifestItems.map((item) => item.fullPath));

  entries.push({ name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf8'), store: true });
  for (const entry of epub.zip.getEntries()) {
    if (entry.isDirectory || entry.entryName === 'mimetype') continue;
    if (entry.entryName === epub.opf.path || entry.entryName === navPath || entry.entryName === ncxPath) continue;
    if (isRemovedOriginalHtml(epub, entry.entryName)) continue;
    if (!originalManifestPaths.has(entry.entryName) && entry.entryName !== 'META-INF/container.xml') continue;
    entries.push({ name: entry.entryName, data: entry.getData() });
  }
  entries.push({ name: epub.opf.path, data: Buffer.from(opfXml, 'utf8') });
  entries.push({ name: navPath, data: Buffer.from(navXhtml, 'utf8') });
  entries.push({ name: ncxPath, data: Buffer.from(ncxXml, 'utf8') });

  // Adicionar novos capítulos chapter_XXX.xhtml
  for (const item of resplitReport.supplementalItems || []) {
    const itemPath = path.join(epub.opf.directory, item.outputFile);
    const itemFile = path.join(chaptersDir, item.outputFile);
    const itemContent = fs.readFileSync(itemFile, 'utf8');
    entries.push({ name: itemPath, data: Buffer.from(itemContent, 'utf8') });
  }
  for (const chapter of resplitReport.chapters) {
    const chapterPath = path.join(epub.opf.directory, chapter.outputFile);
    const chapterFile = path.join(chaptersDir, chapter.outputFile);
    const chapterContent = fs.readFileSync(chapterFile, 'utf8');
    entries.push({ name: chapterPath, data: Buffer.from(chapterContent, 'utf8') });
  }
  fs.ensureDirSync(path.dirname(outputFile));
  writeZipFile(outputFile, entries);
  const mimetypeAudit = auditZipMimetype(outputFile);
  if (!mimetypeAudit.zipMimetypeOk) {
    throw new Error(`EPUB inválido: mimetype deve ser primeiro e STORE. ${JSON.stringify(mimetypeAudit)}`);
  }
}

function updateChapterHrefs(chapterReport, resplitReport) {
  const hrefMap = new Map();
  for (const resplitChapter of resplitReport.chapters) {
    hrefMap.set(resplitChapter.chapterNumber, resplitChapter.outputFile);
  }

  const updatedChapters = chapterReport.chapters.map(chapter => {
    if (chapter.role === 'chapter' && chapter.chapterNumber) {
      const newHref = hrefMap.get(chapter.chapterNumber);
      if (newHref) {
        return { ...chapter, href: newHref, fullPath: newHref };
      }
    }
    return chapter;
  });

  const supplementalItems = (chapterReport.supplementalItems || []).map((item) => {
    const generated = (resplitReport.supplementalItems || []).find((candidate) => candidate.role === item.role || candidate.outputFile === item.outputFile);
    return generated ? { ...item, href: generated.outputFile, fullPath: generated.outputFile } : item;
  });

  return { ...chapterReport, chapters: updatedChapters, supplementalItems };
}

function joinOpf(epub, fileName) {
  return path.posix.join(epub.opf.directory, fileName).replace(/^\.\//, '');
}

function relativeToOpf(epub, fullPath) {
  return path.posix.relative(epub.opf.directory, fullPath) || path.posix.basename(fullPath);
}

function isRemovedOriginalHtml(epub, entryName) {
  const item = epub.manifestItems.find((manifestItem) => manifestItem.fullPath === entryName);
  return item && ['application/xhtml+xml', 'text/html'].includes(item.mediaType);
}
