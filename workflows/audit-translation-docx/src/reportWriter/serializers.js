// src/reportWriter/serializers.js
import { getIssueDescription, getWarningDescription } from './utils.js';

export function serializeIssue(issue) {
  return {
    type: issue.type,
    severity: issue.severity,
    description: issue.description || getIssueDescription(issue),
    details: issue.details || null,
    occurrences: issue.occurrences || null,
  };
}

export function serializeWarning(warning) {
  return {
    type: warning.type,
    severity: warning.severity,
    description: warning.description || getWarningDescription(warning),
    details: warning.details || null,
    occurrences: warning.occurrences || null,
  };
}

export function serializeOllamaResult(result) {
  return {
    type: result.type,
    sourceTitle: result.sourceTitle,
    translationTitle: result.translationTitle,
    confidence: result.confidence,
    review: result.review,
  };
}

export function serializeFile(doc) {
  if (doc.alignment === "missing") {
    return {
      filename: doc.source.filename,
      alignment: "missing",
      sourceChars: doc.source.charCount,
      sourceParagraphs: doc.source.paragraphCount,
    };
  }

  return {
    filename: doc.source.filename,
    translationFilename: doc.translation.filename,
    alignment: doc.alignment,
    severity: doc.severity,
    sourceChars: doc.source.charCount,
    sourceParagraphs: doc.source.paragraphCount,
    translationChars: doc.translation.charCount,
    translationParagraphs: doc.translation.paragraphCount,
    chapterCount: doc.stats.sourceChapters,
    matchedChapters: doc.stats.matchedChapters,
    chapterIssues: doc.chapters.filter((c) => c.matchType !== "matched").length,
  };
}

export function generateSummary(alignedDocs, issues, warnings, ollamaResults) {
  const missingChapters = [];
  const sizeIssues = [];

  for (const doc of alignedDocs) {
    if (doc.chapters) {
      for (const chapter of doc.chapters) {
        if (chapter.matchType === "missing") {
          missingChapters.push({
            file: doc.source?.filename || "unknown",
            index: chapter.sourceIndex,
            title: chapter.sourceTitle,
          });
        }
        if (chapter.matchType === "matched") {
          const ratio = chapter.translationCharCount / Math.max(chapter.sourceCharCount, 1);
          if (ratio < 0.5) {
            sizeIssues.push({
              file: doc.source.filename,
              chapter: chapter.sourceTitle || `Capítulo ${chapter.sourceIndex + 1}`,
              ratio: ratio.toFixed(2),
            });
          }
        }
      }
    }
  }

  return {
    missingChapters: missingChapters.length,
    sizeIssues: sizeIssues.length,
    totalIssues: issues.length,
    totalWarnings: warnings.length,
    ollamaIssues: ollamaResults.filter((r) => r.review?.status === "fail").length,
    firstMissingChapters: missingChapters.slice(0, 5),
    firstSizeIssues: sizeIssues.slice(0, 5),
  };
}