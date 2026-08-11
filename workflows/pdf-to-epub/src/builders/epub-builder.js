import path from 'path';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import { buildOpf } from './opf-builder.js';
import { buildNavXhtml } from './nav-builder.js';
import { buildNcx } from './ncx-builder.js';

export async function buildEpub({ rootDir, pdfAnalysis, chapters, outputFile, xhtmlFiles }) {
  const title = pdfAnalysis.title || 'Livro';
  const language = pdfAnalysis.language || 'pt-BR';
  const identifier = `urn:uuid:${crypto.randomUUID()}`;
  const creator = pdfAnalysis.metadata?.Author || '';

  const contentDir = 'OEBPS';
  const xhtmlDir = path.posix.join(contentDir, 'xhtml');
  const cssDir = path.posix.join(contentDir, 'styles');

  const opfContent = buildOpf({
    title,
    language,
    identifier,
    creator,
    chapters,
  });
  const navContent = buildNavXhtml(title, chapters, language);
  const ncxContent = buildNcx(title, identifier, chapters);
  const cssContent = buildCss();

  const zip = new AdmZip();
  zip.addFile('mimetype', Buffer.from('application/epub+zip'), '', 0);
  zip.addFile('META-INF/container.xml', Buffer.from(buildContainerXml(contentDir), 'utf8'));
  zip.addFile(path.posix.join(contentDir, 'book.opf'), Buffer.from(opfContent, 'utf8'));
  zip.addFile(path.posix.join(contentDir, 'nav.xhtml'), Buffer.from(navContent, 'utf8'));
  zip.addFile(path.posix.join(contentDir, 'toc.ncx'), Buffer.from(ncxContent, 'utf8'));
  zip.addFile(path.posix.join(cssDir, 'ebook.css'), Buffer.from(cssContent, 'utf8'));

  for (const chapter of chapters) {
    const sourceFile = path.join(rootDir, xhtmlDir, chapter.href);
    const chapterContent = await fs.readFile(sourceFile, 'utf8');
    zip.addFile(path.posix.join(contentDir, 'xhtml', chapter.href), Buffer.from(chapterContent, 'utf8'));
  }

  await fs.ensureDir(path.dirname(outputFile));
  zip.writeZip(outputFile);

  return {
    outputFile,
    contentDir,
    opfPath: path.posix.join(contentDir, 'book.opf'),
    navPath: path.posix.join(contentDir, 'nav.xhtml'),
    ncxPath: path.posix.join(contentDir, 'toc.ncx'),
    cssPath: path.posix.join(cssDir, 'ebook.css'),
    xhtmlFiles,
    chapterFiles: chapters.map((chapter) => path.posix.join(contentDir, 'xhtml', chapter.href)),
    warnings: [],
  };
}

function buildContainerXml(contentDir) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${contentDir}/book.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function buildCss() {
  return `body {
  font-family: "Times New Roman", Georgia, serif;
  line-height: 1.6;
  margin: 1.2em;
  text-align: justify;
}

h1, h2, h3 {
  font-family: Arial, sans-serif;
  line-height: 1.3;
}

p {
  margin: 0 0 1em;
  text-indent: 1.5em;
}

img, svg {
  max-width: 100%;
  height: auto;
}`;
}
