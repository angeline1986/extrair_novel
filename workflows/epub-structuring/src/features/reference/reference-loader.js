import path from 'node:path';
import { loadEpubReference } from './adapters/epub-reference-adapter.js';
import { loadPdfReference } from './adapters/pdf-reference-adapter.js';
import { loadDocxReference } from './adapters/docx-reference-adapter.js';

export async function loadReferenceSource(referencePath) {
  if (!referencePath) return null;
  const ext = path.extname(referencePath).toLowerCase();
  if (ext === '.epub') return loadEpubReference(referencePath);
  if (ext === '.pdf') return loadPdfReference(referencePath);
  if (ext === '.docx') return loadDocxReference(referencePath);
  return {
    sourceType: ext.replace(/^\./, '') || 'unknown',
    sourceFile: referencePath,
    chapters: [],
    adapterStatus: 'unsupported',
    error: `REFERENCE_ADAPTER_UNSUPPORTED: ${ext || 'sem extensão'}`
  };
}
