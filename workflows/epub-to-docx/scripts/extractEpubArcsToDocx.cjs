const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const cheerio = require("cheerio");
const { Document, Packer, Paragraph, HeadingLevel } = require("docx");

const inputEpub = process.argv[2] || path.resolve("workflows/epub-to-docx/input/wtnl.epub");
const outputDir = process.argv[3] || path.resolve("workflows/epub-to-docx/output/arcs");
const titleBasePath = process.argv[4] || path.resolve("workflows/epub-to-docx/input/chapter_titles.txt");

fs.mkdirSync(outputDir, { recursive: true });

const ARC_NAME_OVERRIDES = {
  10: "Infinite Train",
};

const MAX_CHAPTERS_PER_DOCX_BY_ARC = {
  7: 35,
  8: 35,
  9: 35,
  10: 35,
};

const zip = new AdmZip(inputEpub);

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

  return paragraphs.filter((p) => {
    const text = normalizeText(p);

    if (!text) return false;

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

async function writeDocxFile({ title, chapters, fileName }) {
  const children = [
    new Paragraph({
      text: cleanForDocx(title),
      heading: HeadingLevel.TITLE,
    }),
  ];

  for (const chapter of chapters) {
   children.push(
  new Paragraph({
    text: cleanForDocx(chapterHeading(chapter.meta, chapter.title)),
    heading: HeadingLevel.HEADING_1,
    spacing: {
      after: 380,
    },
  })
);

    const bodyParagraphs = removeDuplicatedHeaders(chapter.paragraphs, chapter.meta);

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
}

async function writeArcDocx(arc) {
  await enrichArc(arc);

  if (!arc.chapters.length) {
    console.warn(`Ignorado: ${arc.isExtras ? "Extras" : `Arc ${arc.number}`} sem capítulos.`);
    return;
  }

  if (arc.isExtras) {
    await writeDocxFile({
      title: "EXTRAS",
      chapters: arc.chapters,
      fileName: "Extras.docx",
    });

    return;
  }

  const maxChapters = MAX_CHAPTERS_PER_DOCX_BY_ARC[arc.number];

  if (maxChapters && arc.chapters.length > maxChapters) {
    const parts = chunkArray(arc.chapters, maxChapters);

    for (let i = 0; i < parts.length; i++) {
      const partNumber = String(i + 1).padStart(2, "0");

      await writeDocxFile({
        title: `ARC ${arc.number} — ${arc.arcName} — Part ${partNumber}`,
        chapters: parts[i],
        fileName: safeFileName(
          `Arc_${String(arc.number).padStart(2, "0")}_${arc.arcName}_Part_${partNumber}.docx`
        ),
      });
    }

    return;
  }

  await writeDocxFile({
    title: `ARC ${arc.number} — ${arc.arcName}`,
    chapters: arc.chapters,
    fileName: safeFileName(
      `Arc_${String(arc.number).padStart(2, "0")}_${arc.arcName}.docx`
    ),
  });
}

(async () => {
  console.log(`EPUB: ${inputEpub}`);
  console.log(`Saída: ${outputDir}`);
  console.log(`Base de títulos: ${titleBasePath}`);

  const arcs = buildArcSkeletonsFromToc(tocItems);

  console.log(`Arquivos encontrados: ${arcs.length}`);

  for (const arc of arcs) {
    const splitInfo =
      !arc.isExtras && MAX_CHAPTERS_PER_DOCX_BY_ARC[arc.number]
        ? ` | split: ${MAX_CHAPTERS_PER_DOCX_BY_ARC[arc.number]} capítulos por arquivo`
        : "";

    console.log(
      `${arc.isExtras ? "Extras" : `Arc ${arc.number}: ${arc.arcName || "(sem nome)"}`} — ${arc.items.length} capítulos${splitInfo}`
    );
  }

  for (const arc of arcs) {
    await writeArcDocx(arc);
  }
})();
