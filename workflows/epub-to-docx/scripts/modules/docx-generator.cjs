const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { Document, Packer, Paragraph, HeadingLevel } = require("docx");
const { cleanForDocx, normalizeText } = require('./text-processor.cjs');
const { chapterHeading } = require('./chapter-parser.cjs');

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
    if (escapedNumber && new RegExp(`^Chapter\\s+${escapedNumber}\\s+\\[Arc\\s*\\d+\\]$`, "i").test(text)) return false;
    if (escapedNumber && new RegExp(`^.*?Chapter\\s+${escapedNumber}(?::.*)?$`, "i").test(text)) return false;
    if (/^Thank you\s+@.+?\s+for the Kofi\.?$/i.test(text)) return false;
    if (/^Thanks\s+@.+?\s+for the Kofi\.?$/i.test(text)) return false;
    if (meta.rawLines && meta.rawLines.includes(text)) return false;

    return true;
  });
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

async function writeDocxFile({ title, chapters, fileName, outputDir }) {
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

function readDocxParagraphTexts(filePath) {
  const docxZip = new AdmZip(filePath);
  const entry = docxZip.getEntry("word/document.xml");
  if (!entry) return [];

  const xml = entry.getData().toString("utf8");
  const $ = require('cheerio').load(xml, { xmlMode: true });
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

module.exports = {
  removeDuplicatedHeaders,
  estimateChapterBytes,
  groupChaptersByTargetSize,
  writeDocxFile,
  readDocxParagraphTexts,
};