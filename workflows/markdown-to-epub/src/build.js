import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { marked } from 'marked';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { buildNavXhtml } from '../../epub-structuring/src/builders/nav-builder.js';
import { buildNcx } from '../../epub-structuring/src/builders/ncx-builder.js';
import { buildNewEpub3Opf } from '../../epub-structuring/src/builders/opf-builder.js';
import { writeZipFile, auditZipMimetype } from '../../epub-structuring/src/utils/zip-writer.js';
import { escapeXml } from '../../epub-structuring/src/utils/xml-utils.js';
import { validateChapterSequence } from '../../epub-structuring/src/analyzers/chapter-sequence-validator.js';
import { validateEpub3 } from '../../epub-structuring/src/validators/epub3-validator.js';
import { normalizeLanguageTag } from '../../epub-structuring/src/utils/language-utils.js';

const ROOT = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const NAME = /^capitulo_(\d+)_traducao_(?:revisada|validada)\.md$/i;
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const asArray = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const sha = (text) => createHash('sha256').update(text).digest('hex');
const expandPath = (value) => path.resolve(value === '~' ? os.homedir() : value.startsWith(`~${path.sep}`) ? path.join(os.homedir(), value.slice(2)) : value);

export function discoverChapters(input) {
  if (!fs.statSync(input, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Diretório inexistente: ${input}`);
  const candidates = fs.readdirSync(input).filter((name) => name.toLowerCase().endsWith('.md'));
  const unknown = candidates.filter((name) => !NAME.test(name));
  if (unknown.length) throw new Error(`Markdown com nome não reconhecido: ${unknown.join(', ')}`);
  if (!candidates.length) throw new Error('Nenhum capítulo Markdown encontrado.');
  const chapters = candidates.map((name) => ({ name, chapterNumber: Number(NAME.exec(name)[1]), sourcePath: path.join(input, name) }))
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const sequence = validateChapterSequence(chapters.map((chapter) => ({ ...chapter, title: `Capítulo ${chapter.chapterNumber}` })));
  if (chapters[0].chapterNumber !== 1 || sequence.missingChapters.length || sequence.duplicateChapters.length) {
    throw new Error(`Sequência inválida: início ${chapters[0].chapterNumber}; ausentes ${sequence.missingChapters.join(', ') || 'nenhum'}; duplicados ${sequence.duplicateChapters.join(', ') || 'nenhum'}`);
  }
  return chapters.map((chapter) => {
    const markdown = fs.readFileSync(chapter.sourcePath, 'utf8');
    if (!markdown.trim()) throw new Error(`Capítulo vazio: ${chapter.name}`);
    const first = markdown.match(/^(\s*)(#\s+)?([^\r\n]+)(\r?\n|$)/);
    if (!first) throw new Error(`Título ausente: ${chapter.name}`);
    const title = first[3].trim();
    if (!new RegExp(`^Cap[ií]tulo\\s+0*${chapter.chapterNumber}(?!\\d)`, 'i').test(title)) throw new Error(`Título não corresponde ao arquivo: ${chapter.name}: ${title}`);
    const renderMarkdown = first[2] ? markdown : `${first[1]}# ${title}${first[4]}${markdown.slice(first[0].length)}`;
    return { ...chapter, markdown, renderMarkdown, title, href: `chapter_${String(chapter.chapterNumber).padStart(3, '0')}.xhtml`, sourceSha256: sha(markdown) };
  });
}

export function renderChapter(chapter, language) {
  // Markdown bruto dentro de HTML não é interpretado como conteúdo executável.
  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escapeXml(text);
  renderer.image = ({ href, title, text }) => `<img src="${escapeXml(href)}" alt="${escapeXml(text)}"${title ? ` title="${escapeXml(title)}"` : ''} />`;
  const html = marked.parse(chapter.renderMarkdown || chapter.markdown, { renderer, gfm: false, breaks: false, async: false })
    .replace(/<br>/g, '<br />').replace(/<hr>/g, '<hr />');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" type="text/css" href="style.css" /></head><body>${html}</body></html>`;
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`XHTML inválido em ${chapter.name}: ${JSON.stringify(valid)}`);
  const $ = cheerio.load(xml, { xmlMode: true });
  if ($('h1').length !== 1 || $('h1').first().text().trim() !== chapter.title) throw new Error(`Título XHTML inválido: ${chapter.name}`);
  if (!$('body').text().trim()) throw new Error(`Conteúdo XHTML vazio: ${chapter.name}`);
  // A serialização XHTML deve manter integralmente o texto da conversão Markdown.
  const sourceText = cheerio.load(`<body>${html}</body>`, { xmlMode: true })('body').text();
  if ($('body').text() !== sourceText) throw new Error(`Perda de texto: ${chapter.name}`);
  return { xml, textSha256: sha(sourceText), textLength: sourceText.length };
}

export function validateBuiltEpub(file, chapters) {
  const zip = new AdmZip(file);
  const names = zip.getEntries().map((entry) => entry.entryName);
  const unique = new Set(names);
  const errors = [];
  if (unique.size !== names.length) errors.push('Entradas ZIP duplicadas');
  if (!auditZipMimetype(file).zipMimetypeOk || zip.readAsText('mimetype') !== 'application/epub+zip') errors.push('mimetype inválido');
  for (const name of names.filter((value) => /\.(xhtml|opf|ncx)$/i.test(value))) {
    const result = XMLValidator.validate(zip.readAsText(name));
    if (result !== true) errors.push(`XML inválido: ${name}: ${JSON.stringify(result)}`);
  }
  const opf = xmlParser.parse(zip.readAsText('OEBPS/content.opf')).package;
  const manifest = asArray(opf.manifest.item);
  const spine = asArray(opf.spine.itemref);
  const byId = new Map(manifest.map((item) => [item['@_id'], item]));
  const nav = cheerio.load(zip.readAsText('OEBPS/nav.xhtml'), { xmlMode: true });
  const ncx = cheerio.load(zip.readAsText('OEBPS/toc.ncx'), { xmlMode: true });
  const navHrefs = nav('nav#toc a').map((_, el) => nav(el).attr('href')).get();
  const ncxHrefs = ncx('navPoint content').map((_, el) => ncx(el).attr('src')).get();
  const expected = chapters.map((chapter) => chapter.href);
  const coverPage = manifest.some((item) => item['@_id'] === 'cover-page');
  const spineHrefs = spine.map((item) => byId.get(item['@_idref'])?.['@_href']);
  if (opf['@_version'] !== '3.0') errors.push('OPF não é EPUB 3.0');
  for (const [label, values] of [['NAV', navHrefs], ['NCX', ncxHrefs], ['spine', coverPage ? spineHrefs.slice(1) : spineHrefs]]) {
    if (JSON.stringify(values) !== JSON.stringify(expected)) errors.push(`${label} difere da sequência Markdown`);
  }
  if (coverPage && spineHrefs[0] !== 'cover.xhtml') errors.push('Capa ausente no início do spine');
  for (const item of manifest) if (!unique.has(`OEBPS/${item['@_href']}`)) errors.push(`Manifest sem recurso: ${item['@_href']}`);
  for (const chapter of chapters) {
    const item = manifest.find((entry) => entry['@_href'] === chapter.href);
    if (!item || item['@_media-type'] !== 'application/xhtml+xml') errors.push(`Capítulo ausente no manifest: ${chapter.href}`);
    const xml = zip.readAsText(`OEBPS/${chapter.href}`);
    const $ = cheerio.load(xml, { xmlMode: true });
    if ($('h1').first().text().trim() !== chapter.title) errors.push(`Título incorreto: ${chapter.href}`);
    if (sha($('body').text()) !== chapter.textSha256) errors.push(`Conteúdo alterado: ${chapter.href}`);
    $('a[href], img[src], link[href]').each((_, el) => {
      const target = $(el).attr('href') || $(el).attr('src');
      if (!target || /^(https?:|mailto:|data:)/i.test(target)) return;
      const [resource, fragment] = target.split('#');
      const resolved = resource ? path.posix.normalize(path.posix.join('OEBPS', resource)) : `OEBPS/${chapter.href}`;
      if (!unique.has(resolved)) errors.push(`Link quebrado: ${chapter.href} → ${target}`);
      else if (fragment && !cheerio.load(zip.readAsText(resolved), { xmlMode: true })(`[id="${fragment}"]`).length) errors.push(`Âncora quebrada: ${chapter.href} → ${target}`);
    });
  }
  const preflight = validateEpub3(
    { summary: { opfPath: 'OEBPS/content.opf', htmlItems: chapters.length + 1, spineItems: spine.length } },
    { chapterCount: chapters.length, chapters, sequence: validateChapterSequence(chapters), documents: [] },
    { hasNcx: ncxHrefs.length > 0 },
    { match: true }
  );
  errors.push(...preflight.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message));
  return { ok: errors.length === 0, errors, chapterCount: chapters.length, navEntries: navHrefs.length, ncxEntries: ncxHrefs.length, spineEntries: spine.length - Number(coverPage), coverPage, manifestEntries: manifest.length };
}

function checkOfficialEpub(file, jar) {
  const cached = path.join(ROOT, 'tools', 'epubcheck-5.4.0', 'epubcheck.jar');
  jar ||= fs.existsSync(cached) ? cached : undefined;
  const command = jar ? 'java' : 'epubcheck';
  const args = jar ? ['-jar', jar, file] : [file];
  const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (run.error) throw new Error(`EPUBCheck oficial indisponível: ${run.error.message}. Informe --epubcheck /caminho/epubcheck.jar ou EPUBCHECK_JAR.`);
  return { command: [command, ...args].join(' '), exitCode: run.status, output: `${run.stdout || ''}${run.stderr || ''}`.trim(), ok: run.status === 0 };
}

export function buildBook({ input, title, author, language = 'pt-BR', cover, output, report, epubcheck: epubcheckJar }) {
  if (!input || !title || !author) throw new Error('Informe --input, --title e --author.');
  const inputPath = expandPath(input);
  const outputName = output || path.join(ROOT, 'output', 'markdown.epub');
  const outputPath = output && path.dirname(output) === '.' ? path.join(ROOT, 'output', output) : outputName;
  const destination = expandPath(path.extname(outputPath) ? outputPath : `${outputPath}.epub`);
  const reportPath = expandPath(report || path.join(ROOT, 'reports', 'validation.json'));
  const coverPath = cover ? expandPath(cover) : undefined;
  const bookLanguage = normalizeLanguageTag(language);
  const insideInput = (candidate) => {
    const relative = path.relative(inputPath, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  };
  if (path.extname(destination).toLowerCase() !== '.epub') throw new Error('O arquivo de saída deve terminar em .epub.');
  if (insideInput(destination) || insideInput(reportPath)) throw new Error('EPUB e relatório devem ficar fora do diretório de entrada.');
  const chapters = discoverChapters(inputPath);
  const coverData = coverPath ? { href: `cover${path.extname(coverPath).toLowerCase()}`, mediaType: { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[path.extname(coverPath).toLowerCase()] } : null;
  if (cover && !coverData.mediaType) throw new Error('Capa deve ser JPG ou PNG.');
  if (cover && !fs.statSync(coverPath, { throwIfNoEntry: false })?.isFile()) throw new Error(`Capa inexistente: ${coverPath}`);
  const rendered = chapters.map((chapter) => ({ ...chapter, ...renderChapter(chapter, bookLanguage) }));
  const identifier = `urn:uuid:${randomUUID()}`;
  const reportData = { generatedAt: new Date().toISOString(), input: inputPath, output: destination, metadata: { title, author, language: bookLanguage, cover: coverPath || null }, chapters: rendered.map(({ name, chapterNumber, href, title, sourceSha256, textSha256, textLength }) => ({ name, chapterNumber, href, title, sourceSha256, textSha256, textLength })) };
  const entries = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
    { name: 'OEBPS/content.opf', data: Buffer.from(buildNewEpub3Opf({ title, author, language: bookLanguage, identifier, chapters: rendered, cover: coverData })) },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from(buildNavXhtml({ chapters: rendered }, bookLanguage)) },
    { name: 'OEBPS/toc.ncx', data: Buffer.from(buildNcx({ chapters: rendered }, { title, identifier })) },
    { name: 'OEBPS/style.css', data: Buffer.from('body { line-height: 1.5; margin: 5%; } h1 { text-align: center; } p { text-indent: 1.2em; } li p { text-indent: 0; } .cover { margin: 0; padding: 0; text-align: center; } .cover img { max-width: 100%; max-height: 100%; }') },
    ...rendered.map((chapter) => ({ name: `OEBPS/${chapter.href}`, data: Buffer.from(chapter.xml) }))
  ];
  if (coverData) {
    entries.push({ name: 'OEBPS/cover.xhtml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(bookLanguage)}" xml:lang="${escapeXml(bookLanguage)}"><head><title>Capa</title><link rel="stylesheet" type="text/css" href="style.css" /></head><body epub:type="cover" class="cover"><img src="${escapeXml(coverData.href)}" alt="Capa de ${escapeXml(title)}" /></body></html>`) });
    entries.push({ name: `OEBPS/${coverData.href}`, data: fs.readFileSync(coverPath) });
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp.epub`;
  try {
    writeZipFile(temporary, entries);
    reportData.internalValidation = validateBuiltEpub(temporary, rendered);
    if (!reportData.internalValidation.ok) throw new Error(reportData.internalValidation.errors.join('; '));
    reportData.epubcheck = checkOfficialEpub(temporary, epubcheckJar || process.env.EPUBCHECK_JAR ? expandPath(epubcheckJar || process.env.EPUBCHECK_JAR) : undefined);
    if (!reportData.epubcheck.ok) throw new Error(`EPUBCheck falhou: ${reportData.epubcheck.output}`);
    fs.renameSync(temporary, destination);
    reportData.ok = true;
  } catch (error) {
    reportData.ok = false;
    reportData.error = error.message;
    throw error;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.writeFileSync(reportPath, `${JSON.stringify(reportData, null, 2)}\n`);
  }
  return reportData;
}
