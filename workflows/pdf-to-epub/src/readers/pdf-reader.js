import fs from 'fs-extra';
import path from 'path';
import pdfParse from 'pdf-parse';
import { normalizeLineBreaks, normalizeWhiteSpace } from '../utils/text-utils.js';

export async function readPdfFile(pdfPath) {
  const buffer = await fs.readFile(pdfPath);
  const extractedPages = [];
  let renderedPageIndex = 0;

  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      renderedPageIndex += 1;
      const text = renderTextContent(textContent);

      extractedPages.push({
        index: renderedPageIndex,
        text,
      });

      // pdf-parse still expects a string from pagerender.
      return text;
    },
  });

  const pages = extractedPages
    .map((page) => ({
      ...page,
      text: normalizeWhiteSpace(normalizeLineBreaks(page.text || '')),
    }))
    .filter((page) => page.text.length > 0);

  const physicalPageCount = Number(parsed.numpages || 0);
  const metadata = parsed.info || {};
  const title = metadata.Title || path.basename(pdfPath, '.pdf');
  const language = inferLanguage(metadata.Language || 'pt-BR');
  const rawText = pages.map((page) => page.text).join('\n\f\n');

  if (physicalPageCount > 0 && extractedPages.length !== physicalPageCount) {
    throw new Error(
      `Falha na extração página a página: PDF informa ${physicalPageCount} páginas, `
      + `mas ${extractedPages.length} foram renderizadas.`,
    );
  }

  return {
    filePath: pdfPath,
    fileName: path.basename(pdfPath),
    title,
    language,
    pageCount: physicalPageCount || extractedPages.length,
    extractedPageCount: extractedPages.length,
    nonEmptyPageCount: pages.length,
    textLength: rawText.length,
    metadata,
    pages,
    rawText,
  };
}

function renderTextContent(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  const lines = [];
  let currentLine = [];
  let previousY = null;

  for (const item of items) {
    const value = String(item?.str || '').trim();
    const y = Array.isArray(item?.transform) ? Number(item.transform[5]) : null;

    if (
      currentLine.length > 0
      && Number.isFinite(y)
      && Number.isFinite(previousY)
      && Math.abs(y - previousY) > 2
    ) {
      lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
      currentLine = [];
    }

    if (value) currentLine.push(value);

    if (item?.hasEOL) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
        currentLine = [];
      }
      previousY = null;
    } else if (Number.isFinite(y)) {
      previousY = y;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
  }

  return lines.filter(Boolean).join('\n');
}

function inferLanguage(value) {
  if (!value) return 'pt-BR';
  return String(value).trim();
}
