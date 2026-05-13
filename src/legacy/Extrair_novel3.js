import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Packer, Paragraph, TextRun } from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📌 Lista com TODOS os links que você enviou
const chapterLinks = [
  "https://novelscanalations.wordpress.com/2024/03/26/jflt-chapter-1/",
  "https://novelscanalations.wordpress.com/2024/04/01/jflt-chapter-2/",
  "https://novelscanalations.wordpress.com/2024/04/03/jflt-chapter-3/",
  "https://novelscanalations.wordpress.com/2024/04/04/jflt-chapter-4/",
  "https://novelscanalations.wordpress.com/2024/04/05/jflt-chapter-5/",
  "https://novelscanalations.wordpress.com/2024/04/06/jflt-chapter-6/",
  "https://novelscanalations.wordpress.com/2024/04/07/jflt-chapter-7/",
  "https://novelscanalations.wordpress.com/2024/04/08/jflt-chapter-8/",
  "https://novelscanalations.wordpress.com/2024/04/09/jflt-chapter-9/",
  "https://novelscanalations.wordpress.com/2024/04/10/jflt-chapter-10/",
  "https://novelscanalations.wordpress.com/2024/04/13/jflt-chapter-11/",
  "https://novelscanalations.wordpress.com/2024/04/14/jflt-chapter-12/",
  "https://novelscanalations.wordpress.com/2024/04/16/jflt-chapter-13/",
  "https://novelscanalations.wordpress.com/2024/04/18/jflt-chapter-14/",
  "https://novelscanalations.wordpress.com/2024/04/19/jflt-chapter-15/",
  "https://novelscanalations.wordpress.com/2024/04/21/jflt-chapter-16/",
  "https://novelscanalations.wordpress.com/2024/04/22/jflt-chapter-17/",
  "https://novelscanalations.wordpress.com/2024/04/25/jflt-chapter-18/",
  "https://novelscanalations.wordpress.com/2024/04/27/jflt-chapter-19/",
  "https://novelscanalations.wordpress.com/2024/04/28/jflt-chapter-20/",
  "https://novelscanalations.wordpress.com/2024/04/30/jflt-chapter-21/",
  "https://novelscanalations.wordpress.com/2024/05/01/jflt-chapter-22/",
  "https://novelscanalations.wordpress.com/2024/05/03/jflt-chapter-23/",
  "https://novelscanalations.wordpress.com/2024/05/05/jflt-chapter-24/",
  "https://novelscanalations.wordpress.com/2024/05/12/jflt-chapter-25/",
  "https://novelscanalations.wordpress.com/2024/05/16/jflt-chapter-26/",
  "https://novelscanalations.wordpress.com/2024/05/20/jflt-chapter-27/",
  "https://novelscanalations.wordpress.com/2024/05/23/jflt-chapter-28/",
  "https://novelscanalations.wordpress.com/2024/05/23/jflt-chapter-29/",
  "https://novelscanalations.wordpress.com/2024/05/27/jflt-chapter-30/",
  "https://novelscanalations.wordpress.com/2024/05/28/jflt-chapter-31/",
  "https://novelscanalations.wordpress.com/2024/05/30/jflt-chapter-32/",
  "https://novelscanalations.wordpress.com/2024/06/04/jflt-chapter-33/",
  "https://novelscanalations.wordpress.com/2024/06/10/jflt-chapter-34/",
  "https://novelscanalations.wordpress.com/2024/06/14/jflt-chapter-35/",
  "https://novelscanalations.wordpress.com/2024/06/16/jflt-chapter-36/",
  "https://novelscanalations.wordpress.com/2024/06/20/jflt-chapter-37/",
  "https://novelscanalations.wordpress.com/2024/06/25/jflt-chapter-38/",
  "https://novelscanalations.wordpress.com/2024/06/29/jflt-chapter-39/",
  "https://novelscanalations.wordpress.com/2024/07/12/jflt-chapter-40/",
  "https://novelscanalations.wordpress.com/2024/07/27/jflt-chapter-41/",
  "https://novelscanalations.wordpress.com/2024/08/13/jflt-chapter-42/",
  "https://novelscanalations.wordpress.com/2024/08/14/jflt-chapter-43/",
  "https://novelscanalations.wordpress.com/2024/09/14/jflt-chapter-44/",
  "https://novelscanalations.wordpress.com/2024/09/14/jflt-chapter-45/",
  "https://novelscanalations.wordpress.com/2024/09/16/jflt-chapter-46/",
  "https://novelscanalations.wordpress.com/2024/09/17/jflt-chapter-47/",
  "https://novelscanalations.wordpress.com/2024/09/17/jflt-chapter-48/",
  "https://novelscanalations.wordpress.com/2024/09/18/jflt-chapter-49/",
  "https://novelscanalations.wordpress.com/2024/09/18/jflt-chapter-50/",
  "https://novelscanalations.wordpress.com/2024/09/20/jflt-chapter-51/",
  "https://novelscanalations.wordpress.com/2024/09/23/jflt-chapter-52/",
  "https://novelscanalations.wordpress.com/2024/09/26/jflt-chapter-53/",
  "https://novelscanalations.wordpress.com/2024/10/02/jflt-chapter-54/",
  "https://novelscanalations.wordpress.com/2024/10/03/jflt-chapter-55/",
  "https://novelscanalations.wordpress.com/2024/10/06/jflt-chapter-56/",
  "https://novelscanalations.wordpress.com/2024/10/12/jflt-chapter-57/",
  "https://novelscanalations.wordpress.com/2024/10/18/jflt-chapter-58/",
  "https://novelscanalations.wordpress.com/2024/11/06/jflt-chapter-59/",
  "https://novelscanalations.wordpress.com/2024/11/06/jflt-chapter-60/",
  "https://novelscanalations.wordpress.com/2024/11/09/jflt-chapter-61/",
  "https://novelscanalations.wordpress.com/2024/11/13/jflt-chapter-62/",
  "https://novelscanalations.wordpress.com/2024/11/27/jflt-chapter-63/",
  "https://novelscanalations.wordpress.com/2024/11/29/jflt-chapter-64/",
  "https://novelscanalations.wordpress.com/2024/11/30/jflt-chapter-65/",
  "https://novelscanalations.wordpress.com/2024/12/01/jflt-chapter-66/",
  "https://novelscanalations.wordpress.com/2024/12/01/jflt-chapter-67/",
  "https://novelscanalations.wordpress.com/2024/12/03/jflt-chapter-68/",
  "https://novelscanalations.wordpress.com/2024/12/09/jflt-chapter-69/",
  "https://novelscanalations.wordpress.com/2024/12/10/jflt-chapter-70/",
  "https://novelscanalations.wordpress.com/2024/12/11/jflt-chapter-71/",
  "https://novelscanalations.wordpress.com/2024/12/11/jflt-chapter-72/",
  "https://novelscanalations.wordpress.com/2024/12/12/jflt-chapter-73/",
  "https://novelscanalations.wordpress.com/2024/12/13/jflt-chapter-74/",
  "https://novelscanalations.wordpress.com/2024/12/14/jflt-chapter-75/",
  "https://novelscanalations.wordpress.com/2024/12/16/jflt-chapter-76/",
  "https://novelscanalations.wordpress.com/2024/12/17/jflt-chapter-77/",
  "https://novelscanalations.wordpress.com/2024/12/18/jflt-chapter-78/",
  "https://novelscanalations.wordpress.com/2024/12/19/jflt-chapter-79/",
  "https://novelscanalations.wordpress.com/2024/12/23/jflt-chapter-80/",
  "https://novelscanalations.wordpress.com/2024/12/24/jflt-chapter-81/",
  "https://novelscanalations.wordpress.com/2024/12/24/jflt-chapter-82/",
  "https://novelscanalations.wordpress.com/2024/12/25/jflt-chapter-83/",
  "https://novelscanalations.wordpress.com/2024/12/26/jflt-chapter-84/",
  "https://novelscanalations.wordpress.com/2024/12/27/jflt-chapter-85/",
  "https://novelscanalations.wordpress.com/2024/12/27/jflt-chapter-86/",
  "https://novelscanalations.wordpress.com/2024/12/28/jflt-chapter-87/",
  "https://novelscanalations.wordpress.com/2024/12/28/jflt-chapter-88/",
  "https://novelscanalations.wordpress.com/2024/12/29/jflt-chapter-89/",
  "https://novelscanalations.wordpress.com/2025/01/05/jflt-chapter-90/",
  "https://novelscanalations.wordpress.com/2025/01/06/jflt-chapter-91/",
  "https://novelscanalations.wordpress.com/2025/01/07/jflt-chapter-92/",
  "https://novelscanalations.wordpress.com/2025/01/08/jflt-chapter-93/",
  "https://novelscanalations.wordpress.com/2025/01/09/jflt-chapter-94/",
  "https://novelscanalations.wordpress.com/2025/01/10/jflt-chapter-95/",
  "https://novelscanalations.wordpress.com/2025/01/11/jflt-chapter-96/",
  "https://novelscanalations.wordpress.com/2025/01/12/jflt-chapter-97/",
  "https://novelscanalations.wordpress.com/2025/01/13/jflt-chapter-98/",
  "https://novelscanalations.wordpress.com/2025/01/15/jflt-chapter-99/",
  "https://novelscanalations.wordpress.com/2025/01/16/jflt-chapter-100/",
  "https://novelscanalations.wordpress.com/2025/01/17/jflt-chapter-101/",
  "https://novelscanalations.wordpress.com/2025/01/19/jflt-chapter-102/",
  "https://novelscanalations.wordpress.com/2025/01/20/jflt-chapter-103/",
  "https://novelscanalations.wordpress.com/2025/01/21/jflt-chapter-104/",
  "https://novelscanalations.wordpress.com/2025/01/22/jflt-chapter-105/",
  "https://novelscanalations.wordpress.com/2025/01/24/jflt-chapter-106/",
  "https://novelscanalations.wordpress.com/2025/01/25/jflt-chapter-107/",
  "https://novelscanalations.wordpress.com/2025/01/26/jflt-chapter-108/",
  "https://novelscanalations.wordpress.com/2025/01/29/jflt-chapter-109/",
  "https://novelscanalations.wordpress.com/2025/01/30/jflt-chapter-110/",
  "https://novelscanalations.wordpress.com/2025/01/31/jflt-chapter-111/",
  "https://novelscanalations.wordpress.com/2025/02/01/jflt-chapter-112/",
  "https://novelscanalations.wordpress.com/2025/02/03/jflt-chapter-113/",
  "https://novelscanalations.wordpress.com/2025/02/04/jflt-chapter-114/",
  "https://novelscanalations.wordpress.com/2025/02/05/jflt-chapter-115/",
  "https://novelscanalations.wordpress.com/2025/02/06/jflt-chapter-116/",
  "https://novelscanalations.wordpress.com/2025/02/08/jflt-chapter-117/",
  "https://novelscanalations.wordpress.com/2025/02/11/jflt-chapter-118/",
  "https://novelscanalations.wordpress.com/2025/02/12/jflt-chapter-119/",
  "https://novelscanalations.wordpress.com/2025/02/13/jflt-chapter-120/",
  "https://novelscanalations.wordpress.com/2025/02/19/jflt-chapter-121/",
  "https://novelscanalations.wordpress.com/2025/02/20/jflt-chapter-122/",
  "https://novelscanalations.wordpress.com/2025/02/21/jflt-chapter-123/",
  "https://novelscanalations.wordpress.com/2025/02/24/jflt-chapter-124/",
  "https://novelscanalations.wordpress.com/2025/02/25/jflt-chapter-125/",
  "https://novelscanalations.wordpress.com/2025/02/27/jflt-chapter-126/",
  "https://novelscanalations.wordpress.com/2025/02/28/jflt-chapter-127/",
  "https://novelscanalations.wordpress.com/2025/03/01/jflt-chapter-128/",
  "https://novelscanalations.wordpress.com/2025/03/02/jflt-chapter-129/",
  "https://novelscanalations.wordpress.com/2025/03/03/jflt-chapter-130/",
  "https://novelscanalations.wordpress.com/2025/03/04/jflt-chapter-131/",
  "https://novelscanalations.wordpress.com/2025/03/05/jflt-chapter-132/",
  "https://novelscanalations.wordpress.com/2025/03/06/jflt-chapter-133/",
  "https://novelscanalations.wordpress.com/2025/03/07/jflt-chapter-134/",
  "https://novelscanalations.wordpress.com/2025/03/09/jflt-chapter-135/",
  "https://novelscanalations.wordpress.com/2025/03/10/jflt-chapter-136/",
  "https://novelscanalations.wordpress.com/2025/03/11/jflt-chapter-137/",
  "https://novelscanalations.wordpress.com/2025/03/12/jflt-chapter-138/",
  "https://novelscanalations.wordpress.com/2025/03/13/jflt-chapter-139/",
  "https://novelscanalations.wordpress.com/2025/03/14/jflt-chapter-140/",
  "https://novelscanalations.wordpress.com/2025/03/15/jflt-chapter-141/",
  "https://novelscanalations.wordpress.com/2025/03/17/jflt-chapter-142/",
  "https://novelscanalations.wordpress.com/2025/03/18/jflt-chapter-143/",
  "https://novelscanalations.wordpress.com/2025/03/19/jflt-chapter-144/",
  "https://novelscanalations.wordpress.com/2025/03/20/jflt-chapter-145/",
  "https://novelscanalations.wordpress.com/2025/03/21/jflt-chapter-146/",
  "https://novelscanalations.wordpress.com/2025/03/22/jflt-chapter-147/",
  "https://novelscanalations.wordpress.com/2025/03/24/jflt-chapter-148/",
  "https://novelscanalations.wordpress.com/2025/03/25/jflt-chapter-149/",
  "https://novelscanalations.wordpress.com/2025/03/26/jflt-chapter-150/",
  "https://novelscanalations.wordpress.com/2025/03/27/jflt-chapter-151/",
  "https://novelscanalations.wordpress.com/2025/03/28/jflt-chapter-152/",
  "https://novelscanalations.wordpress.com/2025/03/30/jflt-chapter-153/",
  "https://novelscanalations.wordpress.com/2025/04/01/jflt-chapter-154/",
  "https://novelscanalations.wordpress.com/2025/04/03/jflt-chapter-155/",
  "https://novelscanalations.wordpress.com/2025/04/04/jflt-chapter-156/",
  "https://novelscanalations.wordpress.com/2025/04/05/jflt-chapter-157/",
  "https://novelscanalations.wordpress.com/2025/04/10/jflt-chapter-158/",
  "https://novelscanalations.wordpress.com/2025/04/11/jflt-chapter-159/",
  "https://novelscanalations.wordpress.com/2025/04/12/jflt-chapter-160/",
  "https://novelscanalations.wordpress.com/2025/04/14/jflt-chapter-161/",
  "https://novelscanalations.wordpress.com/2025/04/15/jflt-chapter-162/",
  "https://novelscanalations.wordpress.com/2025/04/16/jflt-chapter-163/",
  "https://novelscanalations.wordpress.com/2025/04/17/jflt-chapter-164/",
  "https://novelscanalations.wordpress.com/2025/04/18/jflt-chapter-165/",
  "https://novelscanalations.wordpress.com/2025/04/19/jflt-chapter-166/",
  "https://novelscanalations.wordpress.com/2025/04/23/jflt-chapter-167/",
  "https://novelscanalations.wordpress.com/2025/04/24/jflt-chapter-168/",
  "https://novelscanalations.wordpress.com/2025/04/26/jflt-chapter-169/",
  "https://novelscanalations.wordpress.com/2025/04/27/jflt-chapter-170/",
  "https://novelscanalations.wordpress.com/2025/04/28/jflt-chapter-171/",
  "https://novelscanalations.wordpress.com/2025/04/29/jflt-chapter-172/",
  "https://novelscanalations.wordpress.com/2025/04/30/jflt-chapter-173/",
  "https://novelscanalations.wordpress.com/2025/05/01/jflt-chapter-174/",
  "https://novelscanalations.wordpress.com/2025/05/02/jflt-chapter-175/",
  "https://novelscanalations.wordpress.com/2025/05/03/jflt-chapter-176/",
  "https://novelscanalations.wordpress.com/2025/05/05/jflt-chapter-177/",
  "https://novelscanalations.wordpress.com/2025/05/06/jflt-chapter-178/",
  "https://novelscanalations.wordpress.com/2025/05/07/jflt-chapter-179/",
  "https://novelscanalations.wordpress.com/2025/05/08/jflt-chapter-180/",
  "https://novelscanalations.wordpress.com/2025/05/09/jflt-chapter-181/",
  "https://novelscanalations.wordpress.com/2025/05/10/jflt-chapter-182/",
  "https://novelscanalations.wordpress.com/2025/05/11/jflt-chapter-183/",
  "https://novelscanalations.wordpress.com/2025/05/12/jflt-chapter-184/",
  "https://novelscanalations.wordpress.com/2025/05/13/jflt-chapter-185/",
  "https://novelscanalations.wordpress.com/2025/05/14/jflt-chapter-186/",
  "https://novelscanalations.wordpress.com/2025/05/15/jflt-chapter-187/",
  "https://novelscanalations.wordpress.com/2025/05/16/jflt-chapter-188/",
  "https://novelscanalations.wordpress.com/2025/05/17/jflt-chapter-189/",
  "https://novelscanalations.wordpress.com/2025/05/25/jflt-extra-1/",
  "https://novelscanalations.wordpress.com/2025/05/28/jflt-extra-2/",
  "https://novelscanalations.wordpress.com/2025/05/30/jflt-extra-3/",
  "https://novelscanalations.wordpress.com/2025/05/31/jflt-extra-4/",
  "https://novelscanalations.wordpress.com/2025/05/31/jflt-extra-5/",
  "https://novelscanalations.wordpress.com/2025/06/03/jflt-extra-6/",
  "https://novelscanalations.wordpress.com/2025/06/04/jflt-extra-7/",
  "https://novelscanalations.wordpress.com/2025/06/05/jflt-extra-8/",
  "https://novelscanalations.wordpress.com/2025/06/06/jflt-extra-9/",
  "https://novelscanalations.wordpress.com/2025/06/07/jflt-extra-10/",
  "https://novelscanalations.wordpress.com/2025/06/08/jflt-extra-11/",
  "https://novelscanalations.wordpress.com/2025/06/09/jflt-extra-12/",
  "https://novelscanalations.wordpress.com/2025/06/10/jflt-extra-13/",
  "https://novelscanalations.wordpress.com/2025/06/11/jflt-extra-14/",
  "https://novelscanalations.wordpress.com/2025/06/13/jflt-extra-15/",
  "https://novelscanalations.wordpress.com/2025/06/14/jflt-extra-16/",
  "https://novelscanalations.wordpress.com/2025/06/18/jflt-extra-17/",
  "https://novelscanalations.wordpress.com/2025/06/19/jflt-extra-18/",
  "https://novelscanalations.wordpress.com/2025/06/19/jflt-extra-19/",
  "https://novelscanalations.wordpress.com/2025/06/19/jflt-extra-20/"
];

// 📌 Função para extrair conteúdo
async function scrapeChapter(url, page) {
  console.log(`🔎 Extraindo: ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

    const content = await page.$$eval("div.entry-content p", (elements) =>
      elements.map((el) => el.innerText.trim()).filter((t) => t.length > 0)
    );

    return content.length ? content : [`⚠️ Nenhum conteúdo encontrado em ${url}`];
  } catch (err) {
    console.error(`❌ Erro ao acessar ${url}:`, err.message);
    return [`⚠️ Erro ao carregar ${url}`];
  }
}

// 📌 Função principal
async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let docParagraphs = [];

  for (let i = 0; i < chapterLinks.length; i++) {
    const chapterUrl = chapterLinks[i];
    const chapterText = await scrapeChapter(chapterUrl, page);

    docParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Capítulo ${i + 1}`,
            bold: true,
            size: 32,
          }),
        ],
        spacing: { after: 200 },
      })
    );

    chapterText.forEach((para) => {
      docParagraphs.push(new Paragraph(para));
    });

    docParagraphs.push(new Paragraph("")); // espaço entre capítulos
  }

  const doc = new Document({ sections: [{ children: docParagraphs }] });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(__dirname, "Novel_JFLT.docx"), buffer);

  await browser.close();
  console.log("✅ Documento salvo: Novel_JFLT.docx");
}

main();