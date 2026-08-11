import { escapeXml } from '../utils/xml-utils.js';
import { normalizeLanguageTag } from '../utils/language-utils.js';

export function buildNavXhtml(updatedChapterReport, language) {
  const lang = normalizeLanguageTag(language || 'pt');
  const tocItems = [
    ...(updatedChapterReport.supplementalItems || []),
    ...updatedChapterReport.chapters
  ];
  const items = tocItems.map((chapter) => {
    const title = escapeXml(chapter.finalTitle || chapter.title);
    return `      <li><a href="${escapeXml(chapter.href)}">${title}</a></li>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(lang)}" xml:lang="${escapeXml(lang)}">
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
