#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseChapter } from './englishSource/chapterParser.js';
import { fetchRenderedChapterHtml, openBrowser } from './englishSource/renderedFetcher.js';
import { writeEnglishChapterOutputs } from './englishSource/chapterWriter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');
const outputDir = path.join(workflowRoot, 'input/source/english/fragments');
const baseUrl = 'https://borntobenovel.com/novel/accidental-baby/chapters/ch-';

function defaultUrls() {
  return Array.from({ length: 60 }, (_, index) => `${baseUrl}${index + 1}`);
}

function parseSources(args) {
  if (!args.length || args.includes('--all')) return defaultUrls();
  return args.filter((arg) => arg !== '--rendered');
}

async function readSource(source, browser) {
  if (/^https?:\/\//i.test(source)) {
    return fetchRenderedChapterHtml(browser, source);
  }
  return fs.readFileSync(source, 'utf8');
}

async function main() {
  const sources = parseSources(process.argv.slice(2));
  const browser = await openBrowser();
  const chapters = [];
  const failures = [];

  try {
    for (const source of sources) {
      try {
        const html = await readSource(source, browser);
        const chapter = parseChapter(html, source);
        chapters.push(chapter);
        const status = chapter.paragraphCount > 0 ? 'extraido' : 'ignorado: conteudo vazio';
        console.log(`ch-${chapter.siteChapter || '-'}: ${chapter.title || 'sem titulo'} (${chapter.paragraphCount} paragrafos, ${status})`);
      } catch (error) {
        failures.push({ source, error: error.message });
        console.log(`${source}: falhou (${error.message})`);
      }
    }
  } finally {
    await browser.close();
  }

  const outputs = writeEnglishChapterOutputs(outputDir, chapters, failures);
  console.log(outputs.jsonPath);
  console.log(outputs.mdPath);
  console.log(`Capitulos extraidos: ${outputs.extractedCount}/${sources.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Erro ao extrair capitulos em ingles: ${error.message}`);
    process.exit(1);
  });
}
