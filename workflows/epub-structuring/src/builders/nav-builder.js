import { escapeXml } from '../utils/xml-utils.js';

export function buildNavXhtml(updatedChapterReport, language) {
  const items = updatedChapterReport.chapters.map((chapter) => {
    const title = escapeXml(chapter.finalTitle || chapter.title);
    return `      <li><a href="${escapeXml(chapter.href)}">${title}</a></li>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language || 'pt')}">
<head>
  <title>Sumário</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Sumário</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}
