import fs from 'fs-extra';
import path from 'node:path';
import { buildMergeMetadata, suggestMergeTitle } from './merge-metadata.js';
import { resolveMergeResources } from './merge-resource-resolver.js';
import { collectMergeChapters, loadOrderedSourceEpubs } from './merge-chapter-collector.js';
import { buildMergedEpubFile, validateMergedEpub } from './merge-builder.js';
import { writeMergeReport } from './merge-report.js';

const OUTPUT_DIR = 'output/merged';

export function mergeEpubs(precheck, options = {}) {
  assertMergeReady(precheck);
  const sourceEpubs = loadOrderedSourceEpubs(precheck);
  const resourceResolution = resolveMergeResources(precheck, sourceEpubs);
  const chapterCollection = collectMergeChapters(precheck, sourceEpubs, resourceResolution.mappings);
  const metadata = buildMergeMetadata(precheck, options);
  const cover = chooseCover(precheck, resourceResolution.resources);
  const mergeBook = {
    metadata,
    chapters: chapterCollection.chapters,
    resources: resourceResolution.resources,
    resourceMappings: resourceResolution.mappings,
    cover,
    stylesheetRefs: resourceResolution.resources.filter((resource) => /css/i.test(resource.mediaType)),
    sourceOrder: precheck.orderedSources.map((source) => source.sourceFile),
    globalRange: precheck.globalRange
  };
  const outputFile = options.outputFile || uniqueOutputFile(metadata.title, precheck);
  buildMergedEpubFile(mergeBook, outputFile);
  const validation = validateMergedEpub(outputFile, mergeBook);
  const report = buildMergeReport({ precheck, mergeBook, outputFile, validation, resourceStats: resourceResolution.stats });
  writeMergeReport(report, options.reportFile);
  if (!validation.ok) throw new Error(`MERGE_VALIDATION_FAILED: ${JSON.stringify(validation.errors)}`);
  return report;
}

export function assertMergeReady(precheck) {
  if (!precheck || precheck.status !== 'ready_for_merge') {
    throw new Error('MERGE_PRECHECK_BLOCKED');
  }
  const blockers = [
    ['overlaps', precheck.overlaps],
    ['duplicates', precheck.duplicates],
    ['errors', precheck.errors]
  ].filter(([, value]) => Array.isArray(value) && value.length);
  if (blockers.length) {
    throw new Error(`MERGE_PRECHECK_BLOCKED: ${blockers.map(([name]) => name).join(', ')}`);
  }
}

export function uniqueOutputFile(title, precheck, outputDir = OUTPUT_DIR) {
  fs.ensureDirSync(outputDir);
  const range = precheck.globalRange || {};
  const base = [
    slugify(title || suggestMergeTitle(precheck) || 'livro-unido'),
    range.firstChapter && range.lastChapter ? `capitulos-${range.firstChapter}-a-${range.lastChapter}` : 'merge'
  ].filter(Boolean).join('-');
  let candidate = path.join(outputDir, `${base}.epub`);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `${base}-${suffix}.epub`);
    suffix++;
  }
  return candidate;
}

function buildMergeReport({ precheck, mergeBook, outputFile, validation, resourceStats }) {
  return {
    generatedAt: new Date().toISOString(),
    status: validation.ok ? 'success' : 'failed',
    sources: precheck.sourceCount,
    sourceOrder: mergeBook.sourceOrder,
    globalRange: {
      first: precheck.globalRange.firstChapter,
      last: precheck.globalRange.lastChapter
    },
    chapterCount: mergeBook.chapters.length,
    chapterMap: mergeBook.chapters.map((chapter) => ({
      sourceFile: chapter.sourceFile,
      sourceHref: chapter.sourceHref,
      sourceChapterNumber: chapter.sourceChapterNumber,
      globalChapterNumber: chapter.globalChapterNumber,
      title: chapter.title,
      outputHref: chapter.href
    })),
    metadata: mergeBook.metadata,
    resources: {
      deduplicated: resourceStats.deduplicated,
      namespaced: resourceStats.namespaced,
      collisions: resourceStats.collisions,
      total: mergeBook.resources.length
    },
    cover: mergeBook.cover,
    navigation: {
      navEntries: mergeBook.chapters.length,
      ncxEntries: mergeBook.chapters.length,
      spineEntries: mergeBook.chapters.length
    },
    validation,
    outputFile
  };
}

function chooseCover(precheck, resources) {
  const covers = (precheck.orderedSources || []).map((source) => source.cover).filter((cover) => cover?.path && cover?.hash);
  if (!covers.length) return { policy: 'none', resource: null };
  const first = covers[0];
  const allSame = covers.every((cover) => cover.hash === first.hash);
  const resource = resources.find((item) => item.hash === first.hash) || null;
  return {
    policy: allSame ? 'single-same-hash' : 'first-source',
    sourcePath: first.path,
    hash: first.hash,
    resource: resource ? { id: resource.id, href: resource.href, fullPath: resource.fullPath } : null
  };
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'livro-unido';
}
