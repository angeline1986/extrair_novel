import path from 'path';
import { safeFileName } from '../utils/text-utils.js';
import { buildStructuredEpub } from '../builders/epub-builder.js';

export function buildStructuredOutput({ root, inputFile, epub, chapterReport, resplitReport, chaptersDir }, options = {}) {
  const { log = () => {} } = options;
  const bookName = safeFileName(epub.opf.metadata.title || path.basename(inputFile, '.epub'));
  const outputFile = path.join(root, 'output', `${bookName}-structured-complete.epub`);

  log('Empacotando EPUB estruturado...');
  buildStructuredEpub(epub, chapterReport, resplitReport, chaptersDir, outputFile);

  return { outputFile };
}
