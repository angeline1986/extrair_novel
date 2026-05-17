const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const cheerio = require("cheerio");
const { Document, Packer, Paragraph, HeadingLevel } = require("docx");

const workflowDir = path.resolve(__dirname, "..");
const inputDir = path.join(workflowDir, "input");
const inputEpub = process.argv[2] ? path.resolve(process.argv[2]) : findSingleEpub(inputDir);
let outputDir = process.argv[3] ? path.resolve(process.argv[3]) : "";
let logsDir = "";
const runTimestamp = formatTimestampForPath();
const titleBasePath = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.join(workflowDir, "input", "chapter_titles.txt");
const CHAPTERS_PER_DOCX = Number(process.argv[5] || 4);

if (!Number.isInteger(CHAPTERS_PER_DOCX) || CHAPTERS_PER_DOCX <= 0) {
  throw new Error(`Quantidade inválida de capítulos por DOCX: ${process.argv[5]}`);
}

if (!fs.existsSync(inputEpub)) {
  throw new Error(`EPUB não encontrado: ${inputEpub}`);
}

const ARC_NAME_OVERRIDES = {
  10: "Infinite Train",
};

const zip = new AdmZip(inputEpub);

function formatTimestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    pad(date.getDate()),
    pad(date.getMonth() + 1),
    date.getFullYear(),
  ].join("-") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
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
      `Mais de um arquivo .epub encontrado em ${dir}. Informe o caminho do EPUB explicitamente.`
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
      const volumeNumber = Number(volumeMatch[1]);
      const volumeName = cleanBaseTitle(volumeMatch[2]);

      result.arcNamesByNumber.set(volumeNumber, titleCase(volumeName));
      continue;
    }

    const chapterMatch = text.match(/^(\d+)\.\s+(.+)$/);

    if (chapterMatch) {
      const chapterNumber = chapterMatch[1];
      const chapterTitle = cleanBaseTitle(chapterMatch[2]);

      result.chapterTitlesByNumber.set(chapterNumber, titleCase(chapterTitle));
    }
  }

  return result;
}

const TITLE_BASE = loadTitleBase(titleBasePath);

function parseArcFromTocTitle(title) {
  const text = normalizeText(title);

  let match = text.match(/\[Arc\s*(\d+)(?::\s*([^\]]+))?\]/i);

  if (match) {
    return {
      number: Number(match[1]),
      name: match[2] ? normalizeText(match[2]) : null,
    };
  }

  match = text.match(/^Arc\s*(\d+)\s*:\s*(.+)$/i);

  if (match) {
    return {
      number: Number(match[1]),
      name: normalizeText(match[2]),
    };
  }

  return null;
}

function getChapterGroup(chapterNumber) {
  return String(chapterNumber).split(".")[0];
}

function parseChapterMetaFromTocTitle(title) {
  const text = normalizeText(title);

  if (/^prologue$/i.test(text) || /^epilogue$/i.test(text)) {
    const label = titleCase(text);

    return {
      arcName: "",
      chapterNumber: label,
      chapterTitle: label,
      rawLines: [],
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
      };
    }
  }

  for (let i = 0; i < cleanLines.length; i++) {
    const text = cleanLines[i];

    const fullMatch = text.match(/^(.*?)Chapter\s+([\d.]+)$/i);

    if (fullMatch) {
      return {
        arcName: normalizeText(fullMatch[1]),
        chapterNumber: normalizeText(fullMatch[2]),
        chapterTitle: "",
        rawLines: [text],
      };
    }

    const next = cleanLines[i + 1] || "";
    const splitMatch = next.match(/^Chapter\s+([\d.]+)$/i);

    if (splitMatch && !/^WTNL/i.test(text) && !/^Chapter/i.test(text)) {
      return {
        arcName: text,
        chapterNumber: normalizeText(splitMatch[1]),
        chapterTitle: "",
        rawLines: [text, next],
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
    };
  }

  return null;
}

function removeDuplicatedHeaders(paragraphs, meta) {
  if (!meta) return paragraphs;

  const escapedNumber = meta.chapterNumber.replace(/\./g, "\\.");

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
      /^\d+$/.test(meta.chapterNumber) &&
      new RegExp(`\\b${escapedNumber}\\.\\s+.+`, "i").test(text) &&
      text.length <= 180
    ) {
      return false;
    }

    // Remove: WTNL Chapter 1 [Arc 1]
    if (/^WTNL\s+Chapter\s+[\d.]+(\s+\[.*?\])?$/i.test(text)) return false;

    // Remove: Chapter 1
    if (/^Chapter\s+[\d.]+$/i.test(text)) return false;

    // Remove: Chapter 1 [Arc 1]
    if (/^Chapter\s+[\d.]+\s+\[Arc\s*\d+\]$/i.test(text)) return false;

    // Remove: Chapter 628 [Arc 10]
    if (
      new RegExp(
        `^Chapter\\s+${escapedNumber}\\s+\\[Arc\\s*\\d+\\]$`,
        "i"
      ).test(text)
    ) {
      return false;
    }

    // Remove: Decai Middle SchoolChapter 2.2: Title
    const chapterHeaderRegex = new RegExp(
      `^.*?Chapter\\s+${escapedNumber}(?::.*)?$`,
      "i"
    );

    if (chapterHeaderRegex.test(text)) return false;

    // Remove: Thank you @Eline for the Kofi.
    if (/^Thank you\s+@.+?\s+for the Kofi\.?$/i.test(text)) return false;

    // Remove: Thanks @Name for the Kofi.
    if (/^Thanks\s+@.+?\s+for the Kofi\.?$/i.test(text)) return false;

    if (meta.rawLines.includes(text)) return false;

    return true;
  });
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

const tocItems = [];

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

  tocItems.push({ title, path: fullPath });
});

function buildArcSkeletonsFromToc(items) {
  const arcs = [];
  let currentArc = null;
  let afterLastArc = false;

  const extras = {
    number: null,
    arcName: "Extras",
    isExtras: true,
    items: [],
    chapters: [],
  };

  for (const item of items) {
    const arcStart = parseArcFromTocTitle(item.title);
    const isEnd = /\[End\]/i.test(item.title);
    const isChapter = /chapter/i.test(item.title);

    if (arcStart) {
      if (currentArc && currentArc.items.length > 0) arcs.push(currentArc);

      currentArc = {
        number: arcStart.number,
        arcName: ARC_NAME_OVERRIDES[arcStart.number] || arcStart.name || null,
        isExtras: false,
        items: [],
        chapters: [],
      };

      afterLastArc = false;
    }

    if (currentArc && isChapter) {
      currentArc.items.push(item);
    } else if (!currentArc && afterLastArc && isChapter) {
      extras.items.push(item);
    }

    if (currentArc && isEnd) {
      if (currentArc.items.length > 0) arcs.push(currentArc);
      currentArc = null;
      afterLastArc = true;
    }
  }

  if (currentArc && currentArc.items.length > 0) arcs.push(currentArc);
  if (extras.items.length > 0) arcs.push(extras);

  return arcs;
}

function buildChapterItemsFromToc(items) {
  const chapters = [];
  const seenPaths = new Set();

  for (const item of items) {
    const meta = parseChapterMetaFromTocTitle(item.title);

    if (!meta || seenPaths.has(item.path)) continue;

    seenPaths.add(item.path);
    chapters.push({ ...item, meta });
  }

  return chapters;
}

function getWorkTitleFromToc(items, fallbackPath) {
  const firstTitle = items.find((item) => item.title)?.title;

  if (firstTitle && !parseChapterMetaFromTocTitle(firstTitle)) {
    return firstTitle;
  }

  return path.basename(fallbackPath, path.extname(fallbackPath));
}

function formatGroupRange(start, end, total) {
  const width = Math.max(2, String(total).length);
  const pad = (value) => String(value).padStart(width, "0");

  return `${pad(start)}-${pad(end)}`;
}

async function enrichChapterItem(item) {
  const paragraphs = await extractChapterParagraphs(item.path);
  const meta = { ...item.meta };
  const group = getChapterGroup(meta.chapterNumber);
  const titleFromBase = TITLE_BASE.chapterTitlesByNumber.get(group);

  if (titleFromBase) {
    meta.chapterTitle = titleFromBase;
  }

  return {
    title: item.title,
    path: item.path,
    paragraphs,
    meta,
  };
}

async function enrichArc(arc) {
  const chapters = [];

  for (const item of arc.items) {
    const paragraphs = await extractChapterParagraphs(item.path);
    const meta = parseChapterHeader(paragraphs, item.title);

    if (!meta) continue;

    if (!arc.arcName && meta.arcName) {
      arc.arcName = meta.arcName;
    }

    chapters.push({
      title: item.title,
      path: item.path,
      paragraphs,
      meta,
    });
  }

  const titlesByGroup = new Map();

  for (const chapter of chapters) {
    const group = getChapterGroup(chapter.meta.chapterNumber);
    const titleFromBase = TITLE_BASE.chapterTitlesByNumber.get(group);

    if (titleFromBase) {
      titlesByGroup.set(group, titleFromBase);
    } else if (chapter.meta.chapterTitle) {
      titlesByGroup.set(group, chapter.meta.chapterTitle);
    }
  }

  for (const chapter of chapters) {
    const group = getChapterGroup(chapter.meta.chapterNumber);

    if (titlesByGroup.has(group)) {
      chapter.meta.chapterTitle = titlesByGroup.get(group);
    }
  }

  const arcNameFromBase = TITLE_BASE.arcNamesByNumber.get(arc.number);

  arc.chapters = chapters;
  arc.arcName = arc.isExtras
    ? "Extras"
    : ARC_NAME_OVERRIDES[arc.number] ||
      arcNameFromBase ||
      arc.arcName ||
      `Arc ${arc.number}`;
}

function chapterHeading(meta, fallbackTitle) {
  if (!meta) return normalizeText(fallbackTitle);

  if (/^prologue$/i.test(meta.chapterNumber)) {
    return normalizeText(meta.chapterTitle || fallbackTitle || "Prologue");
  }

  if (meta.chapterTitle) {
    return normalizeText(`Chapter ${meta.chapterNumber} - ${meta.chapterTitle}`);
  }

  if (fallbackTitle && /Chapter/i.test(fallbackTitle)) {
    return normalizeText(fallbackTitle.replace(":", " -"));
  }

  return normalizeText(`Chapter ${meta.chapterNumber} - Untitled`);
}

function chunkArray(items, size) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
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

function buildValidationReport({
  tocItems,
  chapterItems,
  allChapters,
  groups,
  generatedFiles,
  workTitle,
}) {
  const detectedChapterEntries = tocItems.filter((item) =>
    parseChapterMetaFromTocTitle(item.title)
  );
  const duplicateSourcePaths = new Map();

  for (const item of detectedChapterEntries) {
    duplicateSourcePaths.set(item.path, (duplicateSourcePaths.get(item.path) || 0) + 1);
  }

  const duplicateEntries = [...duplicateSourcePaths.entries()]
    .filter(([, count]) => count > 1)
    .map(([sourcePath, count]) => ({ sourcePath, count }));

  const chapterSummaries = allChapters.map((chapter) => {
    const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);

    return {
      position: chapter.position,
      title: chapter.title,
      sourcePath: chapter.path,
      heading: chapterHeading(chapter.meta, chapter.title),
      rawParagraphs: chapter.paragraphs.length,
      bodyParagraphs: bodyParagraphs.length,
      outputFile: chapter.outputFile,
    };
  });

  const emptyChapters = chapterSummaries.filter((chapter) => chapter.bodyParagraphs === 0);
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
      expectedParagraphCount: file.expectedParagraphCount,
      docxParagraphCount: docxParagraphs.length,
      paragraphCountOk,
      missingHeadings,
      chapters: file.chapters,
    };
  });

  const checks = [
    createCheck(
      "Capítulos únicos extraídos",
      allChapters.length === chapterItems.length,
      `${allChapters.length}/${chapterItems.length}`
    ),
    createCheck(
      "Nenhum capítulo sem conteúdo",
      emptyChapters.length === 0,
      emptyChapters.length
        ? emptyChapters.map((chapter) => `${chapter.position}: ${chapter.heading}`).join("; ")
        : "Todos os capítulos têm corpo de texto."
    ),
    createCheck(
      "Ordem dos capítulos",
      orderMatches,
      orderMatches
        ? "A ordem gerada segue a ordem do índice do EPUB."
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
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "OK") ? "OK" : "FAIL",
    epub: inputEpub,
    outputDir,
    logsDir,
    workTitle,
    chaptersPerDocx: CHAPTERS_PER_DOCX,
    summary: {
      tocItems: tocItems.length,
      detectedChapterEntries: detectedChapterEntries.length,
      duplicateDetectedEntries: duplicateEntries.length,
      uniqueChapters: allChapters.length,
      docxFiles: generatedFiles.length,
      emptyChapters: emptyChapters.length,
    },
    duplicateEntries,
    checks,
    chapters: chapterSummaries,
    files: fileReports,
  };
}

function buildValidationSummaryText(report) {
  const lines = [
    `Status: ${report.status}`,
    `EPUB: ${report.epub}`,
    `Saída: ${report.outputDir}`,
    `Obra: ${report.workTitle}`,
    `Capítulos únicos: ${report.summary.uniqueChapters}`,
    `DOCX gerados: ${report.summary.docxFiles}`,
    "",
    "Validações:",
  ];

  for (const check of report.checks) {
    lines.push(`- ${check.status}: ${check.name} - ${check.detail}`);
  }

  lines.push("", "Arquivos:");

  for (const file of report.files) {
    const chapterRange = file.chapters
      .map((chapter) => chapter.position)
      .join(", ");

    lines.push(
      `- ${file.fileName}: capítulos ${chapterRange}; ${file.docxParagraphCount} parágrafos no DOCX`
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
        spacing: {
          after: 380,
        },
      })
    );

    const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);

    chapterReports.push({
      position: chapter.position,
      title: chapter.title,
      sourcePath: chapter.path,
      heading,
      bodyParagraphs: bodyParagraphs.length,
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

(async () => {
  const chapterItems = buildChapterItemsFromToc(tocItems);
  const allChapters = [];
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
  console.log(`Capítulos por DOCX: ${CHAPTERS_PER_DOCX}`);

  console.log(`Capítulos encontrados no índice: ${chapterItems.length}`);

  for (const item of chapterItems) {
    const chapter = await enrichChapterItem(item);
    chapter.position = allChapters.length + 1;
    allChapters.push(chapter);
  }

  if (!allChapters.length) {
    console.warn("Nenhum capítulo encontrado para gerar DOCX.");
    return;
  }

  const groups = chunkArray(allChapters, CHAPTERS_PER_DOCX);
  const generatedFiles = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupNumber = String(i + 1).padStart(3, "0");
    const firstPosition = i * CHAPTERS_PER_DOCX + 1;
    const lastPosition = firstPosition + group.length - 1;
    const range = formatGroupRange(firstPosition, lastPosition, allChapters.length);
    const title = `Chapter Group ${groupNumber}`;
    const fileName = `${safeFileName(workTitle)}_cap_${range}.docx`;

    for (const chapter of group) {
      chapter.outputFile = fileName;
    }

    generatedFiles.push(await writeDocxFile({
      title,
      chapters: group,
      fileName,
    }));
  }

  writeValidationReports(
    buildValidationReport({
      tocItems,
      chapterItems,
      allChapters,
      groups,
      generatedFiles,
      workTitle,
    })
  );
})();
