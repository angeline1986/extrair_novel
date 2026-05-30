export function analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport) {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      opfPath: epub.opf.path,
      opfVersion: epub.opf.version,
      htmlItems: epub.htmlItems.length,
      spineItems: epub.spineItems.length,
      manifestItems: epub.manifestItems.length,
      chapterCount: chapterReport.chapterCount,
      hasNav: tocReport.hasNav,
      hasNcx: tocReport.hasNcx,
      metadataLanguage: languageReport.metadataLanguage,
      detectedLanguage: languageReport.detectedLanguage,
      canonicalMapActive: chapterReport.canonicalMapActive
    },
    frontmatter: chapterReport.documents.filter((doc) => doc.role === 'frontmatter').map(minDoc),
    chapters: chapterReport.chapters.map(minDoc),
    htmlDocuments: htmlDocs.map((doc) => ({ href: doc.href, fullPath: doc.fullPath, wordCount: doc.wordCount, textLength: doc.textLength }))
  };
}

function minDoc(doc) {
  return { href: doc.href, fullPath: doc.fullPath, title: doc.finalTitle || doc.title, role: doc.role, chapterNumber: doc.chapterNumber ?? null };
}
