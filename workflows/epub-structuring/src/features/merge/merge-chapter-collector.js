import path from 'node:path';
import * as cheerio from 'cheerio';
import { readEpub } from '../../parsers/epub-reader.js';
import { readHtmlDocuments } from '../../parsers/html-reader.js';
import { detectInternalChapters } from '../../analyzers/internal-chapter-discovery.js';
import { applyBookStructureOverrides } from '../../utils/book-structure-overrides.js';
import { extractBodyFragmentByRange, buildChapterXhtml } from '../../utils/dom-range-extractor.js';
import { normalizeZipPath, readZipText } from '../../utils/zip-utils.js';

const CHAPTER_DIR = 'OEBPS/text';

export function loadOrderedSourceEpubs(precheck) {
  return (precheck.orderedSources || []).map((inventory, sourceIndex) => ({
    inventory,
    sourceIndex,
    epub: readEpub(inventory.sourcePath)
  }));
}

export function collectMergeChapters(precheck, sourceEpubs, resourceMappings) {
  const chapters = [];
  const hrefMappings = [];

  for (const source of sourceEpubs) {
    const htmlDocs = readHtmlDocuments(source.epub);
    const detected = detectInternalChapters(source.epub, htmlDocs);
    const overridden = applyBookStructureOverrides(source.epub, detected).chapterReport;
    const sourceChapters = overridden.chapters
      .filter((chapter) => chapter.role === 'chapter')
      .filter((chapter) => chapter.chapterNumber >= source.inventory.firstChapter && chapter.chapterNumber <= source.inventory.lastChapter)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    if (sourceChapters.length !== source.inventory.chapterCount) {
      throw new Error(`MERGE_CHAPTER_COUNT_MISMATCH: ${source.inventory.sourceFile} esperado=${source.inventory.chapterCount} coletado=${sourceChapters.length}`);
    }

    for (const [index, chapter] of sourceChapters.entries()) {
      const nextChapter = sourceChapters[index + 1];
      const outputFile = `chapter_${String(chapter.chapterNumber).padStart(3, '0')}.xhtml`;
      const outputFullPath = normalizeZipPath(path.posix.join(CHAPTER_DIR, outputFile));
      const sourceHtml = readZipText(source.epub.zip, chapter.fullPath);
      const endDomPath = nextChapter?.fullPath === chapter.fullPath ? nextChapter.domPath : null;
      const bodyContent = extractBodyFragmentByRange(sourceHtml, chapter.domPath, endDomPath);
      const headHtml = extractHeadHtml(sourceHtml);
      const xhtml = rewriteChapterRefs(
        buildChapterXhtml({
          title: chapter.finalTitle || chapter.title,
          bodyContent,
          sourceHeadHtml: headHtml,
          lang: source.epub.opf.metadata.language || source.inventory.language || 'pt-BR'
        }),
        {
          sourcePath: source.inventory.sourcePath,
          sourceFullPath: chapter.fullPath,
          outputFullPath,
          resourceMappings,
          chapterHrefMappings: hrefMappings
        }
      );

      const mergeChapter = {
        sourceFile: source.inventory.sourceFile,
        sourcePath: source.inventory.sourcePath,
        sourceHref: chapter.href,
        sourceFullPath: chapter.fullPath,
        sourceChapterNumber: chapter.chapterNumber,
        globalChapterNumber: chapter.chapterNumber,
        title: chapter.finalTitle || chapter.title,
        href: path.posix.basename(outputFullPath),
        fullPath: outputFullPath,
        xhtml,
        outputFile,
        resourceRefs: []
      };
      chapters.push(mergeChapter);
      hrefMappings.push({
        sourcePath: source.inventory.sourcePath,
        sourceFullPath: chapter.fullPath,
        sourceHref: chapter.href,
        outputFullPath,
        outputHref: outputFile,
        chapterNumber: chapter.chapterNumber
      });
    }
  }

  chapters.sort((a, b) => a.globalChapterNumber - b.globalChapterNumber);
  return { chapters, hrefMappings };
}

export function rewriteChapterRefs(xhtml, context) {
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: false });
  rewriteAttr($, context, 'img', 'src');
  rewriteAttr($, context, 'image', 'href');
  rewriteAttr($, context, 'link', 'href');
  rewriteAttr($, context, 'a', 'href');
  return $.xml();
}

function rewriteAttr($, context, selector, attr) {
  $(selector).each((_, el) => {
    const node = $(el);
    const href = node.attr(attr);
    const rewritten = rewriteHref(href, context);
    if (rewritten) node.attr(attr, rewritten);
  });
}

function rewriteHref(href, context) {
  if (!href || isExternalHref(href) || href.startsWith('data:')) return href;
  if (href.startsWith('#')) return href;
  const [pathname, suffix] = splitHref(href);
  if (!pathname) return href;
  const sourceFullPath = normalizeZipPath(path.posix.join(path.posix.dirname(context.sourceFullPath), pathname));
  const resource = context.resourceMappings.find((mapping) => mapping.sourcePath === context.sourcePath && mapping.sourceFullPath === sourceFullPath);
  if (resource) {
    return `${path.posix.relative(path.posix.dirname(context.outputFullPath), resource.outputFullPath)}${suffix}`;
  }
  const chapter = context.chapterHrefMappings.find((mapping) => mapping.sourcePath === context.sourcePath && mapping.sourceFullPath === sourceFullPath);
  if (chapter) {
    return `${path.posix.relative(path.posix.dirname(context.outputFullPath), chapter.outputFullPath)}${suffix}`;
  }
  return href;
}

function extractHeadHtml(html) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  return $('head').html() || '';
}

function isExternalHref(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function splitHref(href) {
  const match = String(href).match(/^([^?#]*)(.*)$/);
  return [match?.[1] || '', match?.[2] || ''];
}
