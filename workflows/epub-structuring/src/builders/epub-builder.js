import path from 'path';
import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import { buildNavXhtml } from './nav-builder.js';
import { buildNcx } from './ncx-builder.js';
import { buildEpub3Opf } from './opf-builder.js';

export function buildStructuredEpub(epub, chapterReport, resplitReport, chaptersDir, outputFile) {
  // Atualizar chapterReport com novos hrefs usando resplitReport
  const updatedChapterReport = updateChapterHrefs(chapterReport, resplitReport);

  const outputZip = new AdmZip();
  const navPath = joinOpf(epub, 'nav.xhtml');
  const ncxPath = epub.ncxItems[0]?.fullPath || joinOpf(epub, 'toc.ncx');
  const navHref = relativeToOpf(epub, navPath);
  const ncxHref = relativeToOpf(epub, ncxPath);
  const navXhtml = buildNavXhtml(updatedChapterReport, epub.opf.metadata.language || 'pt');
  const ncxXml = buildNcx(updatedChapterReport, epub.opf.metadata);
  const opfXml = buildEpub3Opf(epub, navHref, ncxHref, updatedChapterReport);

  addMimetypeFirst(epub, outputZip);
  for (const entry of epub.zip.getEntries()) {
    if (entry.isDirectory || entry.entryName === 'mimetype') continue;
    if (entry.entryName === epub.opf.path) outputZip.addFile(entry.entryName, Buffer.from(opfXml, 'utf8'));
    else if (entry.entryName === navPath) outputZip.addFile(navPath, Buffer.from(navXhtml, 'utf8'));
    else if (entry.entryName === ncxPath) outputZip.addFile(ncxPath, Buffer.from(ncxXml, 'utf8'));
    else outputZip.addFile(entry.entryName, entry.getData());
  }
  // Adicionar novos capítulos chapter_XXX.xhtml
  for (const chapter of resplitReport.chapters) {
    const chapterPath = path.join(epub.opf.directory, chapter.outputFile);
    const chapterFile = path.join(chaptersDir, chapter.outputFile);
    const chapterContent = fs.readFileSync(chapterFile, 'utf8');
    outputZip.addFile(chapterPath, Buffer.from(chapterContent, 'utf8'));
  }
  if (!epub.navItems.length) outputZip.addFile(navPath, Buffer.from(navXhtml, 'utf8'));
  if (!epub.ncxItems.length) outputZip.addFile(ncxPath, Buffer.from(ncxXml, 'utf8'));
  fs.ensureDirSync(path.dirname(outputFile));
  outputZip.writeZip(outputFile);
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

  return { ...chapterReport, chapters: updatedChapters };
}

function addMimetypeFirst(epub, outputZip) {
  const entry = epub.zip.getEntry('mimetype');
  const data = entry ? entry.getData() : Buffer.from('application/epub+zip', 'utf8');
  outputZip.addFile('mimetype', data, '', 0o644);
}

function joinOpf(epub, fileName) {
  return path.posix.join(epub.opf.directory, fileName).replace(/^\.\//, '');
}

function relativeToOpf(epub, fullPath) {
  return path.posix.relative(epub.opf.directory, fullPath) || path.posix.basename(fullPath);
}
