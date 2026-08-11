import { escapeXml, splitParagraphs } from '../utils/text-utils.js';

export function buildChapterXhtml(chapter) {
  const paragraphs = splitParagraphs(chapter.content || '');
  const body = paragraphs.map((paragraph) => `    <p>${escapeXml(paragraph)}</p>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/ebook.css"/>
</head>
<body>
  <h1>${escapeXml(chapter.title)}</h1>
${body}
</body>
</html>`;
}
