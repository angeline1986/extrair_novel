import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

// ================= CONFIG =================
const OUTPUT_DIR = "docx_winter_field_volumes";

const BOOK_TITLE = "Winter Field";
const BOOK_AUTHOR = "straewgibl";

// Delay MUITO SEGURO: 2s a 5s
const MIN_DELAY = 2000;
const MAX_DELAY = 5000;

// Seletores Blogger
const TITLE_SELECTOR = "h2 span";
const CONTENT_SELECTOR = 'h2[dir="ltr"] ~ p';

// ================= VOLUMES =================
const VOLUMES = [
  {
    title: "Volume 1",
    fileName: "winter_field_volume_1.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-1-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-2-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-3-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-4-winter-field.html",
    ],
  },
  {
    title: "Volume 2",
    fileName: "winter_field_volume_2.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-5-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-6-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-7-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-8-winter-field.html",
    ],
  },
  {
    title: "Volume 3",
    fileName: "winter_field_volume_3.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-9-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-10-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-11-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-12-winter-field.html",
    ],
  },
  {
    title: "Volume 4",
    fileName: "winter_field_volume_4.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-13-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-14-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-15-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-16-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-17-winter-field.html",
    ],
  },
  {
    title: "Volume 5",
    fileName: "winter_field_volume_5.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-18-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-19-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-20-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-21-winter-field.html",
    ],
  },
  {
    title: "Extras Volume 6",
    fileName: "winter_field_extras_volume_6.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/historia-paralela-capitulo-1-winter.html",
      "https://straewgibl.blogspot.com/2026/01/historia-paralela-capitulo-2-winter.html",
      "https://straewgibl.blogspot.com/2026/01/historia-paralela-capitulo-3-winter.html",
    ],
  },
  {
    title: "Extras Volume 7",
    fileName: "winter_field_extras_volume_7.docx",
    urls: [
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-1-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-2-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-3-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-4-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-5-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-6-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-7-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-8-winter.html",
    ],
  },
];

// ================= HELPERS =================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeDelay() {
  const time =
    Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

  console.log(`⏳ Delay muito seguro: ${(time / 1000).toFixed(2)}s`);
  await sleep(time);
}

function cleanText(text = "") {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escolherTitulo(titles) {
  if (!titles.length) return "Capítulo";

  const chapterTitle = titles.find(t => /cap[ií]tulo/i.test(t));
  if (chapterTitle) return chapterTitle;

  const nonVolumeTitle = titles.find(t => !/volumen|volume/i.test(t));
  if (nonVolumeTitle) return nonVolumeTitle;

  return titles[0];
}


// ================= SCRAPING =================
async function extrairCapitulo(browser, url) {
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: 120000,
  });

  await sleep(800);

  let titles = [];
  try {
    titles = await page.$$eval(TITLE_SELECTOR, els =>
      els.map(e => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean)
    );
  } catch {
    titles = [];
  }

  const title = escolherTitulo(titles);

  let paragraphs = [];
  try {
    paragraphs = await page.$$eval(CONTENT_SELECTOR, els =>
      els
        .map(e =>
          e.textContent
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean)
        .filter(p => !/^volumen\s*\d+/i.test(p))
    );
  } catch {
    paragraphs = [];
  }

  await page.close();

  return {
    url,
    title,
    titlesFound: titles,
    paragraphs,
  };
}

// ================= DOCX =================
function criarParagrafoTituloLivro(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
  });
}

function criarParagrafoVolume(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });
}

function criarParagrafoCapitulo(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 300 },
  });
}

function criarParagrafoTexto(text) {
  return new Paragraph({
    children: [new TextRun(cleanText(text))],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    indent: { firstLine: 720 },
  });
}

function criarPaginaEmBranco() {
  return new Paragraph({
    children: [new TextRun({ text: "", break: 1 })],
  });
}

async function gerarDocxVolume(volume, chapters) {
  const children = [];



 children.push(criarParagrafoVolume(volume.title));

  chapters.forEach((chapter, index) => {
    if (index > 0) {
      children.push(criarPaginaEmBranco());
    }

    children.push(criarParagrafoCapitulo(chapter.title));

    if (!chapter.paragraphs.length) {
      children.push(
        new Paragraph({
          text: "[Nenhum conteúdo encontrado neste capítulo]",
          alignment: AlignmentType.CENTER,
        })
      );
      return;
    }

    for (const paragraph of chapter.paragraphs) {
      children.push(criarParagrafoTexto(paragraph));
    }
  });

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  //configurarEstilos(doc);

  ensureDir(OUTPUT_DIR);

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(OUTPUT_DIR, volume.fileName);

  fs.writeFileSync(outputPath, buffer);

  console.log(`📄 DOCX salvo: ${path.resolve(outputPath)}`);
}

// ================= MAIN =================
async function main() {
  ensureDir(OUTPUT_DIR);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const volume of VOLUMES) {
      console.log(`\n==============================`);
      console.log(`📘 Processando ${volume.title}`);
      console.log(`==============================`);

      const chapters = [];

      for (const url of volume.urls) {
        console.log(`🔎 Extraindo: ${url}`);

        try {
          const chapter = await extrairCapitulo(browser, url);

          console.log(`📌 Títulos encontrados: ${chapter.titlesFound.join(" | ")}`);
          console.log(`✅ Título escolhido: ${chapter.title}`);
          console.log(`📄 Parágrafos: ${chapter.paragraphs.length}`);

          chapters.push(chapter);
        } catch (err) {
          console.error(`❌ Erro ao extrair ${url}:`, err?.message || err);

          chapters.push({
            url,
            title: "Capítulo com erro",
            paragraphs: [`[Erro ao extrair este capítulo: ${err?.message || err}]`],
            titlesFound: [],
          });
        }

        await safeDelay();
      }

      await gerarDocxVolume(volume, chapters);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✅ Todos os volumes foram gerados em: ${path.resolve(OUTPUT_DIR)}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});