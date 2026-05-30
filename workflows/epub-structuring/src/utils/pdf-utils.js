import fs from 'fs-extra';

export async function readPdfText(pdfPath) {
  if (!pdfPath) return '';

  const buffer = await fs.readFile(pdfPath);
  const pdfParseModule = await import('pdf-parse');

  if (typeof pdfParseModule?.default === 'function') {
    const data = await pdfParseModule.default(buffer);
    return cleanPdfText(data?.text);
  }

  if (typeof pdfParseModule === 'function') {
    const data = await pdfParseModule(buffer);
    return cleanPdfText(data?.text);
  }

  if (typeof pdfParseModule?.default?.default === 'function') {
    const data = await pdfParseModule.default.default(buffer);
    return cleanPdfText(data?.text);
  }

  if (typeof pdfParseModule?.PDFParse === 'function') {
    return readWithPDFParseClass(pdfParseModule.PDFParse, buffer);
  }

  const keys = Object.keys(pdfParseModule || {}).join(', ');
  throw new Error(`pdf-parse não exportou leitor compatível. Exports: ${keys}`);
}

async function readWithPDFParseClass(PDFParse, buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    if (typeof parser.getText === 'function') {
      const data = await parser.getText();
      return cleanPdfText(data?.text || data);
    }

    if (typeof parser.parse === 'function') {
      const data = await parser.parse();
      return cleanPdfText(data?.text || data);
    }

    throw new Error('PDFParse não possui getText() nem parse().');
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy();
    }
  }
}

function cleanPdfText(value) {
  return String(value || '').replace(/\r/g, '\n');
}

export function normalizePdfLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[•·]/g, '')
    .trim();
}
