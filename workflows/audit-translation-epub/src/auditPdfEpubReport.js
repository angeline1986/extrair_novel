#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readEpubFile } from './epubReader.js';
import { resolveEpubTarget } from './epubTargetResolver.js';
import { buildAlignedEnglishChapters } from './englishSource/alignedChapterBuilder.js';
import { readEnglishSourceChapters } from './pdfEpubComparison/englishSource.js';
import { buildPdfEpubComparisonAudit } from './pdfEpubComparisonAudit.js';
import {
  writePdfEpubComparisonFullText,
  writePdfEpubComparisonReport,
} from './pdfEpubComparisonReportWriter.js';
import { readFirstPdfFromDir } from './pdfReader.js';
import { ensureStateDirs, statePaths } from './statePaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');

const paths = {
  sourcePdfDir: path.join(workflowRoot, 'input/source/pdf'),
  sourceEnglishDir: path.join(workflowRoot, 'input/source/english'),
  sourceEnglishFragmentsDir: path.join(workflowRoot, 'input/source/english/fragments'),
  termsGlossaryPath: path.join(workflowRoot, 'input/glossary/terms.json'),
  entitiesGlossaryPath: path.join(workflowRoot, 'input/glossary/entities.json'),
  reportsHtmlDir: path.join(workflowRoot, 'reports/html'),
  reportsTxtDir: path.join(workflowRoot, 'reports/txt'),
  statePath: statePaths.pdfEpub.comparison,
  reviewQueuePath: statePaths.pdfEpub.reviewQueue,
  htmlPath: path.join(workflowRoot, 'reports/html/pdf-epub-comparison-latest.html'),
  txtPath: path.join(workflowRoot, 'reports/txt/pdf-epub-comparison-full.txt'),
};

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relativeToWorkflow(filePath) {
  return path.relative(workflowRoot, filePath).replaceAll('\\', '/');
}

function ensureDirs() {
  fs.mkdirSync(paths.reportsHtmlDir, { recursive: true });
  fs.mkdirSync(paths.reportsTxtDir, { recursive: true });
  ensureStateDirs();
}

export async function runPdfEpubComparisonReport() {
  ensureDirs();

  const pdfDoc = await readFirstPdfFromDir(paths.sourcePdfDir);
  if (!pdfDoc) {
    throw new Error(`Nenhum PDF encontrado em ${relativeToWorkflow(paths.sourcePdfDir)}.`);
  }

  const epubTarget = resolveEpubTarget({ workflowRoot });
  if (!epubTarget.filePath) {
    throw new Error('Nenhum EPUB alvo encontrado em output/, input-fixed/manifest.json ou input/translated/.');
  }

  const epubDoc = readEpubFile(epubTarget.filePath);
  buildAlignedEnglishChapters(paths.sourceEnglishFragmentsDir, path.join(paths.sourceEnglishDir, 'aligned'));
  const englishSource = readEnglishSourceChapters(paths.sourceEnglishDir);
  const glossary = {
    terms: readJsonIfExists(paths.termsGlossaryPath, { terms: [] }),
    entities: readJsonIfExists(paths.entitiesGlossaryPath, { entities: [] }),
  };
  const existingQueue = readJsonIfExists(paths.reviewQueuePath, null);

  const audit = buildPdfEpubComparisonAudit({
    pdfDoc,
    epubDoc,
    englishSource,
    glossary,
    epubTarget: {
      ...epubTarget,
      relativePath: relativeToWorkflow(epubTarget.filePath),
    },
    existingQueue,
  });

  fs.writeFileSync(paths.statePath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  writePdfEpubComparisonReport(audit, paths.htmlPath);
  writePdfEpubComparisonFullText(audit, paths.txtPath);

  return paths.htmlPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPdfEpubComparisonReport()
    .then((htmlPath) => {
      console.log(relativeToWorkflow(htmlPath));
    })
    .catch((error) => {
      console.error(`Erro ao gerar relatorio PDF x EPUB: ${error.message}`);
      process.exit(1);
    });
}
