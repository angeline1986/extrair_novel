import { escapeXml } from '../utils/xml-utils.js';

export function buildNcx(updatedChapterReport, metadata) {
  const uid = escapeXml(metadata.identifier || 'generated-id');
  const title = escapeXml(metadata.title || 'Livro');
  const navPoints = updatedChapterReport.chapters.map((chapter, index) => {
    const label = escapeXml(chapter.finalTitle || chapter.title);
    return `    <navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${label}</text></navLabel>
      <content src="${escapeXml(chapter.href)}"/>
    </navPoint>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}
