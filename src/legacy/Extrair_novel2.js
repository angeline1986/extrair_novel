import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import archiver from "archiver";

// === Links do Volume 2 de Qiang Jin Jiu ===
const URLS = [
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-2/capitulo-97/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-2/capitulo-98/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-2/capitulo-99/",
  "https://nocfsb.com/manga/qiang-jin-jiu/volume-2/capitulo-100/",
  // ... (adicione o restante dos links até 191, como você listou antes)
];

// === Função para coletar parágrafos ===
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

// === Funções para gerar arquivos do EPUB ===
function gerarMimetype(dir) {
  fs.writeFileSync(path.join(dir, "mimetype"), "application/epub+zip");
}

function gerarContainerXml(metaDir) {
  const content = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`;
  fs.writeFileSync(path.join(metaDir, "container.xml"), content);
}

function gerarCoverXhtml(oebpsDir) {
  const content = `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head><title>Cover</title>
<style type="text/css" title="override_css">
@page {padding: 0pt; margin:0pt}
body { text-align: center; padding:0pt; margin: 0pt; }
div { margin: 0pt; padding: 0pt; }
</style></head>
<body class="fff_coverpage"><div>
<img src="images/cover.jpg" alt="cover"/>
</div></body></html>`;
  fs.writeFileSync(path.join(oebpsDir, "cover.xhtml"), content);
}

function gerarTitlePage(oebpsDir) {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Qiang Jin Jiu (Convite ao Vinho) {PTBR} Volume 2</title>
<link href="stylesheet.css" type="text/css" rel="stylesheet"/>
</head>
<body class="fff_titlepage">
<h3>Qiang Jin Jiu (Convite ao Vinho) {PTBR} Volume 2</h3>
</body>
</html>`;
  fs.writeFileSync(path.join(oebpsDir, "title_page.xhtml"), content);
}

function gerarStylesheet(oebpsDir) {
  const css = `body { font-family: serif; line-height: 1.4; margin: 1em; }
h3 { text-align: center; margin-top: 1em; }
p { text-indent: 1.5em; margin: 0.5em 0; }`;
  fs.writeFileSync(path.join(oebpsDir, "stylesheet.css"), css);
}

function gerarCapituloXhtml(oebpsDir, idx, cap) {
  const fileName = `file${String(idx + 1).padStart(4, "0")}.xhtml`;
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${cap.titulo}</title>
<link href="stylesheet.css" type="text/css" rel="stylesheet"/>
<meta name="chapterurl" content="${cap.url}" />
<meta name="chaptertitle" content="${cap.titulo}" />
</head>
<body class="fff_chapter">
<h3 class="fff_chapter_title">${cap.titulo}</h3>
${cap.paragrafos.map(p => `<p>${p}</p>`).join("\n")}
</body>
</html>`;
  fs.writeFileSync(path.join(oebpsDir, fileName), content);
  return fileName;
}

function gerarContentOpf(oebpsDir, capitulos) {
  const manifestItems = [
    `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="title" href="title_page.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="css" href="stylesheet.css" media-type="text/css"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
  ];
  const spineItems = [
    `<itemref idref="title"/>`
  ];

  capitulos.forEach((c, i) => {
    manifestItems.push(
      `<item id="chap${i + 1}" href="file${String(i + 1).padStart(4, "0")}.xhtml" media-type="application/xhtml+xml"/>`
    );
    spineItems.push(`<itemref idref="chap${i + 1}"/>`);
  });

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Qiang Jin Jiu Vol.2</dc:title>
    <dc:language>pt-BR</dc:language>
    <dc:identifier id="BookId">qiang-jin-jiu-vol2</dc:identifier>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join("\n    ")}
  </spine>
</package>`;
  fs.writeFileSync(path.join(oebpsDir, "content.opf"), content);
}

function gerarTocNcx(oebpsDir, capitulos) {
  const navPoints = capitulos.map((c, i) => {
    const id = `navPoint-${i + 1}`;
    const file = `file${String(i + 1).padStart(4, "0")}.xhtml`;
    return `<navPoint id="${id}" playOrder="${i + 1}">
      <navLabel><text>${c.titulo}</text></navLabel>
      <content src="${file}"/>
    </navPoint>`;
  });

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="qiang-jin-jiu-vol2"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle><text>Qiang Jin Jiu Vol.2</text></docTitle>
  <navMap>
    ${navPoints.join("\n    ")}
  </navMap>
</ncx>`;
  fs.writeFileSync(path.join(oebpsDir, "toc.ncx"), content);
}

async function main() {
  const buildDir = path.join(process.cwd(), "build_epub");
  const metaDir = path.join(buildDir, "META-INF");
  const oebpsDir = path.join(buildDir, "OEBPS");
  const imagesDir = path.join(oebpsDir, "images");

  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(metaDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const capitulos = [];
  try {
    for (const url of URLS) {
      console.log(`\n🔎 Extraindo: ${url}`);
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

  // gerar arquivos fixos
  gerarMimetype(buildDir);
  gerarContainerXml(metaDir);
  gerarCoverXhtml(oebpsDir);
  gerarTitlePage(oebpsDir);
  gerarStylesheet(oebpsDir);

  // gerar capítulos
  capitulos.forEach((cap, idx) => {
    gerarCapituloXhtml(oebpsDir, idx, cap);
  });

  gerarContentOpf(oebpsDir, capitulos);
  gerarTocNcx(oebpsDir, capitulos);

  // criar EPUB final
  const output = fs.createWriteStream("qiang_jin_jiu_vol2.epub");
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`\n📖 EPUB gerado: qiang_jin_jiu_vol2.epub (${archive.pointer()} bytes)`);
  });

  archive.pipe(output);

  // mimetype SEM compressão
  archive.append("application/epub+zip", { store: true, name: "mimetype" });

  // resto dos arquivos
  archive.directory(buildDir + "/", false);

  await archive.finalize();
}

main();
