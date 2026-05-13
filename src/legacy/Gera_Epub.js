import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import archiver from "archiver";

// ---------------- CONFIG ----------------
const BOOK_TITLE = "Qiang Jin Jiu - Volume 3 (Final)";
const BOOK_AUTHOR = "yunmenghell";
const BOOK_ID = "qiangjinjiu-vol3";
const OUTPUT_FILE = "qiang_jin_jiu_vol3.epub";

// Se houver um "cover.jpg" no diretório do script, ele será copiado.
// Senão, o EPUB ainda é gerado, mas sem item de capa no OPF.
const COVER_SOURCE_FILE = path.join(process.cwd(), "cover.jpg");

// Lista de capítulos do Volume 3 (192 → 282 final)
const URLS = [
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-192/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-193/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-194/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-195/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-196/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-197/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-198/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-199/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-200/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-201/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-202/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-203/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-204/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-205/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-206/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-207/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-208/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-209/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-210/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-211/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-212/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-213/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-214/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-215/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-216/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-217/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-218/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-219/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-220/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-221/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-222/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-223/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-224/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-225/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-226/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-227/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-228/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-229/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-230/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-231/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-232/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-233/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-234/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-235/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-236/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-237/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-238/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-239/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-240/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-241/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-242/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-243/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-244/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-245/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-246/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-247/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-248/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-249/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-250/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-251/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-252/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-253/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-254/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-255/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-256/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-257/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-258/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-259/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-260/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-261/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-262/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-263/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-264/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-265/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-266/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-267/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-268/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-269/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-270/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-271/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-272/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-273/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-274/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-275/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-276/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-277/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-278/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-279/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-280/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-281/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-3-final/capitulo-final-282/",
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
