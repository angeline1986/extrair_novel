import puppeteer from "puppeteer";
import fs from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

// === Gerar URLs automaticamente de 192 a 281 + final ===
const URLS = [];
for (let i = 192; i <= 194; i++) {
  URLS.push(
    `https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-${i}/`
  );
}
// último capítulo (282, rotulado como "final")
URLS.push(
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-final-282/"
);

// ---------- scraping ----------
async function coletarParagrafos(page) {
  const sel = "div.reading-content div.text-left p";

  await page.waitForSelector("body");

  let ps = [];
  const existe = await page.$(sel);
  if (existe) {
    ps = await page.$$eval(sel, els =>
      els.map(e => e.textContent.trim()).filter(Boolean)
    );
  }

  return ps;
}

async function extrairCapitulo(browser, url) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });

  // título/capítulo
  let titulo = "";
  try {
    const tsel = "div.c-breadcrumb > ol > li.active";
    await page.waitForSelector(tsel, { timeout: 6000 });
    titulo = await page.$eval(tsel, el => el.textContent.trim());
  } catch {}

  const paragrafos = await coletarParagrafos(page);
  await page.close();

  return { url, titulo, paragrafos };
}

// ---------- montagem do DOCX único ----------
function capituloParaDocChildren(cap, isFirst) {
  const children = [];

  if (!isFirst) {
    // quebra de página
    children.push(new Paragraph({ children: [new TextRun({ break: 1 })] }));
  }

  if (cap.titulo) {
    children.push(
      new Paragraph({
        text: cap.titulo,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );
  }

  if (cap.paragrafos?.length) {
    for (const p of cap.paragrafos) {
      children.push(
        new Paragraph({
          children: [new TextRun(p)],
          alignment: AlignmentType.JUSTIFIED,
        })
      );
      children.push(new Paragraph("")); // linha em branco após cada <p>
    }
  } else {
    children.push(
      new Paragraph({ text: "[Nenhum parágrafo encontrado neste capítulo]" })
    );
  }

  return children;
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const capitulos = [];
  try {
    for (const url of URLS) {
      console.log(`\n=== Extraindo: ${url}`);
      try {
        const cap = await extrairCapitulo(browser, url);
        capitulos.push(cap);
      } catch (err) {
        console.error(`❌ Erro ao extrair ${url}:`, err?.message || err);
      }
    }
  } finally {
    await browser.close();
  }

  const allChildren = [];
  capitulos.forEach((cap, idx) => {
    allChildren.push(...capituloParaDocChildren(cap, idx === 0));
  });

  const doc = new Document({ sections: [{ children: allChildren }] });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("qiang_jin_jiu_capitulos_192_a_282.docx", buffer);
  console.log("\n📄 Documento único salvo como qiang_jin_jiu_capitulos_192_a_282.docx");
}

main();
