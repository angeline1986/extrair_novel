import fs from 'fs-extra';
import path from 'path';
import { getInputDirs } from '../utils/file-utils.js';

export const VALIDATION_BASELINE_FILE = 'expected-structure.json';

export function getValidationBaselinePath(root) {
  const { validationBaselineDir } = getInputDirs(root);
  return path.join(validationBaselineDir, VALIDATION_BASELINE_FILE);
}

export async function writeValidationBaseline(root, baseline) {
  const filePath = getValidationBaselinePath(root);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, baseline, { spaces: 2 });
  return filePath;
}

export function readValidationBaseline(filePath) {
  return fs.readJsonSync(filePath);
}

export function buildValidationBaseline({ root, inputFile, chapterReport, resplitReport }) {
  const expected = buildExpectedStructure(chapterReport, resplitReport);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      inputFile: inputFile ? path.relative(root, inputFile) : null,
      chapterReport: 'runtime:chapterReport',
      resplitReport: 'runtime:chapterResplitReport'
    },
    expected
  };
}

export function buildExpectedStructure(chapterReport, resplitReport) {
  const chapterCount = chapterReport?.chapterCount;
  const selectedChapters = chapterReport?.chapters || [];
  const resplitChapters = resplitReport?.chapters || [];
  const resplitCount = resplitReport?.chapterCount;
  const hrefs = resplitChapters
    .filter((chapter) => chapter?.outputFile)
    .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))
    .map((chapter) => path.basename(chapter.outputFile));

  const chapterNumbers = resplitChapters
    .map((chapter) => chapter.chapterNumber)
    .filter((number) => Number.isInteger(number))
    .sort((a, b) => a - b);

  const ok = Number.isInteger(chapterCount) &&
    chapterCount > 0 &&
    selectedChapters.length === chapterCount &&
    resplitCount === chapterCount &&
    hrefs.length === chapterCount;

  return {
    chapterCount,
    chapterHrefs: hrefs,
    firstChapterNumber: chapterNumbers[0] || null,
    lastChapterNumber: chapterNumbers.at(-1) || null,
    approvedBy: 'chapter_report+chapter_resplit_report',
    consistent: ok,
    consistency: {
      selectedCount: selectedChapters.length,
      resplitCount,
      hrefCount: hrefs.length
    }
  };
}
