import puppeteer from "puppeteer";
import fs from "fs";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";

const SEPARADOR = "=============================================================";

// === URLs capítulos 1 a 173 ===
const URLS = [
  "https://novelscanalations.wordpress.com/2024/06/05/hctrpaas-chapter-1/",
  "https://novelscanalations.wordpress.com/2024/06/06/hctrpaas-chapter-2/",
  "https://novelscanalations.wordpress.com/2024/06/07/hctrpaas-chapter-3/",
  "https://novelscanalations.wordpress.com/2024/06/08/hctrpaas-chapter-4/",
  "https://novelscanalations.wordpress.com/2024/06/09/hctrpaas-chapter-5/",
  "https://novelscanalations.wordpress.com/2024/06/10/hctrpaas-chapter-6/",
  "https://novelscanalations.wordpress.com/2024/06/11/hctrpaas-chapter-7/",
  "https://novelscanalations.wordpress.com/2024/06/13/hctrpaas-chapter-8/",
  "https://novelscanalations.wordpress.com/2024/06/13/hctrpaas-chapter-9/",
  "https://novelscanalations.wordpress.com/2024/06/14/hctrpaas-chapter-10/",
  "https://novelscanalations.wordpress.com/2024/06/15/hctrpaas-chapter-11/",
  "https://novelscanalations.wordpress.com/2024/06/15/hctrpaas-chapter-12/",
  "https://novelscanalations.wordpress.com/2024/06/16/hctrpaas-chapter-13/",
  "https://novelscanalations.wordpress.com/2024/06/17/hctrpaas-chapter-14/",
  "https://novelscanalations.wordpress.com/2024/06/18/hctrpaas-chapter-15/",
  "https://novelscanalations.wordpress.com/2024/06/18/hctrpaas-chapter-16/",
  "https://novelscanalations.wordpress.com/2024/06/18/hctrpaas-chapter-17/",
  "https://novelscanalations.wordpress.com/2024/06/19/hctrpaas-chapter-18/",
  "https://novelscanalations.wordpress.com/2024/06/20/hctrpaas-chapter-19/",
  "https://novelscanalations.wordpress.com/2024/06/22/hctrpaas-chapter-20/",
  "https://novelscanalations.wordpress.com/2024/06/22/hctrpaas-chapter-21/",
  "https://novelscanalations.wordpress.com/2024/06/23/hctrpaas-chapter-22/",
  "https://novelscanalations.wordpress.com/2024/06/23/hctrpaas-chapter-23/",
  "https://novelscanalations.wordpress.com/2024/06/24/hctrpaas-chapter-24/",
  "https://novelscanalations.wordpress.com/2024/06/24/hctrpaas-chapter-25/",
  "https://novelscanalations.wordpress.com/2024/06/25/hctrpaas-chapter-26/",
  "https://novelscanalations.wordpress.com/2024/06/25/hctrpaas-chapter-27/",
  "https://novelscanalations.wordpress.com/2024/06/26/hctrpaas-chapter-28/",
  "https://novelscanalations.wordpress.com/2024/06/27/hctrpaas-chapter-29/",
  "https://novelscanalations.wordpress.com/2024/06/27/hctrpaas-chapter-30/",
  "https://novelscanalations.wordpress.com/2024/06/28/hctrpaas-chapter-31/",
  "https://novelscanalations.wordpress.com/2024/06/28/hctrpaas-chapter-32/",
  "https://novelscanalations.wordpress.com/2024/06/30/hctrpaas-chapter-33/",
  "https://novelscanalations.wordpress.com/2024/06/30/hctrpaas-chapter-34/",
  "https://novelscanalations.wordpress.com/2024/07/02/hctrpaas-chapter-35/",
  "https://novelscanalations.wordpress.com/2024/07/05/hctrpaas-chapter-36/",
  "https://novelscanalations.wordpress.com/2024/07/05/hctrpaas-chapter-37/",
  "https://novelscanalations.wordpress.com/2024/07/05/hctrpaas-chapter-38/",
  "https://novelscanalations.wordpress.com/2024/07/05/hctrpaas-chapter-39/",
  "https://novelscanalations.wordpress.com/2024/07/06/hctrpaas-chapter-40/",
  "https://novelscanalations.wordpress.com/2024/07/06/hctrpaas-chapter-41/",
  "https://novelscanalations.wordpress.com/2024/07/07/hctrpaas-chapter-42/",
  "https://novelscanalations.wordpress.com/2024/07/07/hctrpaas-chapter-43/",
  "https://novelscanalations.wordpress.com/2024/07/08/hctrpaas-chapter-44/",
  "https://novelscanalations.wordpress.com/2024/07/08/hctrpaas-chapter-45/",
  "https://novelscanalations.wordpress.com/2024/07/09/hctrpaas-chapter-46/",
  "https://novelscanalations.wordpress.com/2024/07/09/hctrpaas-chapter-47/",
  "https://novelscanalations.wordpress.com/2024/07/10/hctrpaas-chapter-48/",
  "https://novelscanalations.wordpress.com/2024/07/10/hctrpaas-chapter-49/",
  "https://novelscanalations.wordpress.com/2024/07/11/hctrpaas-chapter-50/",
  "https://novelscanalations.wordpress.com/2024/07/11/hctrpaas-chapter-51/",
  "https://novelscanalations.wordpress.com/2024/07/11/hctrpaas-chapter-52/",
  "https://novelscanalations.wordpress.com/2024/07/12/hctrpaas-chapter-53/",
  "https://novelscanalations.wordpress.com/2024/07/13/hctrpaas-chapter-54/",
  "https://novelscanalations.wordpress.com/2024/07/13/hctrpaas-chapter-55/",
  "https://novelscanalations.wordpress.com/2024/07/14/hctrpaas-chapter-56/",
  "https://novelscanalations.wordpress.com/2024/07/14/hctrpaas-chapter-57/",
  "https://novelscanalations.wordpress.com/2024/07/15/hctrpaas-chapter-58/",
  "https://novelscanalations.wordpress.com/2024/07/15/hctrpaas-chapter-59/",
  "https://novelscanalations.wordpress.com/2024/07/16/hctrpaas-chapter-60/",
  "https://novelscanalations.wordpress.com/2024/07/16/hctrpaas-chapter-61/",
  "https://novelscanalations.wordpress.com/2024/07/17/hctrpaas-chapter-62/",
  "https://novelscanalations.wordpress.com/2024/07/18/hctrpaas-chapter-63/",
  "https://novelscanalations.wordpress.com/2024/07/18/hctrpaas-chapter-64/",
  "https://novelscanalations.wordpress.com/2024/07/18/hctrpaas-chapter-65/",
  "https://novelscanalations.wordpress.com/2024/07/19/hctrpaas-chapter-66/",
  "https://novelscanalations.wordpress.com/2024/07/21/hctrpaas-chapter-67/",
  "https://novelscanalations.wordpress.com/2024/07/21/hctrpaas-chapter-68/",
  "https://novelscanalations.wordpress.com/2024/07/22/hctrpaas-chapter-69/",
  "https://novelscanalations.wordpress.com/2024/07/22/hctrpaas-chapter-70/",
  "https://novelscanalations.wordpress.com/2024/07/23/hctrpaas-chapter-71/",
  "https://novelscanalations.wordpress.com/2024/07/23/hctrpaas-chapter-72/",
  "https://novelscanalations.wordpress.com/2024/07/24/hctrpaas-chapter-73/",
  "https://novelscanalations.wordpress.com/2024/07/24/hctrpaas-chapter-74/",
  "https://novelscanalations.wordpress.com/2024/07/25/hctrpaas-chapter-75/",
  "https://novelscanalations.wordpress.com/2024/07/25/hctrpaas-chapter-76/",
  "https://novelscanalations.wordpress.com/2024/07/26/hctrpaas-chapter-77/",
  "https://novelscanalations.wordpress.com/2024/07/26/hctrpaas-chapter-78/",
  "https://novelscanalations.wordpress.com/2024/07/26/hctrpaas-chapter-79/",
  "https://novelscanalations.wordpress.com/2024/07/27/hctrpaas-chapter-80/",
  "https://novelscanalations.wordpress.com/2024/07/27/hctrpaas-chapter-81/",
  "https://novelscanalations.wordpress.com/2024/07/27/hctrpaas-chapter-82/",
  "https://novelscanalations.wordpress.com/2024/07/28/hctrpaas-chapter-83/",
  "https://novelscanalations.wordpress.com/2024/07/28/hctrpaas-chapter-84/",
  "https://novelscanalations.wordpress.com/2024/07/29/hctrpaas-chapter-85/",
  "https://novelscanalations.wordpress.com/2024/07/29/hctrpaas-chapter-86/",
  "https://novelscanalations.wordpress.com/2024/07/30/hctrpaas-chapter-87/",
  "https://novelscanalations.wordpress.com/2024/07/30/hctrpaas-chapter-88/",
  "https://novelscanalations.wordpress.com/2024/07/31/hctrpaas-chapter-89/",
  "https://novelscanalations.wordpress.com/2024/07/31/hctrpaas-chapter-90/",
  "https://novelscanalations.wordpress.com/2024/08/01/hctrpaas-chapter-91/",
  "https://novelscanalations.wordpress.com/2024/08/01/hctrpaas-chapter-92/",
  "https://novelscanalations.wordpress.com/2024/08/03/hctrpaas-chapter-93/",
  "https://novelscanalations.wordpress.com/2024/08/03/hctrpaas-chapter-94/",
  "https://novelscanalations.wordpress.com/2024/08/04/hctrpaas-chapter-95/",
  "https://novelscanalations.wordpress.com/2024/08/05/hctrpaas-chapter-96/",
  "https://novelscanalations.wordpress.com/2024/08/06/hctrpaas-chapter-97/",
  "https://novelscanalations.wordpress.com/2024/08/08/hctrpaas-chapter-98/",
  "https://novelscanalations.wordpress.com/2024/08/10/hctrpaas-chapter-99/",
  "https://novelscanalations.wordpress.com/2024/08/11/hctrpaas-chapter-100/",
  "https://novelscanalations.wordpress.com/2024/08/12/hctrpaas-chapter-101/",
  "https://novelscanalations.wordpress.com/2024/08/13/hctrpaas-chapter-102/",
  "https://novelscanalations.wordpress.com/2024/08/13/hctrpaas-chapter-103/",
  "https://novelscanalations.wordpress.com/2024/08/13/hctrpaas-chapter-104/",
  "https://novelscanalations.wordpress.com/2024/08/14/hctrpaas-chapter-105/",
  "https://novelscanalations.wordpress.com/2024/08/14/hctrpaas-chapter-106/",
  "https://novelscanalations.wordpress.com/2024/08/15/hctrpaas-chapter-107/",
  "https://novelscanalations.wordpress.com/2024/08/15/hctrpaas-chapter-108/",
  "https://novelscanalations.wordpress.com/2024/08/16/hctrpaas-chapter-109/",
  "https://novelscanalations.wordpress.com/2024/08/16/hctrpaas-chapter-110/",
  "https://novelscanalations.wordpress.com/2024/08/17/hctrpaas-chapter-111/",
  "https://novelscanalations.wordpress.com/2024/08/17/hctrpaas-chapter-112/",
  "https://novelscanalations.wordpress.com/2024/08/18/hctrpaas-chapter-113/",
  "https://novelscanalations.wordpress.com/2024/08/18/hctrpaas-chapter-114/",
  "https://novelscanalations.wordpress.com/2024/08/18/hctrpaas-chapter-115/",
  "https://novelscanalations.wordpress.com/2024/08/18/hctrpaas-chapter-116/",
  "https://novelscanalations.wordpress.com/2024/08/20/hctrpaas-chapter-117/",
  "https://novelscanalations.wordpress.com/2024/08/20/hctrpaas-chapter-118/",
  "https://novelscanalations.wordpress.com/2024/08/20/hctrpaas-chapter-119/",
  "https://novelscanalations.wordpress.com/2024/08/20/hctrpaas-chapter-120/",
  "https://novelscanalations.wordpress.com/2024/08/21/hctrpaas-chapter-121/",
  "https://novelscanalations.wordpress.com/2024/08/21/hctrpaas-chapter-122/",
  "https://novelscanalations.wordpress.com/2024/08/22/hctrpaas-chapter-123/",
  "https://novelscanalations.wordpress.com/2024/08/22/hctrpaas-chapter-124/",
  "https://novelscanalations.wordpress.com/2024/08/23/hctrpaas-chapter-125/",
  "https://novelscanalations.wordpress.com/2024/08/23/hctrpaas-chapter-126/",
  "https://novelscanalations.wordpress.com/2024/08/24/hctrpaas-chapter-127/",
  "https://novelscanalations.wordpress.com/2024/08/24/hctrpaas-chapter-128/",
  "https://novelscanalations.wordpress.com/2024/08/25/hctrpaas-chapter-129/",
  "https://novelscanalations.wordpress.com/2024/08/25/hctrpaas-chapter-130/",
  "https://novelscanalations.wordpress.com/2024/08/26/hctrpaas-chapter-131/",
  "https://novelscanalations.wordpress.com/2024/08/26/hctrpaas-chapter-132/",
  "https://novelscanalations.wordpress.com/2024/08/27/hctrpaas-chapter-133/",
  "https://novelscanalations.wordpress.com/2024/08/27/hctrpaas-chapter-134/",
  "https://novelscanalations.wordpress.com/2024/08/27/hctrpaas-chapter-135/",
  "https://novelscanalations.wordpress.com/2024/08/27/hctrpaas-chapter-136/",
  "https://novelscanalations.wordpress.com/2024/08/28/hctrpaas-chapter-137/",
  "https://novelscanalations.wordpress.com/2024/08/28/hctrpaas-chapter-138/",
  "https://novelscanalations.wordpress.com/2024/08/28/hctrpaas-chapter-139/",
  "https://novelscanalations.wordpress.com/2024/08/28/hctrpaas-chapter-140/",
  "https://novelscanalations.wordpress.com/2024/08/29/hctrpaas-chapter-141/",
  "https://novelscanalations.wordpress.com/2024/08/29/hctrpaas-chapter-142/",
  "https://novelscanalations.wordpress.com/2024/08/29/hctrpaas-chapter-143/",
  "https://novelscanalations.wordpress.com/2024/08/29/hctrpaas-chapter-144/",
  "https://novelscanalations.wordpress.com/2024/08/29/hctrpaas-chapter-145/",
  "https://novelscanalations.wordpress.com/2024/08/29/hctrpaas-chapter-146/",
  "https://novelscanalations.wordpress.com/2024/08/30/hctrpaas-chapter-147/",
  "https://novelscanalations.wordpress.com/2024/08/30/hctrpaas-chapter-148/",
  "https://novelscanalations.wordpress.com/2024/08/30/hctrpaas-chapter-149/",
  "https://novelscanalations.wordpress.com/2024/08/30/hctrpaas-chapter-150/",
  "https://novelscanalations.wordpress.com/2024/08/31/hctrpaas-chapter-151/",
  "https://novelscanalations.wordpress.com/2024/09/04/hctrpaas-chapter-152/",
  "https://novelscanalations.wordpress.com/2024/09/04/hctrpaas-chapter-153/",
  "https://novelscanalations.wordpress.com/2024/09/04/hctrpaas-chapter-154/",
  "https://novelscanalations.wordpress.com/2024/09/05/hctrpaas-chapter-155/",
  "https://novelscanalations.wordpress.com/2024/09/05/hctrpaas-chapter-156/",
  "https://novelscanalations.wordpress.com/2024/09/05/hctrpaas-chapter-157/",
  "https://novelscanalations.wordpress.com/2024/09/05/hctrpaas-chapter-158/",
  "https://novelscanalations.wordpress.com/2024/09/05/hctrpaas-chapter-159/",
  "https://novelscanalations.wordpress.com/2024/09/05/hctrpaas-chapter-160/",
  "https://novelscanalations.wordpress.com/2024/09/06/hctrpaas-chapter-161/",
  "https://novelscanalations.wordpress.com/2024/09/07/hctrpaas-chapter-162/",
  "https://novelscanalations.wordpress.com/2024/09/08/hctrpaas-chapter-163/",
  "https://novelscanalations.wordpress.com/2024/09/08/hctrpaas-chapter-164/",
  "https://novelscanalations.wordpress.com/2024/09/08/hctrpaas-chapter-165/",
  "https://novelscanalations.wordpress.com/2024/09/10/hctrpaas-chapter-166/",
  "https://novelscanalations.wordpress.com/2024/09/10/hctrpaas-chapter-167/",
  "https://novelscanalations.wordpress.com/2024/09/11/hctrpaas-chapter-168/",
  "https://novelscanalations.wordpress.com/2024/09/11/hctrpaas-chapter-169/",
  "https://novelscanalations.wordpress.com/2024/09/13/hctrpaas-chapter-170/",
  "https://novelscanalations.wordpress.com/2024/09/13/hctrpaas-chapter-171/",
  "https://novelscanalations.wordpress.com/2024/09/13/hctrpaas-chapter-172/",
  "https://novelscanalations.wordpress.com/2024/09/13/hctrpaas-chapter-173/",
];

// ---------- scraping ----------
async function coletarParagrafos(page) {
  const selForte =
    ".wp-block-column.has-global-padding.is-layout-constrained.wp-block-column-is-layout-constrained p";
  const selFallback = ".entry-content p, article p";

  await page.waitForSelector("body");

  let ps = await page.$$eval(selForte, (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean)
  );
  if (!ps || ps.length === 0) {
    const existeFallback = await page.$(selFallback);
    if (existeFallback) {
      ps = await page.$$eval(selFallback, (els) =>
        els.map((e) => e.textContent.trim()).filter(Boolean)
      );
    } else {
      ps = [];
    }
  }

  if (ps.length) {
    const textoAteSep = ps.join("\n\n").split(SEPARADOR)[0] || "";
    ps = textoAteSep
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ps;
}

async function extrairCapitulo(browser, url) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });

  let titulo = "";
  try {
    await page.waitForSelector("h2.wp-block-post-title", { timeout: 6000 });
    titulo = await page.$eval("h2.wp-block-post-title", (el) =>
      el.textContent.trim()
    );
  } catch {}

  let subtitulo = "";
  try {
    const h1sel =
      "h1.wp-block-heading.has-luminous-vivid-amber-color.has-text-color.has-link-color";
    const existe = await page.$(h1sel);
    if (existe) {
      subtitulo = await page.$eval(h1sel, (el) => el.textContent.trim());
    }
  } catch {}

  const paragrafos = await coletarParagrafos(page);
  await page.close();

  return { url, titulo, subtitulo, paragrafos };
}

// ---------- montagem do DOCX único ----------
function capituloParaDocChildren(cap, isFirst) {
  const children = [];

  if (!isFirst) {
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
  if (cap.subtitulo) {
    children.push(
      new Paragraph({
        text: cap.subtitulo,
        heading: HeadingLevel.HEADING_2,
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
      children.push(new Paragraph(""));
    }
  } else {
    children.push(
      new Paragraph({ text: "[Nenhum <p> encontrado até o separador]" })
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
  fs.writeFileSync("hctrpaas_capitulos_1_a_173.docx", buffer);
  console.log(
    "\n📄 Documento único salvo como hctrpaas_capitulos_1_a_173.docx"
  );
}

main();
