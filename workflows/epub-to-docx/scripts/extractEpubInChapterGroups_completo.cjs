// epub-to-docx.js
// Correções:
// 1. Usa spine como fonte principal de ordem de leitura.
// 2. Não ignora blocos grandes sem título padrão.
// 3. Agrupa por tamanho aproximado, não por quantidade fixa.
// 4. Valida itens textuais do EPUB que ficaram fora usando auditoria independente.

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const cheerio = require("cheerio");
const { Document, Packer, Paragraph, HeadingLevel } = require("docx");
const crypto = require("crypto");

const workflowDir = path.resolve(__dirname, "..");
const inputDir = path.join(workflowDir, "input");

const inputEpub = process.argv[2]
  ? path.resolve(process.argv[2])
  : findSingleEpub(inputDir);

let outputDir = process.argv[3] ? path.resolve(process.argv[3]) : "";
let logsDir = "";

const runTimestamp = formatTimestampForPath();

const titleBasePath = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.join(workflowDir, "input", "chapter_titles.txt");

// Tamanho-alvo por DOCX em KB.
const TARGET_DOCX_KB = Number(process.argv[5] || 400);
const TARGET_DOCX_BYTES = TARGET_DOCX_KB * 1024;

// Blocos textuais acima disso não podem ser ignorados sem alerta.
const MIN_SIGNIFICANT_TEXT_CHARS = 5000;

if (!Number.isFinite(TARGET_DOCX_KB) || TARGET_DOCX_KB <= 0) {
  throw new Error(`Tamanho-alvo inválido em KB: ${process.argv[5]}`);
}

if (!fs.existsSync(inputEpub)) {
  throw new Error(`EPUB não encontrado: ${inputEpub}`);
}

const zip = new AdmZip(inputEpub);

function formatTimestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    [pad(date.getDate()), pad(date.getMonth() + 1), date.getFullYear()].join("-") +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("-")
  );
}

function findSingleEpub(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Pasta de entrada não encontrada: ${dir}`);
  }

  const epubFiles = fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".epub"))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  if (epubFiles.length === 0) {
    throw new Error(`Nenhum arquivo .epub encontrado em: ${dir}`);
  }

  if (epubFiles.length > 1) {
    throw new Error(
      `Mais de um arquivo .epub encontrado em ${dir}. Informe o EPUB explicitamente.`
    );
  }

  return path.join(dir, epubFiles[0]);
}

function cleanForDocx(text) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\uFFFE|\uFFFF/g, "")
    .trim();
}

function normalizeText(text) {
  return cleanForDocx(text).replace(/\s+/g, " ").trim();
}

function readZipText(filePath) {
  const entry = zip.getEntry(filePath);
  if (!entry) throw new Error(`Arquivo não encontrado no EPUB: ${filePath}`);
  return entry.getData().toString("utf8");
}

function safeFileName(name) {
  return normalizeText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_");
}

function titleCase(str) {
  if (!str) return "";

  const lowerWords = new Set([
    "a", "an", "and", "as", "at", "but", "by", "for", "from",
    "in", "into", "nor", "of", "on", "or", "over", "the", "to", "with",
  ]);

  return normalizeText(str)
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanBaseTitle(title) {
  return normalizeText(title)
    .replace(/^\[|\]$/g, "")
    .replace(/\.\.\.$/, "...")
    .trim();
}

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

const TITLE_BASE = loadTitleBase(titleBasePath);

function parseChapterMetaFromTocTitle(title) {
  const text = normalizeText(title);

  if (/^prologue$/i.test(text) || /^epilogue$/i.test(text)) {
    const label = titleCase(text);

    return {
      arcName: "",
      chapterNumber: label,
      chapterTitle: label,
      rawLines: [],
      isFallback: false,
    };
  }

  let match = text.match(/^(\d+)\.\s+(.+)$/);

  if (!match) {
    match = text.match(/\b(\d+)\.\s+(.+?)(?:\s+\(\d+\/\d+\))?$/);
  }

  if (!match) return null;

  return {
    arcName: "",
    chapterNumber: normalizeText(match[1]),
    chapterTitle: titleCase(match[2]),
    rawLines: [],
    isFallback: false,
  };
}

function parseChapterHeader(lines, tocTitle = "") {
  const cleanLines = lines.slice(0, 40).map(normalizeText).filter(Boolean);

  for (const text of cleanLines) {
    const titledMatch = text.match(/^(.*?)Chapter\s+([\d.]+)\s*:\s*(.+)$/i);

    if (titledMatch) {
      return {
        arcName: normalizeText(titledMatch[1]),
        chapterNumber: normalizeText(titledMatch[2]),
        chapterTitle: titleCase(titledMatch[3]),
        rawLines: [text],
        isFallback: false,
      };
    }
  }

  for (let i = 0; i < cleanLines.length - 1; i++) {
    const current = cleanLines[i];
    const next = cleanLines[i + 1];

    const splitMatch = next.match(/^Chapter\s+([\d.]+)\s*:\s*(.+)$/i);

    if (splitMatch && !/^WTNL/i.test(current) && !/^Chapter/i.test(current)) {
      return {
        arcName: current,
        chapterNumber: normalizeText(splitMatch[1]),
        chapterTitle: titleCase(splitMatch[2]),
        rawLines: [current, next],
        isFallback: false,
      };
    }
  }

  for (const text of cleanLines) {
    const looseMatch = text.match(/^Chapter\s+([\d.]+)\s*:\s*(.+)$/i);

    if (looseMatch) {
      return {
        arcName: "",
        chapterNumber: normalizeText(looseMatch[1]),
        chapterTitle: titleCase(looseMatch[2]),
        rawLines: [text],
        isFallback: false,
      };
    }
  }

  const tocMatch = normalizeText(tocTitle).match(
    /Chapter\s+([\d.]+)(?::\s*(.+))?/i
  );

  if (tocMatch) {
    return {
      arcName: "",
      chapterNumber: normalizeText(tocMatch[1]),
      chapterTitle: tocMatch[2] ? titleCase(tocMatch[2]) : "",
      rawLines: [],
      isFallback: false,
    };
  }

  return null;
}

function getChapterGroup(chapterNumber) {
  return String(chapterNumber).split(".")[0];
}

function isTextualEpubPath(filePath) {
  return /\.(xhtml|html|htm)$/i.test(filePath);
}

async function extractChapterParagraphs(chapterPath) {
  const html = readZipText(chapterPath);
  const $ = cheerio.load(html);

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

function removeDuplicatedHeaders(paragraphs, meta) {
  if (!meta) return paragraphs.filter((p) => normalizeText(p));

  const escapedNumber = String(meta.chapterNumber || "").replace(/\./g, "\\.");

  return paragraphs.filter((p, index) => {
    const text = normalizeText(p);
    if (!text) return false;

    if (
      index < 3 &&
      /^(prologue|epilogue)$/i.test(meta.chapterNumber) &&
      new RegExp(`^${meta.chapterNumber}$`, "i").test(text)
    ) {
      return false;
    }

    if (
      index < 3 &&
      /^\d+$/.test(String(meta.chapterNumber)) &&
      new RegExp(`\\b${escapedNumber}\\.\\s+.+`, "i").test(text) &&
      text.length <= 180
    ) {
      return false;
    }

    if (/^WTNL\s+Chapter\s+[\d.]+(\s+\[.*?\])?$/i.test(text)) return false;
    if (/^Chapter\s+[\d.]+$/i.test(text)) return false;
    if (/^Chapter\s+[\d.]+\s+\[Arc\s*\d+\]$/i.test(text)) return false;

    if (
      escapedNumber &&
      new RegExp(
        `^Chapter\\s+${escapedNumber}\\s+\\[Arc\\s*\\d+\\]$`,
        "i"
      ).test(text)
    ) {
      return false;
    }

    if (escapedNumber) {
      const chapterHeaderRegex = new RegExp(
        `^.*?Chapter\\s+${escapedNumber}(?::.*)?$`,
        "i"
      );

      if (chapterHeaderRegex.test(text)) return false;
    }

    if (/^Thank you\s+@.+?\s+for the Kofi\.?$/i.test(text)) return false;
    if (/^Thanks\s+@.+?\s+for the Kofi\.?$/i.test(text)) return false;

    if (meta.rawLines && meta.rawLines.includes(text)) return false;

    return true;
  });
}

function chapterHeading(meta, fallbackTitle) {
  if (!meta) return normalizeText(fallbackTitle || "Untitled");

  if (/^prologue$/i.test(meta.chapterNumber)) {
    return normalizeText(meta.chapterTitle || fallbackTitle || "Prologue");
  }

  if (/^epilogue$/i.test(meta.chapterNumber)) {
    return normalizeText(meta.chapterTitle || fallbackTitle || "Epilogue");
  }

  if (meta.isFallback) {
    return normalizeText(meta.chapterTitle || fallbackTitle || meta.chapterNumber);
  }

  if (meta.chapterTitle) {
    return normalizeText(`Chapter ${meta.chapterNumber} - ${meta.chapterTitle}`);
  }

  if (fallbackTitle && /Chapter/i.test(fallbackTitle)) {
    return normalizeText(fallbackTitle.replace(":", " -"));
  }

  return normalizeText(`Chapter ${meta.chapterNumber} - Untitled`);
}

function estimateChapterBytes(chapter) {
  const heading = chapterHeading(chapter.meta, chapter.title);
  const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);
  const text = [heading, ...bodyParagraphs].join("\n\n");

  return Buffer.byteLength(text, "utf8");
}

function groupChaptersByTargetSize(chapters, targetBytes) {
  const groups = [];
  let current = [];
  let currentBytes = 0;

  for (const chapter of chapters) {
    const chapterBytes = estimateChapterBytes(chapter);

    if (current.length > 0 && currentBytes + chapterBytes > targetBytes) {
      groups.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(chapter);
    currentBytes += chapterBytes;

    if (chapterBytes >= targetBytes) {
      groups.push(current);
      current = [];
      currentBytes = 0;
    }
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

function readDocxParagraphTexts(filePath) {
  const docxZip = new AdmZip(filePath);
  const entry = docxZip.getEntry("word/document.xml");

  if (!entry) return [];

  const xml = entry.getData().toString("utf8");
  const $ = cheerio.load(xml, { xmlMode: true });
  const paragraphs = [];

  $("w\\:p").each((_, paragraph) => {
    const parts = [];

    $(paragraph)
      .find("w\\:t")
      .each((__, textNode) => {
        parts.push($(textNode).text());
      });

    const text = normalizeText(parts.join(""));
    if (text) paragraphs.push(text);
  });

  return paragraphs;
}

function createCheck(name, ok, detail) {
  return {
    name,
    status: ok ? "OK" : "FAIL",
    detail,
  };
}

function getWorkTitleFromToc(items, fallbackPath) {
  const firstTitle = items.find((item) => item.title)?.title;

  if (firstTitle && !parseChapterMetaFromTocTitle(firstTitle)) {
    return firstTitle;
  }

  return path.basename(fallbackPath, path.extname(fallbackPath));
}

function formatGroupRangeByPosition(group, total) {
  const width = Math.max(2, String(total).length);
  const pad = (value) => String(value).padStart(width, "0");

  const first = group[0].position;
  const last = group[group.length - 1].position;

  return `${pad(first)}-${pad(last)}`;
}

function makeFallbackMeta(item, position) {
  const title = normalizeText(item.title);

  return {
    arcName: "",
    chapterNumber: `Extra ${position}`,
    chapterTitle: title || `Bloco sem título ${position}`,
    rawLines: [],
    isFallback: true,
  };
}

// Função: Carrega o caminho do arquivo .opf
function loadOpfPath() {
  const containerXml = readZipText("META-INF/container.xml");
  const $ = cheerio.load(containerXml, { xmlMode: true });
  
  const rootfile = $("rootfile").attr("full-path");
  
  if (!rootfile) {
    throw new Error("Não foi possível encontrar rootfile em META-INF/container.xml");
  }
  
  return rootfile.replace(/\\/g, "/");
}

// Função: Carrega itens do spine na ordem correta
function loadSpineItems(opfPath) {
  const opfDir = path.dirname(opfPath);
  const opfContent = readZipText(opfPath);
  const $ = cheerio.load(opfContent, { xmlMode: true });
  
  // Mapa do manifest: id → href
  const manifestMap = new Map();
  $("manifest item").each((_, item) => {
    const id = $(item).attr("id");
    const href = $(item).attr("href");
    const mediaType = $(item).attr("media-type");
    
    if (id && href) {
      manifestMap.set(id, { href, mediaType });
    }
  });
  
  // Ler spine na ordem
  const spineItems = [];
  let position = 0;
  
  $("spine itemref").each((_, itemref) => {
    const idref = $(itemref).attr("idref");
    if (!idref) return;
    
    const manifestItem = manifestMap.get(idref);
    if (!manifestItem) {
      console.warn(`Aviso: idref "${idref}" não encontrado no manifest`);
      return;
    }
    
    const { href, mediaType } = manifestItem;
    
    // Verificar se é arquivo textual
    const isTextual = mediaType && (
      mediaType === "application/xhtml+xml" ||
      mediaType === "text/html" ||
      /\.(x?html?|htm)$/i.test(href)
    );
    
    if (!isTextual) return;
    
    const fullPath = path.normalize(path.join(opfDir, href)).replace(/\\/g, "/");
    position++;
    
    spineItems.push({
      id: idref,
      path: fullPath,
      mediaType,
      position,
      title: "", // Será preenchido depois pelo TOC
    });
  });
  
  console.log(`Itens textuais no spine (ordem de leitura): ${spineItems.length}`);
  return spineItems;
}

// Função: Mescla títulos do TOC nos itens do spine
function mergeTocMetadataIntoSpineItems(spineItems, tocItems) {
  // Criar mapa path → título do TOC
  const tocTitleMap = new Map();
  
  for (const tocItem of tocItems) {
    // Normalizar caminho para comparação
    const normalizedPath = tocItem.path.replace(/\\/g, "/");
    tocTitleMap.set(normalizedPath, tocItem.title);
  }
  
  // Atualizar títulos dos spine items
  const mergedItems = spineItems.map(item => {
    const tocTitle = tocTitleMap.get(item.path);
    
    return {
      ...item,
      title: tocTitle || "",
    };
  });
  
  const matchedCount = mergedItems.filter(item => item.title).length;
  console.log(`${matchedCount}/${mergedItems.length} itens do spine têm título correspondente no TOC`);
  
  return mergedItems;
}

// Função: Constrói itens textuais a partir do spine com filtro inteligente
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
    
    // FILTRO INTELIGENTE:
    // Se charCount >= MIN_SIGNIFICANT_TEXT_CHARS, incluir SEMPRE
    if (charCount >= MIN_SIGNIFICANT_TEXT_CHARS) {
      result.push(textualItem);
      continue;
    }
    
    // Se charCount < MIN_SIGNIFICANT_TEXT_CHARS, incluir APENAS se for capítulo reconhecível
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

async function enrichTextualItem(item, position) {
  const metaFromToc = parseChapterMetaFromTocTitle(item.title);
  const metaFromHeader = parseChapterHeader(item.paragraphs, item.title);

  let meta = metaFromToc || metaFromHeader || makeFallbackMeta(item, position);

  const group = getChapterGroup(meta.chapterNumber);
  const titleFromBase = TITLE_BASE.chapterTitlesByNumber.get(group);

  if (titleFromBase && !meta.isFallback) {
    meta.chapterTitle = titleFromBase;
  }

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

async function writeDocxFile({ title, chapters, fileName }) {
  const children = [
    new Paragraph({
      text: cleanForDocx(title),
      heading: HeadingLevel.TITLE,
    }),
  ];

  const chapterReports = [];

  for (const chapter of chapters) {
    const heading = chapterHeading(chapter.meta, chapter.title);

    children.push(
      new Paragraph({
        text: cleanForDocx(heading),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 380 },
      })
    );

    const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);

    chapterReports.push({
      position: chapter.position,
      title: chapter.title,
      sourcePath: chapter.path,
      heading,
      bodyParagraphs: bodyParagraphs.length,
      charCount: chapter.charCount,
      isFallback: Boolean(chapter.meta.isFallback),
    });

    for (const text of bodyParagraphs) {
      const cleanText = cleanForDocx(text);
      if (!cleanText) continue;

      children.push(
        new Paragraph({
          text: cleanText,
          spacing: { after: 160 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(outputDir, fileName);

  fs.writeFileSync(outputPath, buffer);
  console.log(`Gerado: ${outputPath}`);

  return {
    title,
    fileName,
    outputPath,
    expectedParagraphCount: children.length,
    chapters: chapterReports,
  };
}

// Função: Auditoria independente de cobertura
// Função: Auditoria independente de cobertura
function auditSourceCoverage(spineItems, generatedFiles, workTitle, allChapters) {
  console.log("\n=== INICIANDO AUDITORIA INDEPENDENTE DE COBERTURA ===\n");
  
  // Criar conjunto de paths que foram processados
  const processedPaths = new Set();
  const chapterMap = new Map(); // path -> chapter info
  
  for (const chapter of allChapters) {
    processedPaths.add(chapter.path);
    chapterMap.set(chapter.path, {
      position: chapter.position,
      charCount: chapter.charCount,
      isFallback: chapter.meta.isFallback,
      heading: chapterHeading(chapter.meta, chapter.title)
    });
  }
  
  // 1. Analisar cada item do spine
  const spineAnalysis = [];
  
  for (const item of spineItems) {
    if (!isTextualEpubPath(item.path)) continue;
    
    // Extrair conteúdo real para estatísticas
    const paragraphs = extractChapterParagraphsSync(item.path);
    const fullText = paragraphs.join("\n\n");
    const charCount = fullText.length;
    const paragraphCount = paragraphs.length;
    
    // Verificar se foi processado
    const wasProcessed = processedPaths.has(item.path);
    const chapterInfo = chapterMap.get(item.path);
    
    // Primeiro e último parágrafo significativo (para debug)
    const significantParagraphs = paragraphs.filter(p => p.length > 20);
    const firstParagraph = significantParagraphs[0] || "";
    const lastParagraph = significantParagraphs[significantParagraphs.length - 1] || "";
    const middleParagraph = significantParagraphs[Math.floor(significantParagraphs.length / 2)] || "";
    
    spineAnalysis.push({
      path: item.path,
      title: item.title,
      position: item.position,
      charCount,
      paragraphCount,
      firstParagraph: firstParagraph.substring(0, 200),
      lastParagraph: lastParagraph.substring(0, 200),
      middleParagraph: middleParagraph.substring(0, 200),
      isObligatory: charCount >= MIN_SIGNIFICANT_TEXT_CHARS,
      wasProcessed: wasProcessed,
      wasProcessedAsFallback: wasProcessed && chapterInfo ? chapterInfo.isFallback : false,
      outputPosition: wasProcessed && chapterInfo ? chapterInfo.position : null,
      outputHeading: wasProcessed && chapterInfo ? chapterInfo.heading : null,
    });
  }
  
  // 2. Coletar estatísticas dos DOCX gerados
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
  
  // 3. Gerar relatório de auditoria
  const obligatoryItems = spineAnalysis.filter(a => a.isObligatory);
  const missingObligatory = obligatoryItems.filter(a => !a.wasProcessed);
  const processedObligatory = obligatoryItems.filter(a => a.wasProcessed);
  const fallbackObligatory = obligatoryItems.filter(a => a.wasProcessed && a.wasProcessedAsFallback);
  
  // Verificar também itens pequenos que foram processados (fallback)
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
      firstParagraphPreview: item.firstParagraph.substring(0, 100),
      lastParagraphPreview: item.lastParagraph.substring(0, 100),
    })),
    fallbackItems: fallbackObligatory.map(item => ({
      path: item.path,
      title: item.title || "(sem título)",
      charCount: item.charCount,
      position: item.position,
      outputPosition: item.outputPosition,
      outputHeading: item.outputHeading,
    })),
    processedItems: processedObligatory.map(item => ({
      path: item.path,
      title: item.title || "(sem título)",
      charCount: item.charCount,
      position: item.position,
      outputPosition: item.outputPosition,
      isFallback: item.wasProcessedAsFallback,
    })),
    docxFiles: docxStats,
  };
  
  // 4. Criar checks específicos
  const auditChecks = [
    createCheck(
      "Cobertura do spine obrigatório",
      auditReport.summary.missingObligatoryItems === 0,
      auditReport.summary.missingObligatoryItems === 0
        ? `Todos os ${auditReport.summary.obligatoryItems} blocos obrigatórios do spine foram processados`
        : `${auditReport.summary.missingObligatoryItems} bloco(s) obrigatório(s) NÃO foram processados: ${auditReport.missingItems.map(m => m.path).join(", ")}`
    ),
    createCheck(
      "Blocos obrigatórios processados",
      auditReport.summary.processedObligatoryItems > 0,
      auditReport.summary.processedObligatoryItems > 0
        ? `${auditReport.summary.processedObligatoryItems}/${auditReport.summary.obligatoryItems} blocos obrigatórios foram processados`
        : "Nenhum bloco obrigatório foi processado!"
    ),
    createCheck(
      "Blocos fallback incluídos",
      true, // Apenas informativo, não é erro
      `${auditReport.summary.fallbackObligatoryItems} bloco(s) obrigatório(s) foram incluídos como fallback (não tinham título no TOC)`
    ),
    createCheck(
      "Arquivos DOCX gerados",
      generatedFiles.length > 0,
      generatedFiles.length > 0
        ? `${generatedFiles.length} arquivos DOCX gerados`
        : "Nenhum arquivo DOCX foi gerado!"
    ),
  ];
  
  // 5. Exibir relatório no console
  console.log("\n=== RELATÓRIO DA AUDITORIA ===");
  console.log(`Total de itens no spine: ${auditReport.summary.totalSpineItems}`);
  console.log(`Itens textuais no spine: ${auditReport.summary.textualSpineItems}`);
  console.log(`Blocos obrigatórios (>=${MIN_SIGNIFICANT_TEXT_CHARS} chars): ${auditReport.summary.obligatoryItems}`);
  console.log(`Blocos obrigatórios processados: ${auditReport.summary.processedObligatoryItems}`);
  console.log(`Blocos obrigatórios NÃO processados: ${auditReport.summary.missingObligatoryItems}`);
  console.log(`Blocos obrigatórios processados como fallback: ${auditReport.summary.fallbackObligatoryItems}`);
  console.log(`Itens pequenos processados: ${auditReport.summary.smallItemsProcessed}`);
  console.log(`Arquivos DOCX gerados: ${auditReport.summary.totalDocxFiles}`);
  console.log(`Total de parágrafos nos DOCX: ${auditReport.summary.totalDocxParagraphs}`);
  
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
  
  return { auditReport, auditChecks };
}

// Versão síncrona para extrair parágrafos (usada na auditoria)
function extractChapterParagraphsSync(chapterPath) {
  const html = readZipText(chapterPath);
  const $ = cheerio.load(html);
  
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

function loadTocItems() {
  const tocPath = zip
    .getEntries()
    .map((entry) => entry.entryName)
    .find((name) => name.toLowerCase().endsWith("toc.ncx"));

  if (!tocPath) {
    throw new Error("toc.ncx não encontrado no EPUB.");
  }

  const tocDir = path.dirname(tocPath);
  const tocXml = readZipText(tocPath);
  const $toc = cheerio.load(tocXml, { xmlMode: true });

  const items = [];

  $toc("navPoint").each((_, el) => {
    const title = normalizeText(
      $toc(el).children("navLabel").children("text").first().text()
    );

    const src = $toc(el).children("content").attr("src");
    if (!src) return;

    const cleanSrc = src.split("#")[0];

    const fullPath = path
      .normalize(path.join(tocDir, cleanSrc))
      .replaceAll("\\", "/");

    items.push({ title, path: fullPath });
  });

  return items;
}

function buildValidationReport({
  tocItems,
  spineItems,
  textualItems,
  allChapters,
  groups,
  generatedFiles,
  workTitle,
  auditReport,
  auditChecks,
}) {
  const extractedPaths = new Set(allChapters.map((chapter) => chapter.path));

  const ignoredTextualItems = textualItems.filter(
    (item) =>
      !extractedPaths.has(item.path) &&
      item.charCount >= MIN_SIGNIFICANT_TEXT_CHARS
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
        ? ignoredTextualItems
            .map(
              (item) =>
                `${item.title || "(sem título)"} - ${item.path} - ${item.charCount} caracteres`
            )
            .join("; ")
        : "Nenhum bloco textual grande ficou fora do filtro."
    ),
    createCheck(
      "Nenhum capítulo sem conteúdo",
      emptyChapters.length === 0,
      emptyChapters.length
        ? emptyChapters
            .map((chapter) => `${chapter.position}: ${chapterHeading(chapter.meta, chapter.title)}`)
            .join("; ")
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
      fileReports
        .filter((file) => !file.exists || file.sizeBytes === 0)
        .map((file) => file.fileName)
        .join("; ") || "Todos os DOCX foram criados com conteúdo."
    ),
    createCheck(
      "Títulos encontrados nos DOCX",
      fileReports.every((file) => file.missingHeadings.length === 0),
      fileReports
        .filter((file) => file.missingHeadings.length > 0)
        .map((file) => `${file.fileName}: ${file.missingHeadings.join("; ")}`)
        .join(" | ") || "Todos os títulos esperados foram encontrados."
    ),
    createCheck(
      "Contagem mínima de parágrafos nos DOCX",
      fileReports.every((file) => file.paragraphCountOk),
      fileReports
        .filter((file) => !file.paragraphCountOk)
        .map((file) => `${file.fileName}: ${file.docxParagraphCount}/${file.expectedParagraphCount}`)
        .join("; ") || "Todos os DOCX têm a contagem mínima esperada."
    ),
    ...auditChecks,
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
      obligatoryItems: auditReport.obligatoryItems,
      missingObligatoryItems: auditReport.missingObligatory,
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
    chapters: allChapters.map((chapter) => {
      const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);

      return {
        position: chapter.position,
        title: chapter.title,
        sourcePath: chapter.path,
        heading: chapterHeading(chapter.meta, chapter.title),
        rawParagraphs: chapter.paragraphs.length,
        bodyParagraphs: bodyParagraphs.length,
        charCount: chapter.charCount,
        estimatedBytes: estimateChapterBytes(chapter),
        isFallback: Boolean(chapter.meta.isFallback),
        outputFile: chapter.outputFile,
      };
    }),
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
      lines.push(
        `- ${chapter.position}: ${chapter.heading} | ${chapter.charCount} chars | ${chapter.sourcePath}`
      );
    }
  }

  if (report.ignoredTextualItems.length) {
    lines.push("", "Blocos textuais ignorados (pequenos e sem título):");

    for (const item of report.ignoredTextualItems) {
      lines.push(
        `- ${item.title || "(sem título)"} | ${item.charCount} chars | ${item.path}`
      );
    }
  }

  if (report.audit.missingObligatory > 0) {
    lines.push("", "⚠️  BLOCOS OBRIGATÓRIOS AUSENTES DOS DOCX:");

    for (const missing of report.audit.missingItems) {
      lines.push(
        `- ${missing.path} | ${missing.charCount} chars | título TOC: ${missing.title}`
      );
    }
  }

  lines.push("", "Arquivos:");

  for (const file of report.files) {
    const chapterRange = file.chapters
      .map((chapter) => chapter.position)
      .join(", ");

    lines.push(
      `- ${file.fileName}: itens ${chapterRange}; ${file.sizeKB} KB; ${file.docxParagraphCount} parágrafos`
    );
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

(async () => {
  const tocItems = loadTocItems();
  const workTitle = getWorkTitleFromToc(tocItems, inputEpub);

  if (!outputDir) {
    outputDir = path.join(
      workflowDir,
      "output",
      `${safeFileName(workTitle)}-${runTimestamp}`
    );
  }

  logsDir = path.join(
    workflowDir,
    "logs",
    `${safeFileName(workTitle)}-${runTimestamp}`
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  console.log(`EPUB: ${inputEpub}`);
  console.log(`Saída: ${outputDir}`);
  console.log(`Logs: ${logsDir}`);
  console.log(`Base de títulos: ${titleBasePath}`);
  console.log(`Tamanho-alvo por DOCX: ${TARGET_DOCX_KB} KB`);

  // NOVO FLUXO: Usar spine como fonte principal
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
    console.warn(
      `Atenção: ${fallbackCount} bloco(s) foram incluídos por fallback, pois não tinham título padrão de capítulo.`
    );
  }

  const groups = groupChaptersByTargetSize(allChapters, TARGET_DOCX_BYTES);
  const generatedFiles = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupNumber = String(i + 1).padStart(3, "0");
    const range = formatGroupRangeByPosition(group, allChapters.length);
    const title = `Chapter Group ${groupNumber}`;
    const fileName = `${safeFileName(workTitle)}_cap_${range}.docx`;

    for (const chapter of group) {
      chapter.outputFile = fileName;
    }

    generatedFiles.push(
      await writeDocxFile({
        title,
        chapters: group,
        fileName,
      })
    );
  }

  // Executar auditoria independente
  const { auditReport, auditChecks } = auditSourceCoverage(spineItems, generatedFiles, workTitle, allChapters);
  
  const report = buildValidationReport({
    tocItems,
    spineItems,
    textualItems,
    allChapters,
    groups,
    generatedFiles,
    workTitle,
    auditReport,
    auditChecks,
  });

  writeValidationReports(report);

  if (report.status !== "OK") {
    process.exitCode = 1;
  }
})();