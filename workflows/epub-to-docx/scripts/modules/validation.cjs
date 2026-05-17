const fs = require("fs");
const crypto = require("crypto");
const { normalizeText } = require('./text-processor.cjs');
const { isTextualEpubPath } = require('./text-processor.cjs');
const { chapterHeading } = require('./chapter-parser.cjs');
const { readDocxParagraphTexts } = require('./docx-generator.cjs');
const { MIN_SIGNIFICANT_TEXT_CHARS } = require('./config.cjs');

// Será preenchido pelo módulo principal
let readZipText = null;

function setReadZipText(fn) {
  readZipText = fn;
}

function extractChapterParagraphsSync(chapterPath) {
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
  
  return paragraphs;
}

function auditSourceCoverage(spineItems, generatedFiles, workTitle, allChapters) {
  console.log("\n=== INICIANDO AUDITORIA INDEPENDENTE DE COBERTURA ===\n");
  
  const processedPaths = new Set();
  const chapterMap = new Map();
  
  for (const chapter of allChapters) {
    processedPaths.add(chapter.path);
    chapterMap.set(chapter.path, {
      position: chapter.position,
      charCount: chapter.charCount,
      isFallback: chapter.meta.isFallback,
      heading: chapterHeading(chapter.meta, chapter.title)
    });
  }
  
  const spineAnalysis = [];
  
  for (const item of spineItems) {
    if (!isTextualEpubPath(item.path)) continue;
    
    const paragraphs = extractChapterParagraphsSync(item.path);
    const fullText = paragraphs.join("\n\n");
    const charCount = fullText.length;
    const paragraphCount = paragraphs.length;
    
    const wasProcessed = processedPaths.has(item.path);
    const chapterInfo = chapterMap.get(item.path);
    
    spineAnalysis.push({
      path: item.path,
      title: item.title,
      position: item.position,
      charCount,
      paragraphCount,
      isObligatory: charCount >= MIN_SIGNIFICANT_TEXT_CHARS,
      wasProcessed: wasProcessed,
      wasProcessedAsFallback: wasProcessed && chapterInfo ? chapterInfo.isFallback : false,
      outputPosition: wasProcessed && chapterInfo ? chapterInfo.position : null,
      outputHeading: wasProcessed && chapterInfo ? chapterInfo.heading : null,
    });
  }
  
  const docxStats = [];
  let totalDocxParagraphs = 0;
  
  for (const file of generatedFiles) {
    if (!fs.existsSync(file.outputPath)) continue;
    const paragraphs = readDocxParagraphTexts(file.outputPath);
    totalDocxParagraphs += paragraphs.length;
    docxStats.push({
      fileName: file.fileName,
      chapterCount: file.chapters.length,
      paragraphCount: paragraphs.length,
      chapters: file.chapters.map(c => ({
        position: c.position,
        sourcePath: c.sourcePath,
        heading: c.heading
      }))
    });
  }
  
  const obligatoryItems = spineAnalysis.filter(a => a.isObligatory);
  const missingObligatory = obligatoryItems.filter(a => !a.wasProcessed);
  const processedObligatory = obligatoryItems.filter(a => a.wasProcessed);
  const fallbackObligatory = obligatoryItems.filter(a => a.wasProcessed && a.wasProcessedAsFallback);
  const smallItemsProcessed = spineAnalysis.filter(a => !a.isObligatory && a.wasProcessed);
  
  const auditReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSpineItems: spineItems.length,
      textualSpineItems: spineAnalysis.length,
      obligatoryItems: obligatoryItems.length,
      processedObligatoryItems: processedObligatory.length,
      missingObligatoryItems: missingObligatory.length,
      fallbackObligatoryItems: fallbackObligatory.length,
      smallItemsProcessed: smallItemsProcessed.length,
      totalDocxFiles: generatedFiles.length,
      totalDocxParagraphs: totalDocxParagraphs,
    },
    missingItems: missingObligatory.map(item => ({
      path: item.path,
      title: item.title || "(sem título)",
      charCount: item.charCount,
      position: item.position,
      paragraphCount: item.paragraphCount,
    })),
    fallbackItems: fallbackObligatory.map(item => ({
      path: item.path,
      title: item.title || "(sem título)",
      charCount: item.charCount,
      position: item.position,
      outputPosition: item.outputPosition,
      outputHeading: item.outputHeading,
    })),
    docxFiles: docxStats,
  };
  
  console.log("\n=== RELATÓRIO DA AUDITORIA ===");
  console.log(`Total de itens no spine: ${auditReport.summary.totalSpineItems}`);
  console.log(`Itens textuais no spine: ${auditReport.summary.textualSpineItems}`);
  console.log(`Blocos obrigatórios (>=${MIN_SIGNIFICANT_TEXT_CHARS} chars): ${auditReport.summary.obligatoryItems}`);
  console.log(`Blocos obrigatórios processados: ${auditReport.summary.processedObligatoryItems}`);
  console.log(`Blocos obrigatórios NÃO processados: ${auditReport.summary.missingObligatoryItems}`);
  console.log(`Blocos obrigatórios processados como fallback: ${auditReport.summary.fallbackObligatoryItems}`);
  
  if (auditReport.summary.missingObligatoryItems > 0) {
    console.warn("\n⚠️  BLOCOS OBRIGATÓRIOS NÃO PROCESSADOS:");
    for (const missing of auditReport.missingItems) {
      console.warn(`  - ${missing.path} | ${missing.charCount} chars | título: ${missing.title}`);
    }
  }
  
  if (auditReport.summary.fallbackObligatoryItems > 0) {
    console.log("\n✅ BLOCOS OBRIGATÓRIOS PROCESSADOS COMO FALLBACK:");
    for (const fallback of auditReport.fallbackItems) {
      console.log(`  - ${fallback.path} | ${fallback.charCount} chars | saiu como: "${fallback.outputHeading}"`);
    }
  }
  
  console.log("\n=== FIM DA AUDITORIA ===\n");
  
  return { auditReport };
}

function createCheck(name, ok, detail) {
  return { name, status: ok ? "OK" : "FAIL", detail };
}

function formatGroupRangeByPosition(group, total) {
  const width = Math.max(2, String(total).length);
  const pad = (value) => String(value).padStart(width, "0");
  const first = group[0].position;
  const last = group[group.length - 1].position;
  return `${pad(first)}-${pad(last)}`;
}

function getWorkTitleFromToc(items, fallbackPath) {
  const { parseChapterMetaFromTocTitle } = require('./chapter-parser.cjs');
  const firstTitle = items.find((item) => item.title)?.title;
  if (firstTitle && !parseChapterMetaFromTocTitle(firstTitle)) {
    return firstTitle;
  }
  return path.basename(fallbackPath, path.extname(fallbackPath));
}

module.exports = {
  setReadZipText,
  auditSourceCoverage,
  createCheck,
  formatGroupRangeByPosition,
  getWorkTitleFromToc,
};