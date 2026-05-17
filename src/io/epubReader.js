import path from "node:path";
import AdmZip from "adm-zip";
import * as cheerio from "cheerio";

export function openEpub(epubPath) {
  return new AdmZip(epubPath);
}

export function readZipText(zip, filePath) {
  const entry = zip.getEntry(filePath);
  if (!entry) throw new Error(`Arquivo não encontrado no EPUB: ${filePath}`);
  return entry.getData().toString("utf8");
}

export function findTocPath(zip) {
  return zip
    .getEntries()
    .map((entry) => entry.entryName)
    .find((name) => name.toLowerCase().endsWith("toc.ncx"));
}

export function readTocItems(zip, tocPath = findTocPath(zip)) {
  if (!tocPath) {
    throw new Error("toc.ncx não encontrado no EPUB.");
  }

  const tocDir = path.dirname(tocPath);
  const tocXml = readZipText(zip, tocPath);
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

export function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}
