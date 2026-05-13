import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import archiver from "archiver";

// ---------------- CONFIG ----------------
const BOOK_TITLE = "Qiang Jin Jiu - Volume 1";
const BOOK_AUTHOR = "yunmenghell";
const BOOK_ID = "qiangjinjiu-vol1";
const OUTPUT_FILE = "qiang_jin_jiu_vol1.epub";

// Se houver um "cover.jpg" no diretório do script, ele será copiado.
// Senão, o EPUB ainda é gerado, mas sem item de capa no OPF.
const COVER_SOURCE_FILE = path.join(process.cwd(), "cover.jpg");

// Lista de capítulos do Volume 1
const URLS = [
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-0/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-0_1/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-1/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-2/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-3/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-4/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-5/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-6/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-7/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-8/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-9/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-10/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-11/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-12/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-13/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-14/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-15/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-16/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-17/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-18/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-19/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-20/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-21/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-22/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-23/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-24/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-25/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-26/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-27/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-28/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-29/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-30/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-31/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-32/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-33/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-34/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-35/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-36/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-37/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-38/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-39/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-40/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-41/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-42/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-43/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-44/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-45/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-46/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-47/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-48/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-49/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-50/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-51/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-52/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-53/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-54/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-55/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-56/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-57/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-58/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-59/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-60/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-61/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-62/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-63/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-64/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-65/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-66/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-67/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-68/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-69/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-70/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-71/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-72/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-73/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-74/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-75/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-76/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-77/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-78/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-79/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-80/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-81/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-82/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-83/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-84/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-85/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-86/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-87/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-88/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-89/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-90/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-91/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-92/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-93/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-94/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-95/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-1/capitulo-96/",
];



// ---------------- RESTANTE DO SCRIPT ----------------
// (o corpo é o mesmo que revisei na versão anterior — scraping, geração de arquivos e compactação)


// ---------------- HELPERS ----------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

// ---------------- SCRAPING ----------------
async function coletarParagrafos(page) {
  const sel = "div.reading-content div.text-left p";
  await page.waitForSelector("body");

  let ps = [];
  const existe = await page.$(sel);
  if (existe) {
    ps = await page.$$eval(sel, els =>
      els
        .map(e => {
          const text = e.textContent.trim();
          if (!text) return null;
          return { text, isSeparator: text.includes("✦") || text.includes("⊱") };
        })
        .filter(Boolean)
    );
  }
  return ps;
}

async function extrairCapitulo(browser, url) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });

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

// ---------------- EPUB FILES ----------------
function gerarCoverXHTML(oebpsDir) {
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head><title>Cover</title>
<style type="text/css">
@page {padding: 0pt; margin:0pt}
body { text-align: center; padding:0pt; margin: 0pt; }
div { margin: 0pt; padding: 0pt; }
</style></head>
<body class="fff_coverpage"><div>
<img src="images/cover.jpg" alt="cover"/>
</div></body></html>`;
  writeFile(path.join(oebpsDir, "cover.xhtml"), html);
}

function gerarTitlePage(oebpsDir) {
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${BOOK_TITLE}</title>
<link href="stylesheet.css" type="text/css" rel="stylesheet"/>
</head>
<body class="fff_titlepage">
<h3>${BOOK_TITLE} por ${BOOK_AUTHOR}</h3>
</body>
</html>`;
  writeFile(path.join(oebpsDir, "title_page.xhtml"), html);
}

function gerarChapterXHTML(oebpsDir, cap, idx) {
  const filename = `file${String(idx + 1).padStart(4, "0")}.xhtml`;
  const ps = cap.paragrafos
    .map(p =>
      p.isSeparator
        ? `<p class="separator">${p.text}</p>`
        : `<p>${p.text}</p>`
    )
    .join("\n");

  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${cap.titulo}</title>
<link href="stylesheet.css" type="text/css" rel="stylesheet"/>
<meta name="chapterurl" content="${cap.url}" />
<meta name="chaptertitle" content="${cap.titulo}" />
</head>
<body class="fff_chapter">
<h3 class="fff_chapter_title">${cap.titulo}</h3>
${ps}
</body>
</html>`;
  writeFile(path.join(oebpsDir, filename), html);
  return filename;
}

function gerarStylesheet(oebpsDir) {
  const css = `body { font-family: serif; line-height: 1.5; margin: 1em; }
h3 { text-align: center; margin: 1em 0; }
p { text-indent: 1.5em; margin: 0.5em 0; }
.fff_chapter_title { margin-top: 0.5em; text-align: center; }
.separator { text-align: center; text-indent: 0; margin: 1em 0; }`;
  writeFile(path.join(oebpsDir, "stylesheet.css"), css);
}

function gerarNav(oebpsDir, chapters) {
  const items = chapters
    .map((c, i) => `<li><a href="${c.file}">${c.titulo}</a></li>`)
    .join("\n");
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Índice</title><link href="stylesheet.css" rel="stylesheet"/></head>
<body><nav epub:type="toc" id="toc"><h2>Índice</h2><ol>
<li><a href="title_page.xhtml">Página de Título</a></li>
${items}
</ol></nav></body></html>`;
  writeFile(path.join(oebpsDir, "nav.xhtml"), html);
}

function gerarNCX(oebpsDir, chapters) {
  const items = chapters
    .map(
      (c, i) => `<navPoint id="chap${i + 1}" playOrder="${i + 2}">
  <navLabel><text>${c.titulo}</text></navLabel>
  <content src="${c.file}"/>
</navPoint>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
  <meta name="dtb:uid" content="${BOOK_ID}"/>
  <meta name="dtb:depth" content="1"/>
  <meta name="dtb:totalPageCount" content="0"/>
  <meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${BOOK_TITLE}</text></docTitle>
<navMap>
  <navPoint id="title" playOrder="1">
    <navLabel><text>Página de Título</text></navLabel>
    <content src="title_page.xhtml"/>
  </navPoint>
${items}
</navMap>
</ncx>`;
  writeFile(path.join(oebpsDir, "toc.ncx"), xml);
}

function gerarOPF(oebpsDir, chapters, hasCover) {
  const manifestItems = chapters
    .map(
      (c, i) =>
        `<item id="chap${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`
    )
    .join("\n");

  const spineItems = chapters
    .map((c, i) => `<itemref idref="chap${i + 1}"/>`)
    .join("\n");

  const coverItem = hasCover
    ? `<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="bookid">${BOOK_ID}</dc:identifier>
  <dc:title>${BOOK_TITLE}</dc:title>
  <dc:creator>${BOOK_AUTHOR}</dc:creator>
  <dc:language>pt-BR</dc:language>
</metadata>
<manifest>
  <item id="title_page" href="title_page.xhtml" media-type="application/xhtml+xml"/>
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  ${coverItem}
  ${manifestItems}
  <item id="css" href="stylesheet.css" media-type="text/css"/>
</manifest>
<spine toc="ncx">
  <itemref idref="title_page"/>
  ${spineItems}
</spine>
</package>`;
  writeFile(path.join(oebpsDir, "content.opf"), xml);
}

function gerarContainer(metaDir) {
  const xml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  writeFile(path.join(metaDir, "container.xml"), xml);
}

async function zipToEpub(baseDir, outputFile) {
  const output = fs.createWriteStream(outputFile);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    // mimetype SEM compressão
    archive.append("application/epub+zip", { store: true, name: "mimetype" });

    // META-INF e OEBPS
    archive.directory(path.join(baseDir, "META-INF"), "META-INF");
    archive.directory(path.join(baseDir, "OEBPS"), "OEBPS");

    archive.finalize();
  });
}

// ---------------- MAIN ----------------
async function main() {
  const workDir = path.join(process.cwd(), "build_epub");
  const metaDir = path.join(workDir, "META-INF");
  const oebpsDir = path.join(workDir, "OEBPS");

  fs.rmSync(workDir, { recursive: true, force: true });
  ensureDir(metaDir);
  ensureDir(oebpsDir);

  // Capa se existir
  const imagesDir = path.join(oebpsDir, "images");
  ensureDir(imagesDir);
  let hasCover = false;
  if (fs.existsSync(COVER_SOURCE_FILE)) {
    fs.copyFileSync(COVER_SOURCE_FILE, path.join(imagesDir, "cover.jpg"));
    hasCover = true;
    gerarCoverXHTML(oebpsDir);
    console.log("🖼️  Capa encontrada e copiada.");
  }

  gerarTitlePage(oebpsDir);
  gerarStylesheet(oebpsDir);
  gerarContainer(metaDir);

  // Scraping
  const browser = await puppeteer.launch({ headless: true });
  const chapters = [];
  try {
    for (let i = 0; i < URLS.length; i++) {
      console.log(`🔎 Extraindo: ${URLS[i]}`);
      try {
        const cap = await extrairCapitulo(browser, URLS[i]);
        const file = gerarChapterXHTML(oebpsDir, cap, i);
        chapters.push({ ...cap, file });
      } catch (err) {
        console.error(`❌ Erro em ${URLS[i]}:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  gerarNav(oebpsDir, chapters);
  gerarNCX(oebpsDir, chapters);
  gerarOPF(oebpsDir, chapters, hasCover);

  // Compactar em EPUB
  await zipToEpub(workDir, OUTPUT_FILE);
  console.log(`\n📚 EPUB gerado com sucesso: ${OUTPUT_FILE}`);
}

main();
