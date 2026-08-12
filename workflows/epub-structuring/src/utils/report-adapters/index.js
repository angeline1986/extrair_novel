import { buildChapterDetectionPages } from './chapter-detection-report-adapter.js';
import { buildReferencePages } from './reference-report-adapter.js';

export function buildOperationSpecificPages(model, ui) {
  const adapters = [
    buildChapterDetectionPages,
    buildReferencePages
  ];
  for (const adapter of adapters) {
    const pages = adapter(model, ui);
    if (pages?.length) return pages;
  }
  return [];
}
