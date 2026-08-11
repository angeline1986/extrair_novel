import { escapeXml } from '../utils/text-utils.js';

export function buildOpf({ title, language, identifier, creator, chapters, outputPath }) {
  const modified = new Date().toISOString();
  const chapterItems = chapters.map((chapter) => {
    return `    <item id="${chapter.id}" href="xhtml/${chapter.href}" media-type="application/xhtml+xml"/>`;
  }).join('\n');

  const spine = chapters.map((chapter) => {
    return `    <itemref idref="${chapter.id}"/>`;
  }).join('\n');

  const metadata = [
    `    <dc:title>${escapeXml(title)}</dc:title>`,
    `    <dc:language>${escapeXml(language)}</dc:language>`,
    `    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>`,
    creator ? `    <dc:creator>${escapeXml(creator)}</dc:creator>` : '',
    '    <meta property="dcterms:modified">' + escapeXml(modified) + '</meta>',
  ]
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${metadata}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/ebook.css" media-type="text/css"/>
${chapterItems}
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`;
}
