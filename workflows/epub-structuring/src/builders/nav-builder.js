import { escapeXml } from '../utils/xml-utils.js';

export function buildNavXhtml(chapterReport, language) {
  const items = chapterReport.chapters.map((chapter) => {
    return `      <li><a href="${escapeXml(chapter.href)}">${escapeXml(chapter.title)}</a></li>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}">
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
</html>
`;
}
