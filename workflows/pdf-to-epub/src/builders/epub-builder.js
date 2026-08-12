import path from 'path';
import fs from 'fs-extra';
import zlib from 'zlib';
import { randomUUID } from 'crypto';
import { buildOpf } from './opf-builder.js';
import { buildNavXhtml } from './nav-builder.js';
import { buildNcx } from './ncx-builder.js';

export async function buildEpub({ rootDir, pdfAnalysis, chapters, outputFile, xhtmlFiles }) {
  const title = pdfAnalysis.title || 'Livro';
  const language = pdfAnalysis.language || 'pt-BR';
  const identifier = `urn:uuid:${randomUUID()}`;
  const creator = pdfAnalysis.metadata?.Author || '';

  const contentDir = 'OEBPS';
  const xhtmlDir = path.posix.join(contentDir, 'xhtml');
  const cssDir = path.posix.join(contentDir, 'styles');

  const entries = [
    {
      name: 'mimetype',
      data: Buffer.from('application/epub+zip', 'ascii'),
      store: true,
    },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(buildContainerXml(contentDir), 'utf8'),
    },
    {
      name: path.posix.join(contentDir, 'book.opf'),
      data: Buffer.from(buildOpf({ title, language, identifier, creator, chapters }), 'utf8'),
    },
    {
      name: path.posix.join(contentDir, 'nav.xhtml'),
      data: Buffer.from(buildNavXhtml(title, chapters, language), 'utf8'),
    },
    {
      name: path.posix.join(contentDir, 'toc.ncx'),
      data: Buffer.from(buildNcx(title, identifier, chapters), 'utf8'),
    },
    {
      name: path.posix.join(cssDir, 'ebook.css'),
      data: Buffer.from(buildCss(), 'utf8'),
    },
  ];

  for (const chapter of chapters) {
    const sourceFile = path.join(rootDir, xhtmlDir, chapter.href);
    const chapterContent = await fs.readFile(sourceFile);

    entries.push({
      name: path.posix.join(contentDir, 'xhtml', chapter.href),
      data: chapterContent,
    });
  }

  await fs.ensureDir(path.dirname(outputFile));
  await writeZip(entries, outputFile);

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

async function writeZip(entries, outputFile) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const source = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const method = entry.store ? 0 : 8;
    const compressed = method === 0 ? source : zlib.deflateRawSync(source);
    const crc = crc32(source);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 names
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(source.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(0, 20);

  await fs.writeFile(outputFile, Buffer.concat([localData, centralDirectory, eocd]));
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
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
  font-family: serif;
  line-height: 1.5;
  margin: 5%;
}

h1 {
  font-size: 1.4em;
  margin: 0 0 1.2em;
}

p {
  text-align: justify;
  margin: 0 0 0.8em;
}`;
}
