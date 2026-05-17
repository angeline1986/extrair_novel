import fs from "fs/promises";
import { Document, Packer, Paragraph, TextRun } from "docx";

export async function saveDocxText(outputPath, text) {
  const paragraphs = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        new Paragraph({
          children: [new TextRun(line)],
        })
    );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
}
