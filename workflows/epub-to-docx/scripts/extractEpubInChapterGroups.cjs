const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const { Document, Packer, Paragraph, HeadingLevel } = require("docx");

// Importar módulos
const config = require('./modules/config.cjs');
const utils = require('./modules/utils.cjs');
const textProcessor = require('./modules/text-processor.cjs');
const chapterParser = require('./modules/chapter-parser.cjs');
const epubReader = require('./modules/epub-reader.cjs');
const docxGenerator = require('./modules/docx-generator.cjs');
const validation = require('./modules/validation.cjs');

const { workflowDir, inputDir, TARGET_DOCX_KB, TARGET_DOCX_BYTES, MIN_SIGNIFICANT_TEXT_CHARS, VERBOSE } = config;
const { formatTimestampForPath, findSingleEpub, safeFileName, logVerbose } = utils;
const { normalizeText, cleanForDocx, titleCase, isTextualEpubPath } = textProcessor;
const { 
  parseChapterMetaFromTocTitle, 
  parseChapterHeader, 
  getChapterGroup, 
  makeFallbackMeta, 
  chapterHeading 
} = chapterParser;
const { 
  setZip, 
  loadOpfPath, 
  loadSpineItems, 
  loadTocItems, 
  mergeTocMetadataIntoSpineItems,
  readZipText 
} = epubReader;
const { 
  removeDuplicatedHeaders, 
  estimateChapterBytes, 
  groupChaptersByTargetSize, 
  writeDocxFile,
  readDocxParagraphTexts
} = docxGenerator;
const { 
  setReadZipText,
  auditSourceCoverage, 
  createCheck, 
  formatGroupRangeByPosition, 
  getWorkTitleFromToc 
} = validation;

// ============================================
// CONFIGURAÇÃO INICIAL
// ============================================

const inputEpub = process.argv[2]
  ? path.resolve(process.argv[2])
  : findSingleEpub(inputDir);

let outputDir = process.argv[3] ? path.resolve(process.argv[3]) : "";
let logsDir = "";

const runTimestamp = formatTimestampForPath();

const titleBasePath = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.join(workflowDir, "input", "chapter_titles.txt");

if (!Number.isFinite(TARGET_DOCX_KB) || TARGET_DOCX_KB <= 0) {
  throw new Error(`Tamanho-alvo inválido em KB: ${process.argv[5]}`);
}

if (!fs.existsSync(inputEpub)) {
  throw new Error(`EPUB não encontrado: ${inputEpub}`);
}

const zip = new AdmZip(inputEpub);
setZip(zip);
setReadZipText(readZipText);

// ============================================
// CARREGAR BASE DE TÍTULOS
// ============================================

function loadTitleBase(filePath) {
  const result = {
    arcNamesByNumber: new Map(),
    chapterTitlesByNumber: new Map(),
  };

  if (!fs.existsSync(filePath)) {
    console.warn(`Base de títulos não encontrada: ${filePath}`);
    return result;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const text = normalizeText(line);
    const volumeMatch = text.match(/^\*\*Volume\s+(\d+):\s*(.+?)\*\*$/i);
    if (volumeMatch) {
      result.arcNamesByNumber.set(
        Number(volumeMatch[1]),
        titleCase(cleanBaseTitle(volumeMatch[2]))
      );
      continue;
    }
    const chapterMatch = text.match(/^(\d+)\.\s+(.+)$/);
    if (chapterMatch) {
      result.chapterTitlesByNumber.set(
        chapterMatch[1],
        titleCase(cleanBaseTitle(chapterMatch[2]))
      );
    }
  }
  return result;
}

function cleanBaseTitle(title) {
  return normalizeText(title)
    .replace(/^\[|\]$/g, "")
    .replace(/\.\.\.$/, "...")
    .trim();
}

const TITLE_BASE = loadTitleBase(titleBasePath);

// ============================================
// EXTRAÇÃO DE PARÁGRAFOS (com cache)
// ============================================

const paragraphCache = new Map();

async function extractChapterParagraphs(chapterPath) {
  if (paragraphCache.has(chapterPath)) {
    return paragraphCache.get(chapterPath);
  }
  
  const html = readZipText(chapterPath);
  const $ = require('cheerio').load(html);
  $("script, style").remove();
  
  const paragraphs = [];
  $("h1, h2, h3, h4, p").each((_, el) => {
    const text = normalizeText($(el).text());
    if (text) paragraphs.push(text);
  });
  
  if (paragraphs.length === 0) {
    const fallback = normalizeText($("body").text());
    if (fallback) paragraphs.push(fallback);
  }
  
  paragraphCache.set(chapterPath, paragraphs);
  return paragraphs;
}

// ============================================
// BUILD ITENS TEXTUAIS DO SPINE
// ============================================

async function buildAllTextualItemsFromSpine(spineItemsWithTitles) {
  const result = [];
  let position = 0;
  
  for (const item of spineItemsWithTitles) {
    if (!isTextualEpubPath(item.path)) continue;
    position++;
    
    const paragraphs = await extractChapterParagraphs(item.path);
    const charCount = paragraphs.join("\n").length;
    const paragraphCount = paragraphs.length;
    
    const textualItem = {
      title: item.title,
      path: item.path,
      paragraphs,
      charCount,
      paragraphCount,
      position,
    };
    
    if (charCount >= MIN_SIGNIFICANT_TEXT_CHARS) {
      result.push(textualItem);
      continue;
    }
    
    const metaFromToc = parseChapterMetaFromTocTitle(item.title);
    const metaFromHeader = parseChapterHeader(paragraphs, item.title);
    
    if (metaFromToc || metaFromHeader) {
      result.push(textualItem);
    } else {
      console.log(`Ignorado (pequeno e sem título): ${item.path} | ${charCount} chars | ${item.title || "(sem título)"}`);
    }
  }
  
  console.log(`Itens textuais relevantes após filtro: ${result.length}`);
  return result;
}

// ============================================
// ENRIQUECER ITEM TEXTUAL
// ============================================

async function enrichTextualItem(item, position) {
  const metaFromToc = parseChapterMetaFromTocTitle(item.title);
  const metaFromHeader = parseChapterHeader(item.paragraphs, item.title);

  let meta = metaFromToc || metaFromHeader || makeFallbackMeta(item, position);

  const group = getChapterGroup(meta.chapterNumber);
  const titleFromBase = TITLE_BASE.chapterTitlesByNumber.get(group);

  if (titleFromBase && !meta.isFallback) {
    meta.chapterTitle = titleFromBase;
  }

  logVerbose(`Item ${position}: ${meta.isFallback ? '[FALLBACK]' : '[NORMAL]'} ${meta.chapterTitle || meta.chapterNumber} - ${item.path}`);

  return {
    title: item.title,
    path: item.path,
    paragraphs: item.paragraphs,
    charCount: item.charCount,
    paragraphCount: item.paragraphCount,
    meta,
    position,
  };
}

// ============================================
// BUILD VALIDATION REPORT
// ============================================

function buildValidationReport({
  tocItems,
  spineItems,
  textualItems,
  allChapters,
  groups,
  generatedFiles,
  workTitle,
  auditReport,
}) {
  const extractedPaths = new Set(allChapters.map((chapter) => chapter.path));

  const ignoredTextualItems = textualItems.filter(
    (item) => !extractedPaths.has(item.path) && item.charCount >= MIN_SIGNIFICANT_TEXT_CHARS
  );

  const fallbackChapters = allChapters.filter((chapter) => chapter.meta.isFallback);

  const emptyChapters = allChapters.filter((chapter) => {
    const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);
    return bodyParagraphs.length === 0;
  });

  const expectedPositions = allChapters.map((_, index) => index + 1);
  const generatedPositions = generatedFiles.flatMap((file) =>
    file.chapters.map((chapter) => chapter.position)
  );

  const orderMatches =
    expectedPositions.length === generatedPositions.length &&
    expectedPositions.every((position, index) => position === generatedPositions[index]);

  const fileReports = generatedFiles.map((file) => {
    const exists = fs.existsSync(file.outputPath);
    const sizeBytes = exists ? fs.statSync(file.outputPath).size : 0;
    const docxParagraphs = exists ? readDocxParagraphTexts(file.outputPath) : [];

    const missingHeadings = file.chapters
      .map((chapter) => chapter.heading)
      .filter((heading) => !docxParagraphs.includes(heading));

    const paragraphCountOk = docxParagraphs.length >= file.expectedParagraphCount;

    return {
      fileName: file.fileName,
      outputPath: file.outputPath,
      exists,
      sizeBytes,
      sizeKB: Number((sizeBytes / 1024).toFixed(1)),
      expectedParagraphCount: file.expectedParagraphCount,
      docxParagraphCount: docxParagraphs.length,
      paragraphCountOk,
      missingHeadings,
      chapters: file.chapters,
    };
  });

  const checks = [
    createCheck(
      "Nenhum bloco textual grande ignorado (filtro)",
      ignoredTextualItems.length === 0,
      ignoredTextualItems.length
        ? ignoredTextualItems.map((item) => `${item.title || "(sem título)"} - ${item.path} - ${item.charCount} caracteres`).join("; ")
        : "Nenhum bloco textual grande ficou fora do filtro."
    ),
    createCheck(
      "Nenhum capítulo sem conteúdo",
      emptyChapters.length === 0,
      emptyChapters.length
        ? emptyChapters.map((chapter) => `${chapter.position}: ${chapterHeading(chapter.meta, chapter.title)}`).join("; ")
        : "Todos os capítulos têm corpo de texto."
    ),
    createCheck(
      "Ordem dos capítulos",
      orderMatches,
      orderMatches
        ? "A ordem gerada segue a ordem textual do EPUB."
        : `Esperado ${expectedPositions.join(", ")}; gerado ${generatedPositions.join(", ")}`
    ),
    createCheck(
      "Quantidade de DOCX",
      generatedFiles.length === groups.length,
      `${generatedFiles.length}/${groups.length}`
    ),
    createCheck(
      "Arquivos DOCX existentes",
      fileReports.every((file) => file.exists && file.sizeBytes > 0),
      fileReports.filter((file) => !file.exists || file.sizeBytes === 0).map((file) => file.fileName).join("; ") || "Todos os DOCX foram criados com conteúdo."
    ),
    createCheck(
      "Títulos encontrados nos DOCX",
      fileReports.every((file) => file.missingHeadings.length === 0),
      fileReports.filter((file) => file.missingHeadings.length > 0).map((file) => `${file.fileName}: ${file.missingHeadings.join("; ")}`).join(" | ") || "Todos os títulos esperados foram encontrados."
    ),
    createCheck(
      "Contagem mínima de parágrafos nos DOCX",
      fileReports.every((file) => file.paragraphCountOk),
      fileReports.filter((file) => !file.paragraphCountOk).map((file) => `${file.fileName}: ${file.docxParagraphCount}/${file.expectedParagraphCount}`).join("; ") || "Todos os DOCX têm a contagem mínima esperada."
    ),
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "OK") ? "OK" : "FAIL",
    epub: inputEpub,
    outputDir,
    logsDir,
    workTitle,
    targetDocxKB: TARGET_DOCX_KB,
    minSignificantTextChars: MIN_SIGNIFICANT_TEXT_CHARS,
    summary: {
      tocItems: tocItems.length,
      spineItems: spineItems.length,
      textualItemsFromSpine: textualItems.length,
      extractedItems: allChapters.length,
      fallbackChapters: fallbackChapters.length,
      docxFiles: generatedFiles.length,
      emptyChapters: emptyChapters.length,
      ignoredTextualItems: ignoredTextualItems.length,
      obligatoryItems: auditReport.summary.obligatoryItems,
      missingObligatoryItems: auditReport.summary.missingObligatoryItems,
    },
    checks,
    fallbackChapters: fallbackChapters.map((chapter) => ({
      position: chapter.position,
      title: chapter.title,
      sourcePath: chapter.path,
      heading: chapterHeading(chapter.meta, chapter.title),
      charCount: chapter.charCount,
    })),
    ignoredTextualItems,
    audit: auditReport,
    files: fileReports,
  };
}

function buildValidationSummaryText(report) {
  const lines = [
    `Status: ${report.status}`,
    `EPUB: ${report.epub}`,
    `Saída: ${report.outputDir}`,
    `Obra: ${report.workTitle}`,
    `Tamanho-alvo por DOCX: ${report.targetDocxKB} KB`,
    `Itens no TOC: ${report.summary.tocItems}`,
    `Itens no spine: ${report.summary.spineItems}`,
    `Itens textuais relevantes do spine: ${report.summary.textualItemsFromSpine}`,
    `Itens extraídos: ${report.summary.extractedItems}`,
    `Blocos fallback: ${report.summary.fallbackChapters}`,
    `Blocos obrigatórios do spine: ${report.summary.obligatoryItems}`,
    `Blocos obrigatórios ausentes: ${report.summary.missingObligatoryItems}`,
    `DOCX gerados: ${report.summary.docxFiles}`,
    "",
    "Validações:",
  ];

  for (const check of report.checks) {
    lines.push(`- ${check.status}: ${check.name} - ${check.detail}`);
  }

  if (report.fallbackChapters.length) {
    lines.push("", "Blocos incluídos por fallback:");
    for (const chapter of report.fallbackChapters) {
      lines.push(`- ${chapter.position}: ${chapter.heading} | ${chapter.charCount} chars | ${chapter.sourcePath}`);
    }
  }

  if (report.ignoredTextualItems.length) {
    lines.push("", "Blocos textuais ignorados (pequenos e sem título):");
    for (const item of report.ignoredTextualItems) {
      lines.push(`- ${item.title || "(sem título)"} | ${item.charCount} chars | ${item.path}`);
    }
  }

  if (report.audit.missingObligatoryItems > 0) {
    lines.push("", "⚠️  BLOCOS OBRIGATÓRIOS AUSENTES DOS DOCX:");
    for (const missing of report.audit.missingItems) {
      lines.push(`- ${missing.path} | ${missing.charCount} chars | título TOC: ${missing.title}`);
    }
  }

  lines.push("", "Arquivos:");
  for (const file of report.files) {
    const chapterRange = file.chapters.map((chapter) => chapter.position).join(", ");
    lines.push(`- ${file.fileName}: itens ${chapterRange}; ${file.sizeKB} KB; ${file.docxParagraphCount} parágrafos`);
  }

  return `${lines.join("\n")}\n`;
}

function writeValidationReports(report) {
  const jsonPath = path.join(logsDir, "validation-report.json");
  const textPath = path.join(logsDir, "validation-summary.txt");

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(textPath, buildValidationSummaryText(report), "utf8");

  console.log(`Relatório de validação: ${textPath}`);
  console.log(`Manifesto detalhado: ${jsonPath}`);
  console.log(`Status da validação: ${report.status}`);
}

// ============================================
// MAIN
// ============================================

(async () => {
  const tocItems = loadTocItems();
  const workTitle = getWorkTitleFromToc(tocItems, inputEpub);

  if (!outputDir) {
    outputDir = path.join(workflowDir, "output", `${safeFileName(workTitle)}-${runTimestamp}`);
  }

  logsDir = path.join(workflowDir, "logs", `${safeFileName(workTitle)}-${runTimestamp}`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  console.log(`EPUB: ${inputEpub}`);
  console.log(`Saída: ${outputDir}`);
  console.log(`Logs: ${logsDir}`);
  console.log(`Base de títulos: ${titleBasePath}`);
  console.log(`Tamanho-alvo por DOCX: ${TARGET_DOCX_KB} KB`);

  const opfPath = loadOpfPath();
  console.log(`Arquivo OPF encontrado: ${opfPath}`);
  
  const spineItems = loadSpineItems(opfPath);
  const spineItemsWithTitles = mergeTocMetadataIntoSpineItems(spineItems, tocItems);
  const textualItems = await buildAllTextualItemsFromSpine(spineItemsWithTitles);

  console.log(`Itens no TOC: ${tocItems.length}`);
  console.log(`Itens no spine: ${spineItems.length}`);
  console.log(`Itens textuais relevantes extraídos do spine: ${textualItems.length}`);

  const allChapters = [];

  for (const item of textualItems) {
    if (item.charCount === 0) continue;
    const chapter = await enrichTextualItem(item, allChapters.length + 1);
    allChapters.push(chapter);
  }

  if (!allChapters.length) {
    console.warn("Nenhum item textual encontrado para gerar DOCX.");
    return;
  }

  console.log(`Itens extraídos para DOCX: ${allChapters.length}`);

  const fallbackCount = allChapters.filter((chapter) => chapter.meta.isFallback).length;
  if (fallbackCount > 0) {
    console.warn(`Atenção: ${fallbackCount} bloco(s) foram incluídos por fallback, pois não tinham título padrão de capítulo.`);
  }

  const groups = groupChaptersByTargetSize(allChapters, TARGET_DOCX_BYTES);
  const generatedFiles = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const range = formatGroupRangeByPosition(group, allChapters.length);
    const fileName = `${safeFileName(workTitle)}_cap_${range}.docx`;

    for (const chapter of group) {
      chapter.outputFile = fileName;
    }

    generatedFiles.push(
      await writeDocxFile({
        title: `Chapter Group ${String(i + 1).padStart(3, "0")}`,
        chapters: group,
        fileName,
        outputDir,
      })
    );
  }

  const { auditReport } = auditSourceCoverage(spineItems, generatedFiles, workTitle, allChapters);
  
  const report = buildValidationReport({
    tocItems,
    spineItems,
    textualItems,
    allChapters,
    groups,
    generatedFiles,
    workTitle,
    auditReport,
  });

  writeValidationReports(report);

  if (report.status !== "OK") {
    process.exitCode = 1;
  }
})();