import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

function normalizeText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readZipText(zip, filePath) {
  const entry = zip.getEntry(filePath);
  if (!entry) throw new Error(`Arquivo nao encontrado no EPUB: ${filePath}`);
  return entry.getData().toString('utf8');
}

function loadOpfPath(zip) {
  const containerXml = readZipText(zip, 'META-INF/container.xml');
  const $ = cheerio.load(containerXml, { xmlMode: true });
  const rootfile = $('rootfile').attr('full-path');
  if (!rootfile) throw new Error('Nao foi possivel encontrar rootfile em META-INF/container.xml');
  return rootfile.replaceAll('\\', '/');
}

function loadOpf(zip, opfPath) {
  const opfDir = path.dirname(opfPath);
  const opfContent = readZipText(zip, opfPath);
  const $ = cheerio.load(opfContent, { xmlMode: true });
  const manifest = new Map();

  $('manifest item, opf\\:manifest opf\\:item').each((_, item) => {
    const el = $(item);
    const id = el.attr('id');
    const href = el.attr('href');
    if (!id || !href) return;

    manifest.set(id, {
      id,
      href,
      mediaType: el.attr('media-type') || '',
      fullPath: path.normalize(path.join(opfDir, href)).replaceAll('\\', '/'),
    });
  });

  const spine = [];
  $('spine itemref, opf\\:spine opf\\:itemref').each((_, itemref) => {
    const idref = $(itemref).attr('idref');
    const item = manifest.get(idref);
    if (!item) return;

    const isTextual =
      /application\/xhtml\+xml|text\/html/i.test(item.mediaType) ||
      /\.(xhtml?|html?)$/i.test(item.href);

    if (isTextual) spine.push({ ...item, position: spine.length + 1 });
  });

  const title = normalizeText($('dc\\:title, title').first().text()) || path.basename(opfPath);
  return { title, spine };
}

function loadTocMap(zip) {
  const tocPath = zip
    .getEntries()
    .map((entry) => entry.entryName)
    .find((name) => name.toLowerCase().endsWith('toc.ncx'));

  if (!tocPath) return new Map();

  const tocDir = path.dirname(tocPath);
  const tocXml = readZipText(zip, tocPath);
  const $ = cheerio.load(tocXml, { xmlMode: true });
  const toc = new Map();

  $('navPoint').each((_, navPoint) => {
    const title = normalizeText($(navPoint).children('navLabel').children('text').first().text());
    const src = $(navPoint).children('content').attr('src');
    if (!src) return;

    const fullPath = path
      .normalize(path.join(tocDir, src.split('#')[0]))
      .replaceAll('\\', '/');

    if (title) toc.set(fullPath, title);
  });

  return toc;
}

function extractParagraphsFromHtml(html) {
  const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
  $('script, style, svg, nav, head').remove();

  const headings = [];
  const paragraphs = [];
  $('h1,h2,h3,h4,h5,h6,p,blockquote,li,div').each((_, el) => {
    const tagName = String(el.tagName || '').toLowerCase();
    const text = normalizeText($(el).text());
    if (!text || text.length < 2) return;

    const previous = paragraphs[paragraphs.length - 1];
    if (previous === text) return;

    if (/^h[1-6]$/.test(tagName)) headings.push(text);
    paragraphs.push(text);
  });

  return { headings, paragraphs };
}

export function readEpubFile(filePath) {
  const zip = new AdmZip(filePath);
  const opfPath = loadOpfPath(zip);
  const { title, spine } = loadOpf(zip, opfPath);
  const tocMap = loadTocMap(zip);
  const sections = [];
  const paragraphs = [];
  const headings = [];

  for (const item of spine) {
    let html = '';
    try {
      html = readZipText(zip, item.fullPath);
    } catch {
      continue;
    }

    const extracted = extractParagraphsFromHtml(html);
    const sectionTitle = tocMap.get(item.fullPath) || extracted.headings[0] || item.href;

    sections.push({
      index: sections.length,
      path: item.fullPath,
      title: sectionTitle,
      paragraphs: extracted.paragraphs,
      headings: extracted.headings,
      rawText: extracted.paragraphs.join('\n\n'),
      paragraphCount: extracted.paragraphs.length,
      charCount: extracted.paragraphs.join('').length,
    });

    headings.push(...extracted.headings);
    paragraphs.push(...extracted.paragraphs);
  }

  return {
    filePath,
    filename: path.basename(filePath),
    title,
    sections,
    paragraphs,
    headings,
    rawText: paragraphs.join('\n\n'),
    paragraphCount: paragraphs.length,
    headingCount: headings.length,
    charCount: paragraphs.join('').length,
  };
}

export function readFirstEpubFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) throw new Error(`Diretorio nao encontrado: ${dirPath}`);

  const file = fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.epub'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];

  if (!file) return null;
  return readEpubFile(path.join(dirPath, file));
}
