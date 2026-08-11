import { escapeXml } from '../utils/text-utils.js';

export function buildNavXhtml(title, chapters, language) {
  const items = chapters.map((chapter) => {
    return `      <li><a href="xhtml/${escapeXml(chapter.href)}">${escapeXml(chapter.title)}</a></li>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}">
<head>
  <title>${escapeXml(title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(title)}</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}
