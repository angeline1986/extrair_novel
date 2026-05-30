export function analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport) {
  return {
    generatedAt: new Date().toISOString(),
    source: epub.sourcePath,
    conversionTarget: 'EPUB 3.0',
    summary: {
      opfPath: epub.opf.path,
      originalPackageVersion: epub.opf.version,
      targetPackageVersion: '3.0',
      title: epub.opf.metadata.title || null,
      creator: epub.opf.metadata.creator || null,
      metadataLanguage: epub.opf.metadata.language || null,
      detectedLanguage: languageReport.detectedLanguage,
      languageMatch: languageReport.match,
      manifestItems: epub.manifestItems.length,
      spineItems: epub.spineItems.length,
      htmlItems: epub.htmlItems.length,
      navItemsBefore: epub.navItems.length,
      ncxItemsBefore: epub.ncxItems.length,
      tocEntriesBefore: tocReport.entryCount || 0,
      chapterCount: chapterReport.chapterCount,
      frontmatterCount: chapterReport.documents.filter((doc) => doc.role === 'frontmatter').length,
      brokenChapterCount: chapterReport.documents.filter((doc) => doc.role === 'broken-chapter').length
    },
    metadata: epub.opf.metadata,
    htmlDocuments: htmlDocs.map((doc) => ({
      href: doc.href,
      heading: doc.heading,
      firstBold: doc.firstBold,
      firstParagraph: doc.firstParagraph,
      wordCount: doc.wordCount,
      isEmpty: doc.isEmpty
    })),
    spineItems: epub.spineItems
  };
}
