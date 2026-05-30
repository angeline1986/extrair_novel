export function applyCanonicalChapters(documents, canonicalReport) {
  if (!canonicalReport?.chapters?.length) return null;
  const candidates = documents.filter((doc) => ['chapter', 'broken-chapter'].includes(doc.role));
  const chapters = candidates.slice(0, canonicalReport.chapters.length).map((doc, index) => {
    const canonical = canonicalReport.chapters[index];
    return {
      ...doc,
      role: 'chapter',
      confidence: 1,
      volume: canonical.volume,
      chapterNumber: canonical.chapterNumber,
      detectedTitle: doc.title,
      canonicalTitle: canonical.title,
      finalTitle: `${canonical.chapterNumber}. ${canonical.title}`,
      title: `${canonical.chapterNumber}. ${canonical.title}`,
      titleSource: 'canonical'
    };
  });
  const mappedPaths = new Set(chapters.map((chapter) => chapter.fullPath));
  const mappedDocuments = documents.map((doc) => mappedPaths.has(doc.fullPath)
    ? chapters.find((chapter) => chapter.fullPath === doc.fullPath)
    : normalizeDocument(doc));
  return { chapters, documents: mappedDocuments };
}

export function normalizeDocument(doc) {
  const valid = doc.titleQuality?.quality === 'valid';
  return {
    ...doc,
    detectedTitle: doc.title,
    canonicalTitle: null,
    finalTitle: valid ? doc.title : null,
    titleSource: valid ? 'auto' : 'invalid'
  };
}
